import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import { describe, expect, it } from "vitest";
import { GatewayCore, createGatewayServer, truncateClientIp } from "../src/gateway.js";
import { SqliteSessionStore } from "../src/session-store.js";
import type { AuthorizationRepository, GatewayConfig, GatewayIdentity, GatewayLoginUser } from "../src/types.js";

const secret = randomBytes(32).toString("base64");
// Fixed fixture generated and verified with Python bcrypt ("password").
const passwordHash = "$2b$04$CljJoexSaEZAZtLXmEnLru5sR7vF8PSc.CY8HSdb86wij5Rt8wa9K";
const operator: GatewayIdentity = Object.freeze({ userId: "operator-1", organizationId: "org-a", role: "member" });
const member: GatewayIdentity = Object.freeze({ userId: "member-2", organizationId: "org-a", role: "member" });

function config(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return Object.freeze({ bindHost: "127.0.0.1", port: 3006, publicOrigin: "http://localhost", cookieName: "gruia_design_session", databasePath: ":memory:", sessionSecret: secret, postgresUrl: "postgres://unused", organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a" }]]), sessionTtlSeconds: 14_400, requestBodyLimitBytes: 1024, upstreamTimeoutMs: 1000, clientAccessOpen: true, studioOperatorUserIds: [operator.userId], testMode: true, ...overrides });
}

class Repository implements AuthorizationRepository {
  constructor(private readonly user: GatewayLoginUser) {}
  async findLoginUser(_email: string, allowed: readonly string[]): Promise<GatewayLoginUser | null> { return this.user.identities.some((identity) => allowed.includes(identity.organizationId)) ? this.user : null; }
  async resolveUser(userId: string, allowed: readonly string[]): Promise<readonly GatewayIdentity[]> { const identity = this.user.identities.find((entry) => entry.userId === userId); return identity && allowed.includes(identity.organizationId) ? [identity] : []; }
  async close(): Promise<void> {}
}

function setup(identity: GatewayIdentity, operatorUserIds: readonly string[], upstreamPort = 3010): { core: GatewayCore; store: SqliteSessionStore } {
  const organizations = new Map([["org-a", { upstream: `http://127.0.0.1:${upstreamPort}`, daemonApiToken: "daemon-a" }]]);
  const store = new SqliteSessionStore(":memory:", secret);
  const repo = new Repository(Object.freeze({ userId: identity.userId, hashedPassword: passwordHash, identities: [identity] }));
  return { core: new GatewayCore(config({ organizations, studioOperatorUserIds: operatorUserIds }), store, repo), store };
}

async function listener(core: GatewayCore): Promise<{ server: Server; base: string }> {
  const server = createGatewayServer(core);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test listener");
  return { server, base: `http://127.0.0.1:${address.port}` };
}
async function close(server: Server, core: GatewayCore): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await core.close();
}
async function upstreamServer(handler: (request: import("node:http").IncomingMessage) => void): Promise<{ server: Server; port: number; hits: import("node:http").IncomingMessage[] }> {
  const hits: import("node:http").IncomingMessage[] = [];
  const server = createServer((request, response) => { hits.push(request); handler(request); response.writeHead(200); response.end("ok"); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing upstream listener");
  return { server, port: address.port, hits };
}

describe("studioOperatorUserIds studio allowlist", () => {
  it("proxies the studio for a configured operator user", async () => {
    const upstream = await upstreamServer((request) => { expect(request.headers.authorization).toBe("Bearer daemon-a"); });
    const { core } = setup(operator, [operator.userId], upstream.port);
    const { server, base } = await listener(core);
    try {
      const session = await core.login("operator@gruia.app", "password");
      const response = await fetch(`${base}/api/projects`, { headers: { cookie: `gruia_design_session=${session!.id}` } });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ok");
      expect(upstream.hits).toHaveLength(1);
    } finally {
      upstream.server.closeAllConnections();
      await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
      server.closeAllConnections();
      await close(server, core);
    }
  });

  it("denies the studio proxy to a member outside the allowlist, keeps the session, and audits it", async () => {
    const upstream = await upstreamServer(() => {});
    const { core, store } = setup(member, [operator.userId], upstream.port);
    const { server, base } = await listener(core);
    try {
      const session = await core.login("member@gruia.app", "password");
      expect(session).not.toBeNull();
      const response = await fetch(`${base}/api/projects`, { headers: { cookie: `gruia_design_session=${session!.id}` } });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: "studio_operator_only" });
      expect(upstream.hits).toHaveLength(0);
      // Membership, session and identity are untouched: the member can still
      // read its own session metadata and log out cleanly.
      const own = await fetch(`${base}/auth/session`, { headers: { cookie: `gruia_design_session=${session!.id}` } });
      expect(own.status).toBe(200);
      expect((await own.json() as { userId: string }).userId).toBe(member.userId);
      const rows = store.readAuthAudit(5);
      expect(rows[0]).toMatchObject({ event: "studio_operator_denied", userId: member.userId, organizationId: "org-a" });
      expect(rows[1]).toMatchObject({ event: "login_success", userId: member.userId });
    } finally {
      upstream.server.closeAllConnections();
      await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
      server.closeAllConnections();
      await close(server, core);
    }
  });

  it("fails closed when the allowlist is empty, even for a valid member", async () => {
    const upstream = await upstreamServer(() => {});
    const { core } = setup(operator, [], upstream.port);
    const { server, base } = await listener(core);
    try {
      const session = await core.login("operator@gruia.app", "password");
      const response = await fetch(`${base}/api/projects`, { headers: { cookie: `gruia_design_session=${session!.id}` } });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: "studio_operator_only" });
      expect(upstream.hits).toHaveLength(0);
    } finally {
      upstream.server.closeAllConnections();
      await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
      server.closeAllConnections();
      await close(server, core);
    }
  });

  it("denies websocket upgrades for users outside the allowlist", async () => {
    const { core } = setup(member, [operator.userId]);
    const { server, base } = await listener(core);
    try {
      const session = await core.login("member@gruia.app", "password");
      const port = Number(new URL(base).port);
      const reply = await new Promise<string>((resolve, reject) => {
        const socket = connect(port, "127.0.0.1", () => {
          socket.write(`GET /api/runs/example/events HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: upgrade\r\nOrigin: http://localhost\r\nCookie: gruia_design_session=${session!.id}\r\n\r\n`);
        });
        let data = "";
        socket.on("data", (chunk) => { data += chunk.toString(); socket.destroy(); resolve(data); });
        socket.on("error", reject);
        setTimeout(() => resolve(data), 2_000).unref();
      });
      expect(reply).toContain("403 Forbidden");
    } finally {
      server.closeAllConnections();
      await close(server, core);
    }
  });
});

describe("auth audit ip truncation", () => {
  it("stores the network prefix, not the host ip, on login audit rows", async () => {
    const { core, store } = setup(operator, [operator.userId]);
    const { server, base } = await listener(core);
    try {
      const page = await fetch(`${base}/auth`);
      const token = /name="csrf" value="([^"]+)"/.exec(await page.text())?.[1];
      const csrfCookie = page.headers.getSetCookie().find((item) => item.startsWith("gruia_design_login_csrf="))!.split(";", 1)[0].slice("gruia_design_login_csrf=".length);
      const form = new URLSearchParams({ csrf: token!, email: "operator@gruia.app", password: "password" });
      const login = await fetch(`${base}/auth/login`, { method: "POST", redirect: "manual", headers: { origin: "http://localhost", cookie: `gruia_design_login_csrf=${decodeURIComponent(csrfCookie)}`, "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "203.0.113.77, 10.0.0.1" }, body: form });
      expect(login.status).toBe(303);
      const rows = store.readAuthAudit(5);
      expect(rows[0]).toMatchObject({ event: "login_success", userId: operator.userId, ip: "203.0.113.0" });
    } finally {
      server.closeAllConnections();
      await close(server, core);
    }
  });

  it("truncates IPv4 to /24 and IPv6 to /64, dropping non-IP input", () => {
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
