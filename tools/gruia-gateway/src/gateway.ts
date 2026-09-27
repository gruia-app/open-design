import bcrypt from "bcryptjs";
import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Transform, pipeline } from "node:stream";
import type { Duplex } from "node:stream";
import { renderGatewayMetrics } from "./metrics.js";
import type { AuthAuditContext, AuthAuditEvent, AuthorizationRepository, GatewayConfig, GatewayIdentity, GatewayStoreMetrics, SessionStore, StoredSession } from "./types.js";

type Authorized = Readonly<{ session: StoredSession; identity: GatewayIdentity }>;
type Form = ReadonlyMap<string, string>;
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const strippedRequestHeaders = new Set(["authorization", "proxy-authorization", "cookie", "host", "od-api-token", "x-identity", "x-real-ip", "forwarded", "x-gruia-csrf"]);
const identityHeader = /^(x-(identity|user|org|organization)(-|$)|x-forwarded-)/;
const MAX_AUTH_FORM_BYTES = 8 * 1024;
const LOGIN_CSRF_TTL_MS = 10 * 60_000;
const LOGIN_GLOBAL_LIMIT = 60;
const LOGIN_EMAIL_LIMIT = 8;
const LOGIN_IP_LIMIT = 20;
const LOGIN_WINDOW_MS = 60_000;
const MAX_TRACKED_EMAILS = 5_000;
const MAX_TRACKED_IPS = 10_000;
const MAX_PBKDF2_ITERATIONS = 2_000_000;
const DUMMY_BCRYPT_HASH = "$2b$10$7EqJtq98hPqEX7fNZaFWoO.eD9bjVg4mbhAFt0zHehsFd6rC0AY1i";

function random(): string { return randomBytes(32).toString("base64url"); }
function nowMs(): number { return Date.now(); }
function noStore(response: ServerResponse): void { response.setHeader("cache-control", "no-store, private, max-age=0"); response.setHeader("pragma", "no-cache"); response.setHeader("x-content-type-options", "nosniff"); }
function json(response: ServerResponse, status: number, value: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) { response.destroy(); return; }
  noStore(response); response.writeHead(status, { "content-type": "application/json; charset=utf-8" }); response.end(JSON.stringify(value));
}
function parseCookies(header: string | undefined): ReadonlyMap<string, string> { const result = new Map<string, string>(); for (const part of (header ?? "").split(";")) { const index = part.indexOf("="); if (index > 0) { try { result.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())); } catch { /* malformed cookies are absent */ } } } return result; }
function equal(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
function loginCsrfCookieName(config: GatewayConfig): string { return config.testMode ? "gruia_design_login_csrf" : "__Host-gruia_design_login_csrf"; }
function cookie(config: GatewayConfig, name: string, value: string, expiresAt: number): string { const secure = config.testMode ? "" : "; Secure"; return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}`; }
function expiredCookie(config: GatewayConfig, name: string): string { return `${name}=; Path=/; HttpOnly; SameSite=Lax${config.testMode ? "" : "; Secure"}; Max-Age=0`; }
function normalizeEmail(value: string | undefined): string | null { if (!value) return null; const email = value.trim().toLowerCase(); return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }

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
export function daemonUpstreamHeaders(headers: IncomingHttpHeaders, target: URL, daemonApiToken: string, clientIp?: string): Record<string, string | string[]> {
  const output = sanitizedUpstreamHeaders(headers, target);
  output.authorization = `Bearer ${daemonApiToken}`;
  if (clientIp) output["x-forwarded-for"] = clientIp;
  return output;
}

/** Verifies the two formats already stored for canonical Gruia users. */
export async function verifyCanonicalPassword(password: string, hash: string): Promise<boolean> {
  if (password.length > 4096 || hash.length > 1024) return false;
  if (/^\$2[aby]\$\d\d\$/.test(hash)) {
    try { return await bcrypt.compare(password, hash); } catch { return false; }
  }
  const match = /^pbkdf2_sha256\$([0-9]+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(hash);
  if (!match) return false;
  const iterations = Number(match[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) return false;
  let salt: Buffer; let expected: Buffer;
  try { salt = Buffer.from(match[2], "base64url"); expected = Buffer.from(match[3], "base64url"); } catch { return false; }
  if (salt.length < 8 || salt.length > 1024 || expected.length < 16 || expected.length > 64) return false;
  try {
    const actual = await new Promise<Buffer>((resolve, reject) => pbkdf2(password, salt, iterations, expected.length, "sha256", (error, derived) => error ? reject(error) : resolve(derived)));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

class LoginRateLimiter {
  private global: number[] = [];
  private readonly emails = new Map<string, number[]>();
  private readonly ips = new Map<string, number[]>();
  constructor(private readonly clock: () => number) {}
  private sweep(map: Map<string, number[]>, cutoff: number): void { for (const [key, values] of map) { const active = values.filter((time) => time >= cutoff); if (active.length) map.set(key, active); else map.delete(key); } }
  private track(map: Map<string, number[]>, key: string, cap: number, now: number): number[] {
    const attempts = map.get(key) ?? [];
    if (!map.has(key) && map.size >= cap) map.delete(map.keys().next().value!);
    attempts.push(now); map.set(key, attempts);
    return attempts;
  }
  allow(email: string, ip?: string): boolean {
    const now = this.clock(); const cutoff = now - LOGIN_WINDOW_MS;
    this.global = this.global.filter((time) => time >= cutoff);
    this.sweep(this.emails, cutoff); this.sweep(this.ips, cutoff);
    const ipAttempts = ip ? (this.ips.get(ip) ?? []) : null;
    if (this.global.length >= LOGIN_GLOBAL_LIMIT
      || (this.emails.get(email) ?? []).length >= LOGIN_EMAIL_LIMIT
      || (ipAttempts !== null && ipAttempts.length >= LOGIN_IP_LIMIT)) return false;
    this.track(this.emails, email, MAX_TRACKED_EMAILS, now);
    if (ip) this.track(this.ips, ip, MAX_TRACKED_IPS, now);
    this.global.push(now);
    return true;
  }
}

export class GatewayCore {
  private readonly limiter: LoginRateLimiter;
  constructor(readonly config: GatewayConfig, private readonly store: SessionStore, private readonly identities: AuthorizationRepository, private readonly clock: () => number = nowMs) { this.limiter = new LoginRateLimiter(clock); }
  startLoginCsrf(): { token: string; expiresAt: number } { const token = random(); const expiresAt = this.clock() + LOGIN_CSRF_TTL_MS; this.store.createLoginCsrf(token, expiresAt); return { token, expiresAt }; }
  consumeLoginCsrf(cookieToken: string | undefined, formToken: string | undefined): boolean { return !!cookieToken && !!formToken && cookieToken.length <= 1024 && formToken.length <= 1024 && this.store.consumeLoginCsrf(cookieToken, formToken, this.clock()); }
  recordAuthEvent(event: AuthAuditEvent, fields: Omit<Parameters<SessionStore["recordAuthEvent"]>[0], "event" | "at"> = {}): void {
    this.store.recordAuthEvent({ event, at: this.clock(), ...fields });
  }
  async login(email: string, password: string, context?: AuthAuditContext): Promise<{ id: string; expiresAt: number } | null> {
    const audit = (detail: string): void => this.recordAuthEvent("login_failure", { email, detail, ...(context ?? {}) });
    if (!this.limiter.allow(email, context?.ip)) { audit("rate_limited"); return null; }
    const user = await this.identities.findLoginUser(email, this.admittedOrganizationIds());
    const validPassword = await verifyCanonicalPassword(password, user?.hashedPassword ?? DUMMY_BCRYPT_HASH);
    if (!user || !validPassword) { audit("invalid_credentials"); return null; }
    const identity = this.singleAdmittedIdentity(user.identities);
    if (!identity) { audit("not_admitted"); return null; }
    const id = random(); const expiresAt = this.clock() + this.config.sessionTtlSeconds * 1000;
    this.store.createSession(Object.freeze({ id, userId: identity.userId, organizationId: identity.organizationId, role: identity.role, csrfToken: random(), expiresAt }));
    this.recordAuthEvent("login_success", { email, userId: identity.userId, organizationId: identity.organizationId, ...(context ?? {}) });
    return { id, expiresAt };
  }
  async authorize(sessionId: string | undefined, context?: AuthAuditContext): Promise<Authorized | null> {
    if (!sessionId || sessionId.length > 1024) return null;
    const session = this.store.readSession(sessionId, this.clock(), context);
    if (!session) return null;
    if (!this.admittedOrganizationIds().includes(session.organizationId)) {
      this.store.deleteSession(session.id);
      this.recordAuthEvent("session_revoked", { userId: session.userId, organizationId: session.organizationId, detail: "org_not_admitted", ...(context ?? {}) });
      return null;
    }
    const identity = this.singleAdmittedIdentity(await this.identities.resolveUser(session.userId, [session.organizationId]));
    if (!identity || !equal(identity.userId, session.userId) || !equal(identity.organizationId, session.organizationId)) {
      this.store.deleteSession(session.id);
      this.recordAuthEvent("session_revoked", { userId: session.userId, organizationId: session.organizationId, detail: "identity_mismatch", ...(context ?? {}) });
      return null;
    }
    return Object.freeze({ session, identity });
  }
  csrf(sessionId: string, value: string | undefined, context?: AuthAuditContext): boolean { return !!value && value.length <= 1024 && this.store.verifyCsrf(sessionId, value, this.clock(), context); }
  async logout(sessionId: string | undefined, context?: AuthAuditContext): Promise<void> {
    if (!sessionId) return;
    const session = this.store.readSession(sessionId, this.clock(), context);
    this.store.deleteSession(sessionId);
    if (session) this.recordAuthEvent("logout", { userId: session.userId, organizationId: session.organizationId, ...(context ?? {}) });
  }
  storeMetrics(): GatewayStoreMetrics { return this.store.readMetrics(this.clock()); }
  async close(): Promise<void> { this.store.close(); await this.identities.close(); }
  private admittedOrganizationIds(): string[] { return [...this.config.organizations].filter(([, target]) => target.audience === "internal" || this.config.clientAccessOpen).map(([id]) => id); }
  private singleAdmittedIdentity(identities: readonly GatewayIdentity[]): GatewayIdentity | null { return identities.length === 1 && this.config.organizations.has(identities[0].organizationId) && this.admittedOrganizationIds().includes(identities[0].organizationId) ? identities[0] : null; }
}

function noFrame(response: ServerResponse): void { response.setHeader("content-security-policy", "frame-ancestors 'none'"); response.setHeader("x-frame-options", "DENY"); }
function loginPage(response: ServerResponse, core: GatewayCore, status = 200, error?: string): void {
  const login = core.startLoginCsrf(); const csrfName = loginCsrfCookieName(core.config);
  noStore(response); noFrame(response); response.setHeader("set-cookie", cookie(core.config, csrfName, login.token, login.expiresAt));
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", "referrer-policy": "same-origin" });
  response.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrar · Gruia Design</title><style>body{margin:0;background:#f6f4ef;color:#24231f;font:16px system-ui,sans-serif}main{max-width:25rem;margin:10vh auto;padding:2rem;background:#fff;border:1px solid #dedbd2;border-radius:12px;box-shadow:0 8px 30px #0001}label{display:block;margin-top:1rem;font-weight:600}input,button{box-sizing:border-box;width:100%;padding:.7rem;margin-top:.35rem;border-radius:7px;border:1px solid #aaa;font:inherit}button{background:#24231f;color:white;cursor:pointer}.error{color:#9b1c1c}</style><main><h1>Gruia Design</h1><p>Inicia sesión con tu cuenta de Gruia.</p>${error ? `<p class="error" role="alert">${error}</p>` : ""}<form method="post" action="/auth/login"><input type="hidden" name="csrf" value="${login.token}"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="320"><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="4096"><button type="submit">Entrar</button></form></main></html>`);
}
function signedInPage(response: ServerResponse, core: GatewayCore, session: StoredSession): void {
  noStore(response); noFrame(response); response.writeHead(200, { "content-type": "text/html; charset=utf-8", "referrer-policy": "same-origin" });
  response.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gruia Design</title><main><h1>Gruia Design</h1><p>Sesión iniciada.</p><p><a href="/">Abrir el estudio</a></p><form method="post" action="/auth/logout"><input type="hidden" name="csrf" value="${session.csrfToken}"><button type="submit">Cerrar sesión</button></form></main></html>`);
}
async function readForm(request: IncomingMessage): Promise<Form | null> {
  const contentType = request.headers["content-type"];
  const length = Number(request.headers["content-length"] ?? 0);
  if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("application/x-www-form-urlencoded") || !Number.isSafeInteger(length) || length < 0 || length > MAX_AUTH_FORM_BYTES) return null;
  const chunks: Buffer[] = []; let received = 0;
  try { for await (const chunk of request) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); received += bytes.length; if (received > MAX_AUTH_FORM_BYTES) return null; chunks.push(bytes); } } catch { return null; }
  const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8")); const form = new Map<string, string>();
  for (const [key, value] of params) { if (key.length > 32 || value.length > 4096 || form.has(key)) return null; form.set(key, value); }
  return form;
}

export function createGatewayServer(core: GatewayCore): Server {
  const startedAt = Date.now();
  const server = createServer((request, response) => { void handleRequest(request, response, core, startedAt).catch(() => json(response, 503, { error: "service_unavailable" })); });
  server.on("upgrade", (request, socket, head) => { void handleUpgrade(request, socket, head, core).catch(() => socket.destroy()); });
  return server;
}

/** Stops accepting work, then force-closes lingering keep-alive/SSE sockets after a grace period so SIGTERM cannot hang on open proxy streams. */
export function shutdownGateway(server: Server, graceMs = 5_000): Promise<void> {
  const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  const force = setTimeout(() => server.closeAllConnections(), graceMs);
  force.unref();
  return closed;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, core: GatewayCore, startedAt: number): Promise<void> {
  const raw = request.url;
  if (!isSafeProxyPath(raw)) { json(response, 400, { error: "invalid_request" }); return; }
  const url = new URL(raw, core.config.publicOrigin); const method = request.method ?? "GET";
  if (url.pathname === "/healthz" || url.pathname === "/health") { if (method !== "GET") { json(response, 405, { error: "method_not_allowed" }); return; } noStore(response); response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); response.end("ok\n"); return; }
  if (url.pathname === "/metrics") { serveMetrics(request, response, core, method, startedAt); return; }
  if (url.pathname === "/auth" || url.pathname === "/auth/login") {
    if (method === "GET") { const sessionId = parseCookies(request.headers.cookie).get(core.config.cookieName); const authorized = await core.authorize(sessionId, authContext(request)); if (authorized) signedInPage(response, core, authorized.session); else loginPage(response, core); return; }
    if (url.pathname === "/auth/login" && method === "POST") { await handleLogin(request, response, core); return; }
    json(response, 405, { error: "method_not_allowed" }); return;
  }
  if (url.pathname === "/auth/logout") { if (method !== "POST") { json(response, 405, { error: "method_not_allowed" }); return; } await handleLogout(request, response, core); return; }
  const sessionId = parseCookies(request.headers.cookie).get(core.config.cookieName);
  const authorized = await core.authorize(sessionId, authContext(request));
  if (!authorized || !sessionId) { if ((request.headers.accept ?? "").includes("text/html")) { response.writeHead(302, { location: "/auth", "cache-control": "no-store" }); response.end(); } else json(response, 401, { error: "authentication_required" }); return; }
  if (unsafeMethods.has(method) && (!isExpectedOrigin(request.headers.origin, core.config) || authorized.identity.role.toUpperCase() === "VIEWER")) { json(response, 403, { error: "forbidden" }); return; }
  if (url.pathname === "/auth/session") { if (method !== "GET") { json(response, 405, { error: "method_not_allowed" }); return; } json(response, 200, { userId: authorized.identity.userId, organizationId: authorized.identity.organizationId, role: authorized.identity.role, csrfToken: authorized.session.csrfToken }); return; }
  if (!isStudioOperator(core, authorized.identity, url.pathname, request)) { json(response, 403, { code: "studio_operator_only" }); return; }
  await proxy(request, response, core, authorized.identity.organizationId);
}

function authContext(request: IncomingMessage): AuthAuditContext {
  const forwarded = request.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",", 1)[0]?.trim();
  const ip = first && first.length <= 64 ? first : request.socket.remoteAddress;
  const agent = request.headers["user-agent"];
  return { ...(ip ? { ip } : {}), ...(typeof agent === "string" && agent.length <= 512 ? { userAgent: agent } : {}) };
}
/** Fail-closed studio allowlist: only configured operator user ids reach the daemon. */
function isStudioOperator(core: GatewayCore, identity: GatewayIdentity, detail: string, request: IncomingMessage): boolean {
  if (core.config.studioOperatorUserIds.includes(identity.userId)) return true;
  core.recordAuthEvent("studio_operator_denied", { userId: identity.userId, organizationId: identity.organizationId, detail: `${request.method ?? ""} ${detail}`.slice(0, 128), ...authContext(request) });
  return false;
}
function serveMetrics(request: IncomingMessage, response: ServerResponse, core: GatewayCore, method: string, startedAt: number): void {
  const token = core.config.metricsToken;
  if (!token) { json(response, 404, { error: "not_found" }); return; }
  if (method !== "GET") { json(response, 405, { error: "method_not_allowed" }); return; }
  const expected = `Bearer ${token}`;
  const presented = request.headers.authorization ?? "";
  if (presented.length !== expected.length || !equal(presented, expected)) {
    noStore(response); response.writeHead(401, { "content-type": "application/json; charset=utf-8", "www-authenticate": 'Bearer realm="metrics"' }); response.end(JSON.stringify({ error: "authentication_required" }));
    return;
  }
  const snapshot = core.storeMetrics();
  noStore(response); response.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8" });
  response.end(renderGatewayMetrics({ uptimeSeconds: (Date.now() - startedAt) / 1000, activeSessions: snapshot.activeSessions, authEvents: snapshot.authEvents }));
}
async function handleLogin(request: IncomingMessage, response: ServerResponse, core: GatewayCore): Promise<void> {
  const csrfName = loginCsrfCookieName(core.config); const form = await readForm(request);
  const csrfCookie = parseCookies(request.headers.cookie).get(csrfName);
  const validCsrf = isExpectedOrigin(request.headers.origin, core.config) && !!form && core.consumeLoginCsrf(csrfCookie, form.get("csrf"));
  const context = authContext(request);
  if (!validCsrf) { core.recordAuthEvent("login_failure", { detail: "csrf_rejected", ...context }); loginPage(response, core, 403, "No fue posible iniciar sesión."); return; }
  const email = normalizeEmail(form.get("email")); const password = form.get("password");
  if (!email || typeof password !== "string") { core.recordAuthEvent("login_failure", { detail: "malformed_form", ...context }); loginPage(response, core, 401, "Credenciales inválidas o acceso no autorizado."); return; }
  const result = await core.login(email, password, context);
  if (!result) { loginPage(response, core, 401, "Credenciales inválidas o acceso no autorizado."); return; }
  noStore(response); response.setHeader("set-cookie", [expiredCookie(core.config, csrfName), cookie(core.config, core.config.cookieName, result.id, result.expiresAt)]); response.writeHead(303, { location: "/" }); response.end();
}
async function handleLogout(request: IncomingMessage, response: ServerResponse, core: GatewayCore): Promise<void> {
  const sessionId = parseCookies(request.headers.cookie).get(core.config.cookieName); const form = await readForm(request);
  if (!sessionId || !form || !isExpectedOrigin(request.headers.origin, core.config) || !core.csrf(sessionId, form.get("csrf"), authContext(request))) { core.recordAuthEvent("logout_failure", { detail: "csrf_rejected", ...authContext(request) }); loginPage(response, core, 403, "No fue posible cerrar la sesión."); return; }
  await core.logout(sessionId, authContext(request)); noStore(response); response.setHeader("set-cookie", expiredCookie(core.config, core.config.cookieName)); response.writeHead(303, { location: "/auth" }); response.end();
}

async function proxy(request: IncomingMessage, response: ServerResponse, core: GatewayCore, organizationId: string): Promise<void> {
  // Authorization may finish after the browser has already left the page.
  if (response.destroyed || response.writableEnded) return;
  const target = core.config.organizations.get(organizationId); if (!target || !isSafeProxyPath(request.url)) { json(response, 403, { error: "forbidden" }); return; }
  const upstream = new URL(target.upstream); const contentLength = Number(request.headers["content-length"] ?? 0);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > core.config.requestBodyLimitBytes) { json(response, 413, { error: "payload_too_large" }); return; }
  const headers = daemonUpstreamHeaders(request.headers, upstream, target.daemonApiToken, authContext(request).ip);
  const upstreamRequest = httpRequest({ protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port, method: request.method, path: request.url, headers, timeout: core.config.upstreamTimeoutMs }, (upstreamResponse) => {
    if (response.destroyed || response.writableEnded) { upstreamResponse.destroy(); return; }
    try {
      if ((upstreamResponse.statusCode ?? 502) >= 300 && (upstreamResponse.statusCode ?? 502) < 400) { upstreamResponse.resume(); json(response, 502, { error: "upstream_redirect_rejected" }); return; }
      noStore(response); for (const [name, value] of Object.entries(upstreamResponse.headers)) if (value !== undefined && name.toLowerCase() !== "set-cookie" && name.toLowerCase() !== "cache-control") response.setHeader(name, value);
      response.writeHead(upstreamResponse.statusCode ?? 502); pipeline(upstreamResponse, response, () => undefined);
    } catch {
      // This callback runs after handleRequest resolves; synchronous stream setup
      // failures must not escape as uncaught exceptions and stop the gateway.
      upstreamResponse.destroy();
      json(response, 502, { error: "upstream_unavailable" });
    }
  });
  response.once("close", () => { if (!response.writableFinished) upstreamRequest.destroy(); });
  upstreamRequest.on("timeout", () => upstreamRequest.destroy(new Error("upstream timeout")));
  upstreamRequest.on("error", () => json(response, 502, { error: "upstream_unavailable" }));
  let received = 0;
  const limiter = new Transform({ transform(chunk: Buffer, _encoding, done) { received += chunk.length; done(received > core.config.requestBodyLimitBytes ? new Error("body too large") : null, chunk); } });
  limiter.on("error", () => { upstreamRequest.destroy(); if (!response.headersSent) json(response, 413, { error: "payload_too_large" }); });
  pipeline(request, limiter, upstreamRequest, () => undefined);
}

async function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer, core: GatewayCore): Promise<void> {
  const deny = (): void => { socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); socket.destroy(); };
  if (!isSafeProxyPath(request.url) || head.length > core.config.requestBodyLimitBytes || !isAuthorizedWebSocketHandshake(request.headers, core.config)) { deny(); return; }
  const sessionId = parseCookies(request.headers.cookie).get(core.config.cookieName); const authorized = await core.authorize(sessionId, authContext(request));
  if (!authorized || authorized.identity.role.toUpperCase() === "VIEWER" || !isStudioOperator(core, authorized.identity, "websocket", request)) { deny(); return; }
  const target = core.config.organizations.get(authorized.identity.organizationId); if (!target) { deny(); return; }
  const upstream = new URL(target.upstream); const headers = daemonUpstreamHeaders(request.headers, upstream, target.daemonApiToken, authContext(request).ip);
  const upstreamRequest = httpRequest({ protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port, method: request.method, path: request.url, headers, timeout: core.config.upstreamTimeoutMs });
  upstreamRequest.on("response", (upstreamResponse) => { upstreamResponse.resume(); deny(); });
  upstreamRequest.on("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => { let lines = `HTTP/${upstreamResponse.httpVersion} ${upstreamResponse.statusCode} ${upstreamResponse.statusMessage}\r\n`; for (const [name, value] of Object.entries(upstreamResponse.headers)) if (value !== undefined && name.toLowerCase() !== "set-cookie") lines += `${name}: ${Array.isArray(value) ? value.join(", ") : value}\r\n`; socket.write(`${lines}\r\n`); if (upstreamHead.length) socket.write(upstreamHead); if (head.length) upstreamSocket.write(head); upstreamSocket.pipe(socket).pipe(upstreamSocket); });
  upstreamRequest.on("timeout", () => upstreamRequest.destroy()); upstreamRequest.on("error", deny); upstreamRequest.end();
}
