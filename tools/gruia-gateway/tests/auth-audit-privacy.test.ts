import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import { GatewayCore, createGatewayServer } from "../src/gateway.js";
import { SqliteSessionStore, truncateClientIp } from "../src/session-store.js";
import type { AuthorizationRepository, GatewayConfig, GatewayIdentity, GatewayLoginUser } from "../src/types.js";

const secret = randomBytes(32).toString("base64");
// Fixed fixture generated and verified with Python bcrypt ("password").
const passwordHash = "$2b$04$CljJoexSaEZAZtLXmEnLru5sR7vF8PSc.CY8HSdb86wij5Rt8wa9K";
const identity: GatewayIdentity = Object.freeze({ userId: "canonical-user-1", organizationId: "org-a", role: "member" });

function config(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return Object.freeze({ bindHost: "127.0.0.1", port: 3006, publicOrigin: "http://localhost", cookieName: "gruia_design_session", databasePath: ":memory:", sessionSecret: secret, postgresUrl: "postgres://unused", organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a" }]]), sessionTtlSeconds: 14_400, requestBodyLimitBytes: 1024, upstreamTimeoutMs: 1000, clientAccessOpen: true, studioOperatorUserIds: [identity.userId], testMode: true, ...overrides });
}
class Repository implements AuthorizationRepository {
  loginUser: GatewayLoginUser | null = Object.freeze({ userId: identity.userId, hashedPassword: passwordHash, identities: [identity] });
  async findLoginUser(_email: string, allowed: readonly string[]): Promise<GatewayLoginUser | null> { return allowed.includes(identity.organizationId) ? this.loginUser : null; }
  async resolveUser(userId: string, allowed: readonly string[]): Promise<readonly GatewayIdentity[]> { return userId === identity.userId && allowed.includes(identity.organizationId) ? [identity] : []; }
  async close(): Promise<void> {}
}
async function listener(core: GatewayCore): Promise<{ server: Server; base: string }> {
  const server = createGatewayServer(core);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test listener");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

describe("auth_audit privacy", () => {
  it("stores a truncated ip and pseudonymized principals on login audit rows", async () => {
    const store = new SqliteSessionStore(":memory:", secret);
    const core = new GatewayCore(config(), store, new Repository());
    const { server, base } = await listener(core);
    try {
      const page = await fetch(`${base}/auth`);
      const token = /name="csrf" value="([^"]+)"/.exec(await page.text())?.[1];
      const csrfCookie = page.headers.getSetCookie().find((item) => item.startsWith("gruia_design_login_csrf="))!.split(";", 1)[0].slice("gruia_design_login_csrf=".length);
      const form = new URLSearchParams({ csrf: token!, email: "user@gruia.app", password: "password" });
      const login = await fetch(`${base}/auth/login`, { method: "POST", redirect: "manual", headers: { origin: "http://localhost", cookie: `gruia_design_login_csrf=${decodeURIComponent(csrfCookie)}`, "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "203.0.113.77, 10.0.0.1" }, body: form });
      expect(login.status).toBe(303);
      const rows = store.readAuthAudit(5);
      expect(rows[0]!.event).toBe("login_success");
      expect(rows[0]!.ip).toBe("203.0.113.0");
      expect(rows[0]!.userHash).toBe(store.principalHash(identity.userId));
      expect(rows[0]!.emailHash).toBe(store.principalHash("user@gruia.app"));
      expect(rows[0]!.organizationId).toBe("org-a");
      expect(rows[0]!.userId).toBeUndefined();
      expect(rows[0]!.email).toBeUndefined();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await core.close();
    }
  });

  it("rate limiting still keys on the full client ip while audit stores the prefix", async () => {
    const store = new SqliteSessionStore(":memory:", secret);
    const core = new GatewayCore(config(), store, new Repository());
    try {
      const context = { ip: "203.0.113.0" }; // audit sees the truncated prefix
      for (let i = 0; i < 20; i++) await core.login(`user${i}@gruia.app`, "incorrect", context, "203.0.113.77");
      // Same /24, different host: a fresh limiter budget.
      const login = await core.login("user@gruia.app", "password", context, "203.0.113.200");
      expect(login).not.toBeNull();
      const rows = store.readAuthAudit(30);
      expect(rows[0]!.event).toBe("login_success");
      expect(rows[0]!.ip).toBe("203.0.113.0");
    } finally { await core.close(); }
  });

  it("migrates a legacy audit table additively and masks old rows on read", async () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-migrate-"));
    const path = join(dir, "sessions.db");
    // Pre-migration schema: no user_hash/email_hash columns, one cleartext row.
    const legacy = new DatabaseSync(path);
    legacy.exec("CREATE TABLE auth_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, at INTEGER NOT NULL, email TEXT, user_id TEXT, organization_id TEXT, ip TEXT, user_agent TEXT, detail TEXT)");
    legacy.prepare("INSERT INTO auth_audit(event, at, email, user_id, organization_id, ip) VALUES (?, ?, ?, ?, ?, ?)").run("login_success", 1000, "legacy@gruia.app", "u9", "org-a", "198.51.100.200");
    legacy.close();
    const store = new SqliteSessionStore(path, secret);
    try {
      const rows = store.readAuthAudit(5);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.emailHash).toBe(store.principalHash("legacy@gruia.app"));
      expect(rows[0]!.userHash).toBe(store.principalHash("u9"));
      expect(rows[0]!.ip).toBe("198.51.100.0");
      expect(rows[0]!.email).toBeUndefined();
      expect(rows[0]!.userId).toBeUndefined();
      store.recordAuthEvent({ event: "login_success", at: 2000, email: "new@gruia.app", userId: "u2", ip: "203.0.113.9" });
      const after = store.readAuthAudit(5);
      expect(after).toHaveLength(2);
      expect(after[0]!.emailHash).toBe(store.principalHash("new@gruia.app"));
      expect(after[0]!.ip).toBe("203.0.113.0");
    } finally { store.close(); }
    // The migration must not rewrite existing rows: cleartext stays at rest.
    const check = new DatabaseSync(path, { readOnly: true });
    try {
      const raw = check.prepare("SELECT email, user_id, user_hash, email_hash FROM auth_audit ORDER BY id").all() as Array<{ email: string | null; user_id: string | null; user_hash: string | null; email_hash: string | null }>;
      expect(raw[0]!.email).toBe("legacy@gruia.app");
      expect(raw[0]!.user_hash).toBeNull();
      expect(raw[1]!.email).toBeNull();
      expect(raw[1]!.email_hash).not.toBeNull();
    } finally { check.close(); }
  });

  it("truncateClientIp maps IPv4 to /24 and IPv6 to /64, dropping non-IP input", () => {
    expect(truncateClientIp("203.0.113.77")).toBe("203.0.113.0");
    expect(truncateClientIp("10.0.0.1")).toBe("10.0.0.0");
    expect(truncateClientIp("2001:db8:aaaa:bbbb:cccc:dddd:eeee:ffff")).toBe("2001:db8:aaaa:bbbb::");
    expect(truncateClientIp("2001:db8::1")).toBe("2001:db8:0:0::");
    expect(truncateClientIp("::ffff:203.0.113.77")).toBe("203.0.113.0");
    expect(truncateClientIp("::1")).toBe("0:0:0:0::");
    expect(truncateClientIp("not-an-ip")).toBeUndefined();
    expect(truncateClientIp(undefined)).toBeUndefined();
  });
});
