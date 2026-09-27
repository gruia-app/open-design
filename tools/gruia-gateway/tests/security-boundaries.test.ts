import { randomBytes } from "node:crypto";
import { createServer, request as httpRequest, type Server, type ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { GatewayCore, createGatewayServer, daemonUpstreamHeaders, isAuthorizedWebSocketHandshake, isExpectedOrigin, isSafeProxyPath, shutdownGateway, verifyCanonicalPassword } from "../src/gateway.js";
import { SqliteSessionStore } from "../src/session-store.js";
import type { AuthorizationRepository, GatewayConfig, GatewayIdentity, GatewayLoginUser } from "../src/types.js";

const secret = randomBytes(32).toString("base64");
// Fixed fixture generated and verified with Python bcrypt.
const passwordHash = "$2b$04$CljJoexSaEZAZtLXmEnLru5sR7vF8PSc.CY8HSdb86wij5Rt8wa9K";
const identity: GatewayIdentity = Object.freeze({ userId: "canonical-user-1", organizationId: "org-a", role: "member" });

function config(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return Object.freeze({ bindHost: "127.0.0.1", port: 3006, publicOrigin: "http://localhost", cookieName: "gruia_design_session", databasePath: ":memory:", sessionSecret: secret, postgresUrl: "postgres://unused", organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a" }]]), sessionTtlSeconds: 14_400, requestBodyLimitBytes: 1024, upstreamTimeoutMs: 1000, clientAccessOpen: true, studioOperatorUserIds: [identity.userId], testMode: true, ...overrides });
}
class Repository implements AuthorizationRepository {
  active = true;
  loginUser: GatewayLoginUser | null = Object.freeze({ userId: identity.userId, hashedPassword: passwordHash, identities: [identity] });
  loginEmails: string[] = [];
  async findLoginUser(email: string, allowed: readonly string[]): Promise<GatewayLoginUser | null> { this.loginEmails.push(email); return this.active && allowed.includes(identity.organizationId) ? this.loginUser : null; }
  async resolveUser(userId: string, allowed: readonly string[]): Promise<readonly GatewayIdentity[]> { return this.active && userId === identity.userId && allowed.includes(identity.organizationId) ? [identity] : []; }
  async close(): Promise<void> {}
}
function setup(options: { clientAccessOpen?: boolean; audience?: "internal" | "client" } = {}): { core: GatewayCore; store: SqliteSessionStore; repo: Repository } {
  const organizations = new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a", audience: options.audience }]]);
  const store = new SqliteSessionStore(":memory:", secret); const repo = new Repository();
  return { core: new GatewayCore(config({ organizations, clientAccessOpen: options.clientAccessOpen ?? true }), store, repo), store, repo };
}
async function listener(core: GatewayCore): Promise<{ server: Server; base: string }> { const server = createGatewayServer(core); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("missing test listener"); return { server, base: `http://127.0.0.1:${address.port}` }; }
async function close(server: Server, core: GatewayCore): Promise<void> { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await core.close(); }
function cookies(response: Response): string[] { return response.headers.getSetCookie(); }
function cookieValue(response: Response, name: string): string { const value = cookies(response).find((item) => item.startsWith(`${name}=`))?.split(";", 1)[0].slice(name.length + 1); if (!value) throw new Error(`missing ${name} cookie`); return decodeURIComponent(value); }
function csrf(html: string): string { const value = /name="csrf" value="([^"]+)"/.exec(html)?.[1]; if (!value) throw new Error("missing csrf form token"); return value; }

describe("Gruia gateway client cancellation", () => {
  it("delivers a complete delayed response with the fixed daemon credential", async () => {
    const received = Promise.withResolvers<ServerResponse>();
    const upstream = createServer((request, response) => {
      expect(request.headers.authorization).toBe("Bearer daemon-a");
      expect(request.headers.cookie).toBeUndefined();
      expect(request.headers["x-forwarded-for"]).toBe("198.51.100.66");
      response.setHeader("set-cookie", "upstream-cookie=blocked");
      response.write("first ");
      received.resolve(response);
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address();
    if (!address || typeof address === "string") throw new Error("missing upstream listener");
    const core = new GatewayCore(config({ organizations: new Map([["org-a", { upstream: `http://127.0.0.1:${address.port}`, daemonApiToken: "daemon-a" }]]) }), new SqliteSessionStore(":memory:", secret), new Repository());
    const { server, base } = await listener(core);
    try {
      const session = await core.login("user@gruia.app", "password");
      const response = await fetch(`${base}/api/projects`, { headers: { cookie: `gruia_design_session=${session!.id}`, authorization: "Bearer untrusted", "x-forwarded-for": "198.51.100.66, 10.0.0.1" } });
      expect(response.status).toBe(200);
      const upstreamResponse = await received.promise;
      upstreamResponse.end("last");
      expect(await response.text()).toBe("first last");
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(response.headers.get("cache-control")).toContain("no-store");
    } finally {
      upstream.closeAllConnections();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
      server.closeAllConnections();
      await close(server, core);
    }
  });

  it("shutdown completes despite a hanging proxied request", async () => {
    const upstream = createServer(() => { /* never responds — simulates a stalled daemon */ });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address();
    if (!address || typeof address === "string") throw new Error("missing upstream listener");
    const core = new GatewayCore(config({ organizations: new Map([["org-a", { upstream: `http://127.0.0.1:${address.port}`, daemonApiToken: "daemon-a" }]]) }), new SqliteSessionStore(":memory:", secret), new Repository());
    const { server, base } = await listener(core);
    try {
      const session = await core.login("user@gruia.app", "password");
      const pending = fetch(`${base}/api/projects`, { headers: { cookie: `gruia_design_session=${session!.id}` } }).then(() => "answered", () => "aborted");
      await new Promise((resolve) => setTimeout(resolve, 50));
      await expect(shutdownGateway(server, 25)).resolves.toBeUndefined();
      expect(await pending).toBe("aborted");
    } finally {
      upstream.closeAllConnections();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
      await core.close();
    }
  });

  it.each(["before headers", "while streaming"])("keeps serving requests after a client disconnects %s", async (phase) => {
    const received = Promise.withResolvers<ServerResponse>();
    const upstreamClosed = Promise.withResolvers<void>();
    const upstream = createServer((_request, response) => {
      response.once("close", () => upstreamClosed.resolve());
      received.resolve(response);
      if (phase === "while streaming") {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write("data: started\n\n");
      }
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address();
    if (!address || typeof address === "string") throw new Error("missing upstream listener");
    const core = new GatewayCore(config({ upstreamTimeoutMs: 5_000, organizations: new Map([["org-a", { upstream: `http://127.0.0.1:${address.port}`, daemonApiToken: "daemon-a" }]]) }), new SqliteSessionStore(":memory:", secret), new Repository());
    const { server, base } = await listener(core);
    const downstreamClosed = Promise.withResolvers<void>();
    server.once("request", (_request, response) => response.once("close", () => downstreamClosed.resolve()));
    const session = await core.login("user@gruia.app", "password");
    const streamed = Promise.withResolvers<void>();
    const client = httpRequest(`${base}/api/runs/example/events`, { headers: { cookie: `gruia_design_session=${session!.id}` } }, (response) => {
      response.once("data", () => streamed.resolve());
      response.on("error", () => undefined);
    });
    client.on("error", () => undefined);
    client.end();
    try {
      const upstreamResponse = await received.promise;
      if (phase === "while streaming") await streamed.promise;
      client.destroy();
      await downstreamClosed.promise;
      // A delayed daemon response must not pipe into the now-destroyed browser socket.
      if (phase === "before headers") upstreamResponse.end("late response");
      await upstreamClosed.promise;
      const healthy = await fetch(`${base}/healthz`);
      expect(healthy.status).toBe(200);
      expect(await healthy.text()).toBe("ok\n");
      const authorized = await fetch(`${base}/auth/session`, { headers: { cookie: `gruia_design_session=${session!.id}` } });
      expect(authorized.status).toBe(200);
    } finally {
      client.destroy();
      upstream.closeAllConnections();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
      server.closeAllConnections();
      await close(server, core);
    }
  });
});

describe("Gruia gateway password-login security seams", () => {
  it("rejects legacy cookies and stops checking passwords after the email rate limit", async () => {
    const { core, repo } = setup(); const { server, base } = await listener(core);
    try {
      const session = await core.login("user@gruia.app", "password");
      const legacy = await fetch(`${base}/auth/session`, { headers: { cookie: `__Host-gruia_session=${session!.id}` } });
      expect(legacy.status).toBe(401);
      const current = await fetch(`${base}/auth/session`, { headers: { cookie: `gruia_design_session=${session!.id}` } });
      expect(current.status).toBe(200);
      for (let i = 0; i < 7; i++) await core.login("user@gruia.app", "incorrect");
      const queries = repo.loginEmails.length;
      expect(await core.login("user@gruia.app", "password")).toBeNull();
      expect(repo.loginEmails).toHaveLength(queries);
    } finally { await close(server, core); }
  });

  it("regression: GET /auth has a same-origin password form and GET /auth/login does not redirect externally", async () => {
    const { core } = setup(); const { server, base } = await listener(core);
    try { const auth = await fetch(`${base}/auth`, { redirect: "manual" }); const body = await auth.text(); expect(auth.headers.get("referrer-policy")).toBe("same-origin"); expect(auth.headers.get("content-security-policy")).toBe("frame-ancestors 'none'"); expect(auth.headers.get("x-frame-options")).toBe("DENY"); expect(body).toContain('type="password"'); expect(body).toContain('autocomplete="current-password"'); const login = await fetch(`${base}/auth/login`, { redirect: "manual" }); expect(login.status).toBe(200); expect(login.headers.get("location")).toBeNull(); expect(login.headers.get("content-security-policy")).toBe("frame-ancestors 'none'"); expect(await login.text()).not.toContain("authkit.app"); } finally { await close(server, core); }
  });
  it("logs in through the bounded same-origin form and rejects CSRF replay", async () => {
    const { core, repo } = setup(); const { server, base } = await listener(core);
    try {
      const page = await fetch(`${base}/auth`); const token = csrf(await page.text()); const csrfCookie = cookieValue(page, "gruia_design_login_csrf"); const form = new URLSearchParams({ csrf: token, email: "User@Gruia.App", password: "password" }).toString();
      const request = () => fetch(`${base}/auth/login`, { method: "POST", redirect: "manual", headers: { origin: "http://localhost", cookie: `gruia_design_login_csrf=${csrfCookie}`, "content-type": "application/x-www-form-urlencoded" }, body: form });
      const success = await request(); expect(success.status).toBe(303); expect(success.headers.get("location")).toBe("/"); expect(cookies(success).join(";")).toContain("gruia_design_session="); expect(repo.loginEmails).toEqual(["user@gruia.app"]); expect((await request()).status).toBe(403);
    } finally { await close(server, core); }
  });
  it("rejects cross-origin, invalid credentials and forged sessions without exposing a user", async () => {
    const { core } = setup(); const { server, base } = await listener(core);
    try {
      const page = await fetch(`${base}/auth`); const token = csrf(await page.text()); const csrfCookie = cookieValue(page, "gruia_design_login_csrf"); const denied = await fetch(`${base}/auth/login`, { method: "POST", redirect: "manual", headers: { origin: "https://evil.example", cookie: `gruia_design_login_csrf=${csrfCookie}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: token, email: "nobody@gruia.app", password: "wrong" }) }); expect(denied.status).toBe(403);
      const pageTwo = await fetch(`${base}/auth`); const tokenTwo = csrf(await pageTwo.text()); const cookieTwo = cookieValue(pageTwo, "gruia_design_login_csrf"); const invalid = await fetch(`${base}/auth/login`, { method: "POST", redirect: "manual", headers: { origin: "http://localhost", cookie: `gruia_design_login_csrf=${cookieTwo}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: tokenTwo, email: "nobody@gruia.app", password: "wrong" }) }); expect(invalid.status).toBe(401); expect(await invalid.text()).toContain("Credenciales inválidas o acceso no autorizado."); expect(await core.authorize("forged-session")).toBeNull();
    } finally { await close(server, core); }
  });
  it("audits malformed login forms and rejected logout CSRF", async () => {
    const { core, store } = setup(); const { server, base } = await listener(core);
    try {
      const page = await fetch(`${base}/auth`); const token = csrf(await page.text()); const csrfCookie = cookieValue(page, "gruia_design_login_csrf");
      const malformed = await fetch(`${base}/auth/login`, { method: "POST", redirect: "manual", headers: { origin: "http://localhost", cookie: `gruia_design_login_csrf=${csrfCookie}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: token, email: "user@gruia.app" }) });
      expect(malformed.status).toBe(401);
      const logoutDenied = await fetch(`${base}/auth/logout`, { method: "POST", redirect: "manual", headers: { origin: "http://localhost", cookie: "gruia_design_session=fake", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: "wrong" }) });
      expect(logoutDenied.status).toBe(403);
      const rows = store.readAuthAudit(10);
      expect(rows.map((row) => `${row.event}:${row.detail}`)).toEqual(["logout_failure:csrf_rejected", "login_failure:malformed_form"]);
    } finally { await close(server, core); }
  });
  it("writes auth audit rows for login success, failure kinds, and logout", async () => {
    const { core, store } = setup();
    try {
      expect(await core.login("user@gruia.app", "incorrect")).toBeNull();
      const login = await core.login("user@gruia.app", "password");
      expect(login).not.toBeNull();
      await core.logout(login!.id);
      const rows = store.readAuthAudit(10);
      expect(rows.map((row) => `${row.event}:${row.detail ?? "-"}`)).toEqual(["logout:-", "login_success:-", "login_failure:invalid_credentials"]);
      expect(rows[1].emailHash).toBe(store.principalHash("user@gruia.app"));
      expect(rows[1].email).toBeUndefined();
      expect(rows[1].userHash).toBe(store.principalHash(identity.userId));
      expect(rows[1].userId).toBeUndefined();
      expect(rows[1].organizationId).toBe("org-a");
      expect(rows[0].userHash).toBe(store.principalHash(identity.userId));
    } finally { await core.close(); }
  });
  it("audits rate-limited attempts without hitting the identity store", async () => {
    const { core, store, repo } = setup();
    try {
      for (let i = 0; i < 8; i++) await core.login("user@gruia.app", "incorrect");
      const queries = repo.loginEmails.length;
      expect(await core.login("user@gruia.app", "password")).toBeNull();
      expect(repo.loginEmails).toHaveLength(queries);
      const rows = store.readAuthAudit(20);
      expect(rows[0]).toMatchObject({ event: "login_failure", detail: "rate_limited", emailHash: store.principalHash("user@gruia.app") });
      expect(rows.filter((row) => row.detail === "invalid_credentials")).toHaveLength(8);
    } finally { await core.close(); }
  });
  it("rate-limits repeated attempts from one client IP across different emails", async () => {
    const { core, store } = setup();
    try {
      const context = { ip: "203.0.113.7" };
      for (let i = 0; i < 20; i++) await core.login(`user${i}@gruia.app`, "incorrect", context);
      expect(await core.login("fresh@gruia.app", "password", context)).toBeNull();
      expect(await core.login("fresh@gruia.app", "password", { ip: "198.51.100.9" })).not.toBeNull();
      const rows = store.readAuthAudit(30);
      expect(rows[0].event).toBe("login_success");
      expect(rows[1]).toMatchObject({ event: "login_failure", detail: "rate_limited", ip: "203.0.113.0" });
    } finally { await core.close(); }
  });
  it("admits internal memberships while client access is closed and revalidates active status", async () => {
    const internal = setup({ clientAccessOpen: false, audience: "internal" }); const login = await internal.core.login("user@gruia.app", "password"); expect(login).not.toBeNull(); expect(await internal.core.authorize(login!.id)).not.toBeNull(); internal.repo.active = false; expect(await internal.core.authorize(login!.id, { ip: "198.51.100.23", userAgent: "audit-test" })).toBeNull(); expect(internal.store.readAuthAudit(5)[0]).toMatchObject({ event: "session_revoked", userHash: internal.store.principalHash(identity.userId), organizationId: "org-a", detail: "identity_mismatch", ip: "198.51.100.0", userAgent: "audit-test" }); await internal.core.close();
    const client = setup({ clientAccessOpen: false, audience: "client" }); expect(await client.core.login("user@gruia.app", "password")).toBeNull(); await client.core.close();
  });
  it("revokes and audits a session whose organization stops being admitted", async () => {
    const internal = setup({ clientAccessOpen: false, audience: "internal" });
    const login = await internal.core.login("user@gruia.app", "password");
    expect(login).not.toBeNull();
    const closed = new GatewayCore(config({ organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a", audience: "client" }]]), clientAccessOpen: false }), internal.store, internal.repo);
    expect(await closed.authorize(login!.id, { ip: "203.0.113.40" })).toBeNull();
    expect(internal.store.readAuthAudit(5)[0]).toMatchObject({ event: "session_revoked", detail: "org_not_admitted", organizationId: "org-a", ip: "203.0.113.0" });
    await internal.core.close();
  });
  it("verifies canonical bcrypt and PBKDF2 password records asynchronously", async () => {
    expect(await verifyCanonicalPassword("password", passwordHash)).toBe(true); expect(await verifyCanonicalPassword("incorrect", passwordHash)).toBe(false); const pbkdf2Hash = "pbkdf2_sha256$1000$MTIzNDU2Nzg$FTjwoBVYl1UMxU9geIRwoYLQGocXCPkkesEhX_dg4L0"; expect(await verifyCanonicalPassword("correct horse", pbkdf2Hash)).toBe(true); expect(await verifyCanonicalPassword("correct battery", pbkdf2Hash)).toBe(false); expect(await verifyCanonicalPassword("correct horse", pbkdf2Hash.replace("$1000$", "$2000001$"))).toBe(false);
  });
  it("renders a same-origin logout form and invalidates the opaque session", async () => {
    const { core } = setup(); const { server, base } = await listener(core);
    try { const initial = await fetch(`${base}/auth`); const token = csrf(await initial.text()); const csrfCookie = cookieValue(initial, "gruia_design_login_csrf"); const login = await fetch(`${base}/auth/login`, { method: "POST", redirect: "manual", headers: { origin: "http://localhost", cookie: `gruia_design_login_csrf=${csrfCookie}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: token, email: "user@gruia.app", password: "password" }) }); const session = cookieValue(login, "gruia_design_session"); const signedIn = await fetch(`${base}/auth`, { headers: { cookie: `gruia_design_session=${session}` } }); const logoutCsrf = csrf(await signedIn.text()); const logout = await fetch(`${base}/auth/logout`, { method: "POST", redirect: "manual", headers: { origin: "http://localhost", cookie: `gruia_design_session=${session}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: logoutCsrf }) }); expect(logout.status).toBe(303); expect(logout.headers.get("location")).toBe("/auth"); expect(await core.authorize(session)).toBeNull(); } finally { await close(server, core); }
  });
  it("keeps origin, path, and fixed-token proxy boundaries", () => {
    expect(isExpectedOrigin("https://evil.example", config())).toBe(false); expect(isExpectedOrigin("http://localhost", config())).toBe(true); expect(isAuthorizedWebSocketHandshake({ connection: "Upgrade", upgrade: "websocket", origin: "https://evil.example" }, config())).toBe(false); expect(isAuthorizedWebSocketHandshake({ connection: "Upgrade", upgrade: "websocket", origin: "http://localhost" }, config())).toBe(true); expect(isSafeProxyPath("/%2e%2e/admin")).toBe(false); const headers = daemonUpstreamHeaders({ authorization: "Bearer attacker", cookie: "session=attacker", "x-identity": "attacker", "x-forwarded-for": "attacker", "x-user-id": "attacker", accept: "text/event-stream" }, new URL("http://127.0.0.1:3010"), "daemon-a"); expect(headers).toMatchObject({ authorization: "Bearer daemon-a", accept: "text/event-stream" }); expect(headers.cookie).toBeUndefined(); expect(headers["x-identity"]).toBeUndefined(); expect(headers["x-forwarded-for"]).toBeUndefined(); expect(headers["x-user-id"]).toBeUndefined();
  });
});
