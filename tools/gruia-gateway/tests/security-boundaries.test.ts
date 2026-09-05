import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GatewayCore, daemonUpstreamHeaders, isAuthorizedWebSocketHandshake, isExpectedOrigin, isSafeProxyPath } from "../src/gateway.js";
import { SqliteSessionStore } from "../src/session-store.js";
import type { AuthorizationRepository, GatewayConfig, GatewayIdentity, VerifiedProviderToken, WorkOSClient } from "../src/types.js";

const secret = randomBytes(32).toString("base64");
const token: VerifiedProviderToken = Object.freeze({ subject: "workos-user-1", sessionId: "provider-session", expiresAt: 9_999_999_999_999, accessToken: "access", refreshToken: "refresh" });
const identity: GatewayIdentity = Object.freeze({ userId: "local-user-1", subject: token.subject, organizationId: "org-a", role: "member" });
function config(): GatewayConfig { return Object.freeze({ bindHost: "127.0.0.1", port: 3006, publicOrigin: "https://design.gruia.app", cookieName: "__Host-gruia_session", databasePath: ":memory:", sessionSecret: secret, postgresUrl: "postgres://unused", workos: Object.freeze({ clientId: "client", clientSecret: "secret", issuer: "https://api.workos.com/", redirectUri: "https://design.gruia.app/auth/callback" }), organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a" }]]), sessionTtlSeconds: 3600, requestBodyLimitBytes: 1024, upstreamTimeoutMs: 1000, clientAccessOpen: false, testMode: false }); }
class Repository implements AuthorizationRepository {
  calls: readonly string[][] = [];
  constructor(private rows: readonly GatewayIdentity[] = [identity]) {}
  async resolve(_subject: string, allowed: readonly string[]): Promise<readonly GatewayIdentity[]> { this.calls = [...this.calls, [...allowed]]; return this.rows.filter((row) => allowed.includes(row.organizationId)); }
  async close(): Promise<void> {}
}
class Provider implements WorkOSClient {
  revoked: string[] = [];
  async exchangeCode(): Promise<VerifiedProviderToken | null> { return token; }
  async refresh(): Promise<VerifiedProviderToken | null> { return token; }
  async revoke(id: string): Promise<void> { this.revoked.push(id); }
}
function setup(now = 1_000_000): { core: GatewayCore; store: SqliteSessionStore; repo: Repository; provider: Provider; advance: (value: number) => void } {
  let clock = now; const store = new SqliteSessionStore(":memory:", secret); const repo = new Repository(); const provider = new Provider();
  return { core: new GatewayCore(Object.freeze({ ...config(), clientAccessOpen: true }), store, repo, provider, () => clock), store, repo, provider, advance: (value) => { clock = value; } };
}

describe("Gruia gateway security seams", () => {
  it("shares a single-use provider refresh across concurrent browser requests", async () => {
    const store = new SqliteSessionStore(":memory:", secret);
    let refreshCalls = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const provider: WorkOSClient = {
      exchangeCode: async () => ({ ...token, expiresAt: 1_000_100 }),
      refresh: async () => { refreshCalls++; await gate; return { ...token, refreshToken: "rotated" }; },
      revoke: async () => undefined,
    };
    const core = new GatewayCore({ ...config(), clientAccessOpen: true }, store, new Repository(), provider, () => 1_000_000);
    const state = new URL(core.startLogin()).searchParams.get("state")!;
    const session = await core.finishLogin(state, "code", state);
    const requests = Array.from({ length: 8 }, () => core.authorize(session!.id));
    expect(refreshCalls).toBe(1);
    release!();
    const results = await Promise.all(requests);
    expect(results.every(Boolean)).toBe(true);
    expect(store.readSession(session!.id, 1_000_000)?.refreshToken).toBe("rotated");
    await core.close();
  });

  it("admits internal members while customer access is closed", async () => {
    const base = config();
    const internal = { ...base, organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "a", audience: "internal" as const }]]) };
    const core = new GatewayCore(internal, new SqliteSessionStore(":memory:", secret), new Repository(), new Provider());
    const state = new URL(core.startLogin()).searchParams.get("state")!;
    expect(await core.finishLogin(state, "code", state)).not.toBeNull();
  });

  it("rejects a callback from a different browser and keeps clients closed", async () => {
    const { core } = setup(); const state = new URL(core.startLogin()).searchParams.get("state")!;
    expect(await core.finishLogin(state, "code", undefined)).toBeNull();
    expect(await core.finishLogin(state, "code", "another-browser")).toBeNull();
    expect(await core.finishLogin(state, "code", state)).not.toBeNull();
    const closed = new GatewayCore(config(), new SqliteSessionStore(":memory:", secret), new Repository(), new Provider());
    const clientState = new URL(closed.startLogin()).searchParams.get("state")!;
    expect(await closed.finishLogin(clientState, "code", clientState)).toBeNull();
  });

  it("denies unauthenticated access and never invents an identity", async () => {
    const { core } = setup();
    expect(await core.authorize(undefined)).toBeNull();
    expect(await core.authorize("forged-session")).toBeNull();
  });

  it("uses only the canonical mapped organization and rejects ambiguous membership", async () => {
    const { core, repo } = setup(); const login = new URL(core.startLogin());
    const session = await core.finishLogin(login.searchParams.get("state")!, "code", login.searchParams.get("state")!);
    expect(session).not.toBeNull();
    expect(await core.authorize(session!.id)).toMatchObject({ identity: { organizationId: "org-a" } });
    expect(repo.calls.at(-1)).toEqual(["org-a"]);
    const ambiguousRepo = new Repository([identity, { ...identity, organizationId: "org-b" }]);
    const ambiguousConfig = Object.freeze({ ...config(), clientAccessOpen: true, organizations: new Map([["org-a", { upstream: "http://127.0.0.1:3010", daemonApiToken: "daemon-a" }], ["org-b", { upstream: "http://127.0.0.1:3011", daemonApiToken: "daemon-b" }]]) });
    const ambiguous = new GatewayCore(ambiguousConfig, new SqliteSessionStore(":memory:", secret), ambiguousRepo, new Provider(), () => 1_000_000);
    const ambiguousLogin = new URL(ambiguous.startLogin());
    expect(await ambiguous.finishLogin(ambiguousLogin.searchParams.get("state")!, "code", ambiguousLogin.searchParams.get("state")!)).toBeNull();
  });

  it("rejects expired, replayed and tampered opaque state/session values", async () => {
    const { core, store, advance } = setup(); const login = new URL(core.startLogin()); const state = login.searchParams.get("state")!;
    advance(1_700_001); expect(await core.finishLogin(state, "code", state)).toBeNull();
    const fresh = new URL(core.startLogin()); const session = await core.finishLogin(fresh.searchParams.get("state")!, "code", fresh.searchParams.get("state")!);
    expect(session).not.toBeNull();
    expect(await core.finishLogin(fresh.searchParams.get("state")!, "code", fresh.searchParams.get("state")!)).toBeNull();
    expect(store.readSession(`${session!.id}x`, 1_700_001)).toBeNull();
  });

  it("clears local state and requests provider revocation on logout", async () => {
    const { core, provider } = setup(); const login = new URL(core.startLogin()); const session = await core.finishLogin(login.searchParams.get("state")!, "code", login.searchParams.get("state")!);
    await core.logout(session!.id);
    expect(await core.authorize(session!.id)).toBeNull();
    expect(provider.revoked).toEqual(["provider-session"]);
  });

  it("rejects hostile mutation/WebSocket origins and strips caller credentials before daemon injection", () => {
    expect(isExpectedOrigin("https://evil.example", config())).toBe(false);
    expect(isExpectedOrigin(undefined, config())).toBe(false);
    expect(isExpectedOrigin("https://design.gruia.app", config())).toBe(true);
    expect(isAuthorizedWebSocketHandshake({ connection: "Upgrade", upgrade: "websocket", origin: "https://evil.example" }, config())).toBe(false);
    expect(isAuthorizedWebSocketHandshake({ connection: "keep-alive", upgrade: "websocket", origin: "https://design.gruia.app" }, config())).toBe(false);
    expect(isAuthorizedWebSocketHandshake({ connection: "Upgrade", upgrade: "websocket", origin: "https://design.gruia.app" }, config())).toBe(true);
    expect(isSafeProxyPath("/../admin")).toBe(false);
    expect(isSafeProxyPath("/%2e%2e/admin")).toBe(false);
    const headers = daemonUpstreamHeaders({ authorization: "Bearer attacker", cookie: "session=attacker", "x-identity": "attacker", "x-forwarded-for": "attacker", "x-user-id": "attacker", accept: "text/event-stream" }, new URL("http://127.0.0.1:3010"), "daemon-a");
    expect(headers).toMatchObject({ authorization: "Bearer daemon-a", accept: "text/event-stream" });
    expect(headers.cookie).toBeUndefined(); expect(headers["x-identity"]).toBeUndefined(); expect(headers["x-forwarded-for"]).toBeUndefined(); expect(headers["x-user-id"]).toBeUndefined();
  });
});
