import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { GatewayCore, createGatewayServer } from "../src/gateway.js";
import { renderGatewayMetrics } from "../src/metrics.js";
import { SqliteSessionStore } from "../src/session-store.js";
import type { AuthorizationRepository, GatewayConfig, GatewayIdentity, GatewayLoginUser } from "../src/types.js";

const secret = randomBytes(32).toString("base64");
const identity: GatewayIdentity = Object.freeze({ userId: "canonical-user-1", organizationId: "org-a", role: "member" });

function config(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return Object.freeze({ bindHost: "127.0.0.1", port: 3006, publicOrigin: "http://localhost", cookieName: "gruia_design_session", databasePath: ":memory:", sessionSecret: secret, postgresUrl: "postgres://unused", organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a" }]]), sessionTtlSeconds: 14_400, requestBodyLimitBytes: 1024, upstreamTimeoutMs: 1000, clientAccessOpen: true, testMode: true, ...overrides });
}
class Repository implements AuthorizationRepository {
  loginUser: GatewayLoginUser | null = Object.freeze({ userId: identity.userId, hashedPassword: "$2b$04$CljJoexSaEZAZtLXmEnLru5sR7vF8PSc.CY8HSdb86wij5Rt8wa9K", identities: [identity] });
  async findLoginUser(email: string, allowed: readonly string[]): Promise<GatewayLoginUser | null> { return email === "user@gruia.app" && allowed.includes(identity.organizationId) ? this.loginUser : null; }
  async resolveUser(userId: string, allowed: readonly string[]): Promise<readonly GatewayIdentity[]> { return userId === identity.userId && allowed.includes(identity.organizationId) ? [identity] : []; }
  async close(): Promise<void> {}
}
function setup(metricsToken?: string): { core: GatewayCore; store: SqliteSessionStore } {
  const store = new SqliteSessionStore(":memory:", secret);
  return { core: new GatewayCore(config({ ...(metricsToken === undefined ? {} : { metricsToken }) }), store, new Repository()), store };
}
async function listener(core: GatewayCore): Promise<{ server: Server; base: string }> {
  const server = createGatewayServer(core);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test listener");
  return { server, base: `http://127.0.0.1:${address.port}` };
}
async function close(server: Server, core: GatewayCore): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await core.close();
}

describe("gateway /metrics endpoint", () => {
  it("answers 404 when no metricsToken is configured, even with credentials", async () => {
    const { core } = setup();
    const { server, base } = await listener(core);
    try {
      const anonymous = await fetch(`${base}/metrics`);
      expect(anonymous.status).toBe(404);
      const guessed = await fetch(`${base}/metrics`, { headers: { authorization: "Bearer anything" } });
      expect(guessed.status).toBe(404);
    } finally {
      await close(server, core);
    }
  });

  it("requires the configured bearer token and advertises the challenge", async () => {
    const { core } = setup("scrape-token");
    const { server, base } = await listener(core);
    try {
      const anonymous = await fetch(`${base}/metrics`);
      expect(anonymous.status).toBe(401);
      expect(anonymous.headers.get("www-authenticate")).toBe('Bearer realm="metrics"');
      const wrong = await fetch(`${base}/metrics`, { headers: { authorization: "Bearer wrong-token" } });
      expect(wrong.status).toBe(401);
      const basic = await fetch(`${base}/metrics`, { headers: { authorization: "Basic c2NyYXBl" } });
      expect(basic.status).toBe(401);
    } finally {
      await close(server, core);
    }
  });

  it("serves Prometheus text with auth events and active sessions to the token holder", async () => {
    const { core } = setup("scrape-token");
    const { server, base } = await listener(core);
    try {
      expect(await core.login("user@gruia.app", "incorrect")).toBeNull();
      const session = await core.login("user@gruia.app", "password");
      expect(session).not.toBeNull();
      const response = await fetch(`${base}/metrics`, { headers: { authorization: "Bearer scrape-token" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(response.headers.get("cache-control")).toContain("no-store");
      const body = await response.text();
      expect(body).toContain("# TYPE gruia_gateway_uptime_seconds gauge");
      expect(body).toMatch(/gruia_gateway_uptime_seconds \d+\n/);
      expect(body).toContain("gruia_gateway_sessions_active 1\n");
      expect(body).toContain('gruia_gateway_auth_events{event="login_success",detail=""} 1\n');
      expect(body).toContain('gruia_gateway_auth_events{event="login_failure",detail="invalid_credentials"} 1\n');
      expect(body).not.toContain("user@gruia.app");
      expect(body).not.toContain(identity.userId);
      expect(body).not.toContain("org-a");
    } finally {
      await close(server, core);
    }
  });

  it("rejects non-GET methods before checking credentials", async () => {
    const { core } = setup("scrape-token");
    const { server, base } = await listener(core);
    try {
      const posted = await fetch(`${base}/metrics`, { method: "POST", headers: { authorization: "Bearer scrape-token" } });
      expect(posted.status).toBe(405);
    } finally {
      await close(server, core);
    }
  });
});

describe("SqliteSessionStore.readMetrics", () => {
  it("groups retained audit rows by event and detail and counts only unexpired sessions", async () => {
    const { core, store } = setup();
    try {
      const now = Date.now();
      store.createSession(Object.freeze({ id: "live", userId: "u1", organizationId: "org-a", role: "member", csrfToken: "csrf-live", expiresAt: now + 60_000 }));
      store.createSession(Object.freeze({ id: "stale", userId: "u1", organizationId: "org-a", role: "member", csrfToken: "csrf-stale", expiresAt: now - 1 }));
      await core.login("user@gruia.app", "incorrect");
      await core.login("nobody@gruia.app", "incorrect");
      const metrics = store.readMetrics(now);
      expect(metrics.activeSessions).toBe(1);
      const failures = metrics.authEvents.filter((row) => row.event === "login_failure" && row.detail === "invalid_credentials");
      expect(failures).toHaveLength(1);
      expect(failures[0].count).toBe(2);
    } finally {
      await core.close();
    }
  });
});

describe("renderGatewayMetrics", () => {
  it("escapes label values and sorts series deterministically", () => {
    const text = renderGatewayMetrics({
      uptimeSeconds: 12.9,
      activeSessions: 0,
      authEvents: [
        { event: "logout", detail: "", count: 1 },
        { event: "login_failure", detail: 'quote"slash\\line\n', count: 3 },
      ],
    });
    expect(text).toContain("gruia_gateway_uptime_seconds 12\n");
    const failure = text.indexOf('event="login_failure"');
    const logout = text.indexOf('event="logout"');
    expect(failure).toBeGreaterThan(-1);
    expect(logout).toBeGreaterThan(failure);
    expect(text).toContain('detail="quote\\"slash\\\\line\\n"');
  });
});
