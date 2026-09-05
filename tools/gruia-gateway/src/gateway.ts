import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Transform, pipeline } from "node:stream";
import type { Duplex } from "node:stream";
import { authorizationUrl } from "./workos.js";
import type { AuthorizationRepository, GatewayConfig, GatewayIdentity, SessionStore, StoredSession, WorkOSClient } from "./types.js";

type Authorized = Readonly<{ session: StoredSession; identity: GatewayIdentity }>;
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const strippedRequestHeaders = new Set(["authorization", "proxy-authorization", "cookie", "host", "od-api-token", "x-identity", "x-real-ip", "forwarded", "x-gruia-csrf"]);
const identityHeader = /^(x-(identity|user|org|organization)(-|$)|x-forwarded-)/;

function random(): string { return randomBytes(32).toString("base64url"); }
function nowMs(): number { return Date.now(); }
function noStore(response: ServerResponse): void { response.setHeader("cache-control", "no-store, private, max-age=0"); response.setHeader("pragma", "no-cache"); response.setHeader("x-content-type-options", "nosniff"); }
function html(response: ServerResponse, status: number, title: string, message: string): void { noStore(response); response.writeHead(status, { "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer" }); response.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><main><h1>${title}</h1><p>${message}</p></main></html>`); }
function json(response: ServerResponse, status: number, value: unknown): void { noStore(response); response.writeHead(status, { "content-type": "application/json; charset=utf-8" }); response.end(JSON.stringify(value)); }
function parseCookies(header: string | undefined): ReadonlyMap<string, string> { const result = new Map<string, string>(); for (const part of (header ?? "").split(";")) { const index = part.indexOf("="); if (index > 0) { try { result.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())); } catch { /* malformed cookies are absent */ } } } return result; }
function equal(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

export function isExpectedOrigin(origin: string | undefined, config: GatewayConfig): boolean { return typeof origin === "string" && origin === config.publicOrigin; }
export function isAuthorizedWebSocketHandshake(headers: IncomingHttpHeaders, config: GatewayConfig): boolean {
  const upgrade = Array.isArray(headers.upgrade) ? headers.upgrade[0] : headers.upgrade;
  const connection = Array.isArray(headers.connection) ? headers.connection[0] : headers.connection;
  return upgrade?.toLowerCase() === "websocket" && typeof connection === "string" && connection.toLowerCase().split(",").map((value) => value.trim()).includes("upgrade") && isExpectedOrigin(typeof headers.origin === "string" ? headers.origin : undefined, config);
}
export function isSafeProxyPath(raw: string | undefined): raw is string {
  if (!raw || raw.length > 8192 || !raw.startsWith("/") || raw.startsWith("//") || raw.split("?", 1)[0].includes("\\") || /%2f|%5c/i.test(raw.split("?", 1)[0])) return false;
  const path = raw.split("?", 1)[0];
  try { return !path.split("/").some((part) => { const decoded = decodeURIComponent(part); return decoded === "." || decoded === ".."; }); } catch { return false; }
}

/** Removes every client credential and identity assertion before the fixed daemon token is inserted. */
export function sanitizedUpstreamHeaders(headers: IncomingHttpHeaders, target: URL): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (value === undefined || strippedRequestHeaders.has(lower) || identityHeader.test(lower)) continue;
    output[lower] = value;
  }
  output.host = target.host;
  return output;
}
export function daemonUpstreamHeaders(headers: IncomingHttpHeaders, target: URL, daemonApiToken: string): Record<string, string | string[]> {
  const output = sanitizedUpstreamHeaders(headers, target);
  output.authorization = `Bearer ${daemonApiToken}`;
  return output;
}

export class GatewayCore {
  private readonly refreshes = new Map<string, Promise<void>>();
  constructor(
    readonly config: GatewayConfig,
    private readonly store: SessionStore,
    private readonly identities: AuthorizationRepository,
    private readonly workos: WorkOSClient,
    private readonly clock: () => number = nowMs,
  ) {}

  startLogin(): string {
    const state = random(); const verifier = random();
    this.store.createPendingLogin(state, verifier, this.clock() + 10 * 60_000);
    return authorizationUrl(this.config.workos, state, verifier);
  }

  async finishLogin(state: string, code: string, browserState: string | undefined): Promise<{ id: string; expiresAt: number } | null> {
    if (!browserState || !equal(state, browserState)) return null;
    if (state.length > 1024 || code.length > 16_384) return null;
    const verifier = this.store.consumePendingLogin(state, this.clock());
    if (!verifier) return null;
    const token = await this.workos.exchangeCode(code, verifier);
    if (!token) return null;
    const identity = await this.singleMappedIdentity(token.subject);
    if (!identity) return null; // Multi-org selection is intentionally unavailable; fail closed.
    const id = random(); const expiresAt = this.clock() + this.config.sessionTtlSeconds * 1000;
    this.store.createSession(Object.freeze({ id, userId: identity.userId, subject: token.subject, organizationId: identity.organizationId, role: identity.role, csrfToken: random(), accessToken: token.accessToken, refreshToken: token.refreshToken, providerSessionId: token.sessionId, providerExpiresAt: token.expiresAt, expiresAt }));
    return { id, expiresAt };
  }

  async authorize(sessionId: string | undefined): Promise<Authorized | null> {
    if (!sessionId || sessionId.length > 1024) return null;
    let session = this.store.readSession(sessionId, this.clock());
    if (!session || !this.admittedOrganizationIds().includes(session.organizationId)) return null;
    if (session.providerExpiresAt <= this.clock() + 60_000) {
      await this.refreshSession(session);
      session = this.store.readSession(session.id, this.clock());
      if (!session) return null;
    }
    const resolved = await this.identities.resolve(session.subject, [session.organizationId]);
    const identity = resolved.length === 1 ? resolved[0] : null;
    if (!identity || !equal(identity.userId, session.userId) || !equal(identity.organizationId, session.organizationId)) { this.store.deleteSession(session.id); return null; }
    return Object.freeze({ session, identity });
  }

  csrf(sessionId: string, value: string | undefined): boolean { return !!value && value.length <= 1024 && this.store.verifyCsrf(sessionId, value, this.clock()); }
  async logout(sessionId: string | undefined): Promise<void> { if (!sessionId) return; const session = this.store.readSession(sessionId, this.clock()); this.store.deleteSession(sessionId); if (session) await this.workos.revoke(session.providerSessionId); }
  async close(): Promise<void> { this.store.close(); await this.identities.close(); }

  private async refreshSession(session: StoredSession): Promise<void> {
    // WorkOS refresh tokens are single-use. Concurrent browser requests share
    // one refresh, including its persisted result, within this gateway process.
    const pending = this.refreshes.get(session.id);
    if (pending) return pending;
    const operation = (async () => {
      if (!session.refreshToken) { this.store.deleteSession(session.id); return; }
      try {
        const refreshed = await this.workos.refresh(session.refreshToken);
        if (!refreshed || !equal(refreshed.subject, session.subject)) { this.store.deleteSession(session.id); return; }
        this.store.updateProviderTokens(session.id, Object.freeze({ ...refreshed, refreshToken: refreshed.refreshToken ?? session.refreshToken }));
      } catch { this.store.deleteSession(session.id); }
    })();
    this.refreshes.set(session.id, operation);
    try { await operation; } finally { this.refreshes.delete(session.id); }
  }

  private admittedOrganizationIds(): string[] {
    return [...this.config.organizations].filter(([, target]) => target.audience === "internal" || this.config.clientAccessOpen).map(([id]) => id);
  }

  private async singleMappedIdentity(subject: string): Promise<GatewayIdentity | null> {
    const resolved = await this.identities.resolve(subject, this.admittedOrganizationIds());
    return resolved.length === 1 && this.config.organizations.has(resolved[0].organizationId) ? resolved[0] : null;
  }
}

function cookie(config: GatewayConfig, value: string, expiresAt: number): string { const secure = config.testMode ? "" : "; Secure"; return `${config.cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}`; }
function expiredCookie(config: GatewayConfig): string { return `${config.cookieName}=; Path=/; HttpOnly; SameSite=Lax${config.testMode ? "" : "; Secure"}; Max-Age=0`; }
function csrfProtected(request: IncomingMessage, core: GatewayCore, sessionId: string): boolean { return isExpectedOrigin(request.headers.origin, core.config) && core.csrf(sessionId, typeof request.headers["x-gruia-csrf"] === "string" ? request.headers["x-gruia-csrf"] : undefined); }

export function createGatewayServer(core: GatewayCore): Server {
  const server = createServer((request, response) => { void handleRequest(request, response, core).catch(() => json(response, 503, { error: "service_unavailable" })); });
  server.on("upgrade", (request, socket, head) => { void handleUpgrade(request, socket, head, core).catch(() => socket.destroy()); });
  return server;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, core: GatewayCore): Promise<void> {
  const raw = request.url;
  if (!isSafeProxyPath(raw)) { json(response, 400, { error: "invalid_request" }); return; }
  const url = new URL(raw, core.config.publicOrigin); const method = request.method ?? "GET";
  if (url.pathname === "/healthz" || url.pathname === "/health") { if (method !== "GET") { json(response, 405, { error: "method_not_allowed" }); return; } noStore(response); response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); response.end("ok\n"); return; }
  if (url.pathname === "/auth") { if (method !== "GET") { json(response, 405, { error: "method_not_allowed" }); return; } html(response, 200, "Gruia Design", "<a href=\"/auth/login\">Entrar con mi cuenta de Gruia</a>"); return; }
  if (url.pathname === "/auth/login") {
    if (method !== "GET") { json(response, 405, { error: "method_not_allowed" }); return; }
    const location = core.startLogin();
    const state = new URL(location).searchParams.get("state")!;
    response.setHeader("set-cookie", cookie({ ...core.config, cookieName: `${core.config.cookieName}_login` }, state, Date.now() + 600_000));
    response.writeHead(302, { location, "cache-control": "no-store" }); response.end(); return;
  }
  if (url.pathname === "/auth/callback") { await handleCallback(url, method, request, response, core); return; }
  const sessionId = parseCookies(request.headers.cookie).get(core.config.cookieName);
  const authorized = await core.authorize(sessionId);
  if (!authorized || !sessionId) { if ((request.headers.accept ?? "").includes("text/html")) { response.writeHead(302, { location: "/auth", "cache-control": "no-store" }); response.end(); } else json(response, 401, { error: "authentication_required" }); return; }
  if (unsafeMethods.has(method) && (!isExpectedOrigin(request.headers.origin, core.config) || authorized.identity.role.toUpperCase() === "VIEWER" || (url.pathname.startsWith("/auth/") && !csrfProtected(request, core, sessionId)))) { json(response, 403, { error: "forbidden" }); return; }
  if (url.pathname === "/auth/session") { if (method !== "GET") { json(response, 405, { error: "method_not_allowed" }); return; } json(response, 200, { userId: authorized.identity.userId, organizationId: authorized.identity.organizationId, role: authorized.identity.role, csrfToken: authorized.session.csrfToken }); return; }
  if (url.pathname === "/auth/logout") { if (method !== "POST") { json(response, 405, { error: "method_not_allowed" }); return; } await core.logout(sessionId); noStore(response); response.setHeader("set-cookie", expiredCookie(core.config)); response.writeHead(204); response.end(); return; }
  await proxy(request, response, core, authorized.identity.organizationId);
}

async function handleCallback(url: URL, method: string, request: IncomingMessage, response: ServerResponse, core: GatewayCore): Promise<void> {
  if (method !== "GET") { json(response, 405, { error: "method_not_allowed" }); return; }
  const state = url.searchParams.get("state") ?? ""; const code = url.searchParams.get("code") ?? "";
  const pendingName = `${core.config.cookieName}_login`;
  const browserState = parseCookies(request.headers.cookie).get(pendingName);
  const clearPending = expiredCookie({ ...core.config, cookieName: pendingName });
  response.setHeader("set-cookie", clearPending);
  const result = state && code ? await core.finishLogin(state, code, browserState) : null;
  if (!result) { html(response, 403, "Acceso denegado", "No fue posible iniciar sesión o no tienes acceso a este estudio."); return; }
  noStore(response); response.setHeader("set-cookie", [clearPending, cookie(core.config, result.id, result.expiresAt)]); response.writeHead(303, { location: "/" }); response.end();
}

async function proxy(request: IncomingMessage, response: ServerResponse, core: GatewayCore, organizationId: string): Promise<void> {
  const target = core.config.organizations.get(organizationId); if (!target || !isSafeProxyPath(request.url)) { json(response, 403, { error: "forbidden" }); return; }
  const upstream = new URL(target.upstream); const contentLength = Number(request.headers["content-length"] ?? 0);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > core.config.requestBodyLimitBytes) { json(response, 413, { error: "payload_too_large" }); return; }
  const headers = daemonUpstreamHeaders(request.headers, upstream, target.daemonApiToken);
  const upstreamRequest = httpRequest({ protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port, method: request.method, path: request.url, headers, timeout: core.config.upstreamTimeoutMs }, (upstreamResponse) => {
    if ((upstreamResponse.statusCode ?? 502) >= 300 && (upstreamResponse.statusCode ?? 502) < 400) { upstreamResponse.resume(); json(response, 502, { error: "upstream_redirect_rejected" }); return; }
    noStore(response); for (const [name, value] of Object.entries(upstreamResponse.headers)) if (value !== undefined && name.toLowerCase() !== "set-cookie" && name.toLowerCase() !== "cache-control") response.setHeader(name, value);
    response.writeHead(upstreamResponse.statusCode ?? 502); pipeline(upstreamResponse, response, () => undefined);
  });
  upstreamRequest.on("timeout", () => upstreamRequest.destroy(new Error("upstream timeout")));
  upstreamRequest.on("error", () => { if (!response.headersSent) json(response, 502, { error: "upstream_unavailable" }); else response.destroy(); });
  let received = 0;
  const limiter = new Transform({ transform(chunk: Buffer, _encoding, done) { received += chunk.length; done(received > core.config.requestBodyLimitBytes ? new Error("body too large") : null, chunk); } });
  limiter.on("error", () => { upstreamRequest.destroy(); if (!response.headersSent) json(response, 413, { error: "payload_too_large" }); });
  pipeline(request, limiter, upstreamRequest, () => undefined);
}

async function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer, core: GatewayCore): Promise<void> {
  const deny = (): void => { socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); socket.destroy(); };
  if (!isSafeProxyPath(request.url) || head.length > core.config.requestBodyLimitBytes || !isAuthorizedWebSocketHandshake(request.headers, core.config)) { deny(); return; }
  const sessionId = parseCookies(request.headers.cookie).get(core.config.cookieName); const authorized = await core.authorize(sessionId);
  if (!authorized || authorized.identity.role.toUpperCase() === "VIEWER") { deny(); return; }
  const target = core.config.organizations.get(authorized.identity.organizationId); if (!target) { deny(); return; }
  const upstream = new URL(target.upstream); const headers = daemonUpstreamHeaders(request.headers, upstream, target.daemonApiToken);
  const upstreamRequest = httpRequest({ protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port, method: request.method, path: request.url, headers, timeout: core.config.upstreamTimeoutMs });
  upstreamRequest.on("response", (upstreamResponse) => { upstreamResponse.resume(); deny(); });
  upstreamRequest.on("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => { let lines = `HTTP/${upstreamResponse.httpVersion} ${upstreamResponse.statusCode} ${upstreamResponse.statusMessage}\r\n`; for (const [name, value] of Object.entries(upstreamResponse.headers)) if (value !== undefined && name.toLowerCase() !== "set-cookie") lines += `${name}: ${Array.isArray(value) ? value.join(", ") : value}\r\n`; socket.write(`${lines}\r\n`); if (upstreamHead.length) socket.write(upstreamHead); if (head.length) upstreamSocket.write(head); upstreamSocket.pipe(socket).pipe(upstreamSocket); });
  upstreamRequest.on("timeout", () => upstreamRequest.destroy()); upstreamRequest.on("error", deny); upstreamRequest.end();
}
