import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { GatewayCore, createGatewayServer, daemonUpstreamHeaders, isAuthorizedWebSocketHandshake, isExpectedOrigin, isSafeProxyPath, verifyCanonicalPassword } from "../src/gateway.js";
import { SqliteSessionStore } from "../src/session-store.js";
import type { AuthorizationRepository, GatewayConfig, GatewayIdentity, GatewayLoginUser } from "../src/types.js";

const secret = randomBytes(32).toString("base64");
// Fixed fixture generated and verified with Python bcrypt.
const passwordHash = "$2b$04$CljJoexSaEZAZtLXmEnLru5sR7vF8PSc.CY8HSdb86wij5Rt8wa9K";
const identity: GatewayIdentity = Object.freeze({ userId: "canonical-user-1", organizationId: "org-a", role: "member" });

function config(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return Object.freeze({ bindHost: "127.0.0.1", port: 3006, publicOrigin: "http://localhost", cookieName: "gruia_design_session", databasePath: ":memory:", sessionSecret: secret, postgresUrl: "postgres://unused", organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a" }]]), sessionTtlSeconds: 14_400, requestBodyLimitBytes: 1024, upstreamTimeoutMs: 1000, clientAccessOpen: true, testMode: true, ...overrides });
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
    try { const auth = await fetch(`${base}/auth`, { redirect: "manual" }); const body = await auth.text(); expect(auth.headers.get("referrer-policy")).toBe("same-origin"); expect(body).toContain('type="password"'); expect(body).toContain('autocomplete="current-password"'); const login = await fetch(`${base}/auth/login`, { redirect: "manual" }); expect(login.status).toBe(200); expect(login.headers.get("location")).toBeNull(); expect(await login.text()).not.toContain("authkit.app"); } finally { await close(server, core); }
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
  it("admits internal memberships while client access is closed and revalidates active status", async () => {
    const internal = setup({ clientAccessOpen: false, audience: "internal" }); const login = await internal.core.login("user@gruia.app", "password"); expect(login).not.toBeNull(); expect(await internal.core.authorize(login!.id)).not.toBeNull(); internal.repo.active = false; expect(await internal.core.authorize(login!.id)).toBeNull(); await internal.core.close();
    const client = setup({ clientAccessOpen: false, audience: "client" }); expect(await client.core.login("user@gruia.app", "password")).toBeNull(); await client.core.close();
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
