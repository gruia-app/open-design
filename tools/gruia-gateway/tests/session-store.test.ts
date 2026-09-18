import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteSessionStore } from "../src/session-store.js";
import type { StoredSession } from "../src/types.js";

const SECRET = Buffer.alloc(32, 7).toString("base64");

let dir = "";
let store: SqliteSessionStore | undefined;

function open(): { path: string; store: SqliteSessionStore } {
  dir = mkdtempSync(join(tmpdir(), "gruia-sessions-"));
  const path = join(dir, "sessions.db");
  store = new SqliteSessionStore(path, SECRET);
  return { path, store };
}

function session(id: string, expiresAt: number): StoredSession {
  return Object.freeze({ id, userId: "u1", organizationId: "org1", role: "ADMIN", csrfToken: `csrf-${id}`, expiresAt });
}

function rowCount(path: string, table = "password_sessions"): number {
  const db = new DatabaseSync(path);
  try {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  } finally {
    db.close();
  }
}

afterEach(() => {
  store?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("SqliteSessionStore", () => {
  it("round-trips a session and verifies its CSRF token", () => {
    const s = open().store;
    const now = Date.now();
    s.createSession(session("s1", now + 60_000));
    const read = s.readSession("s1", now);
    expect(read?.userId).toBe("u1");
    expect(read?.csrfToken).toBe("csrf-s1");
    expect(s.verifyCsrf("s1", "csrf-s1", now)).toBe(true);
    expect(s.verifyCsrf("s1", "wrong", now)).toBe(false);
  });

  it("never returns expired sessions and removes the row on read", () => {
    const { path } = open();
    const now = Date.now();
    store!.createSession(session("old", now - 1));
    expect(store!.readSession("old", now)).toBeNull();
    expect(rowCount(path)).toBe(0);
  });

  it("audits session_expired exactly once when an expired row is read", () => {
    const s = open().store;
    const now = Date.now();
    s.createSession(session("stale", now - 1));
    expect(s.readSession("stale", now, { ip: "198.51.100.9", userAgent: "audit-test" })).toBeNull();
    expect(s.readSession("stale", now)).toBeNull();
    const rows = s.readAuthAudit(10);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ event: "session_expired", at: now, userId: "u1", organizationId: "org1", ip: "198.51.100.9", userAgent: "audit-test" });
    expect(s.readSession("missing", now)).toBeNull();
    expect(s.readAuthAudit(10)).toHaveLength(1);
  });

  it("sweeps expired sessions when a new one is created", () => {
    const { path } = open();
    const now = Date.now();
    // Expired rows left behind by earlier daemon runs are never read again
    // (ids are unguessable), so they would accumulate forever without the
    // sweep-on-write — same pattern login_csrf already applies.
    store!.createSession(session("stale-1", now - 60_000));
    store!.createSession(session("stale-2", now - 30_000));
    store!.createSession(session("fresh", now + 60_000));
    expect(rowCount(path)).toBe(1);
    expect(store!.readSession("fresh", now)?.id).toBe("fresh");
  });

  it("does not store the CSRF token or session id in plaintext", () => {
    const { path } = open();
    const now = Date.now();
    store!.createSession(session("plain-check", now + 60_000));
    const db = new DatabaseSync(path);
    try {
      const row = db.prepare("SELECT * FROM password_sessions").get() as { id_hash: string; csrf_token: string };
      expect(row.id_hash).not.toBe("plain-check");
      expect(row.csrf_token).not.toContain("csrf-plain-check");
    } finally {
      db.close();
    }
  });

  it("consumes login CSRF tokens exactly once", () => {
    const s = open().store;
    const now = Date.now();
    s.createLoginCsrf("tok-1", now + 60_000);
    expect(s.consumeLoginCsrf("tok-1", "tok-1", now)).toBe(true);
    expect(s.consumeLoginCsrf("tok-1", "tok-1", now)).toBe(false);
    expect(s.consumeLoginCsrf("tok-1", "different", now)).toBe(false);
  });

  it("round-trips auth audit records newest-first and omits null fields", () => {
    const s = open().store;
    const now = Date.now();
    s.recordAuthEvent({ event: "login_failure", at: now - 1000, email: "user@gruia.app", detail: "invalid_credentials", ip: "10.0.0.1", userAgent: "agent" });
    s.recordAuthEvent({ event: "login_success", at: now, email: "user@gruia.app", userId: "u1", organizationId: "org1", ip: "10.0.0.1" });
    const rows = s.readAuthAudit(10);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ event: "login_success", at: now, email: "user@gruia.app", userId: "u1", organizationId: "org1", ip: "10.0.0.1" });
    expect(rows[1].detail).toBe("invalid_credentials");
    expect(rows[1].userAgent).toBe("agent");
    expect(rows[1].userId).toBeUndefined();
    expect(s.readAuthAudit(1)).toHaveLength(1);
  });

  it("sweepExpired reaps expired sessions, csrf tokens and stale audit rows", () => {
    const { path, store: s } = open();
    const now = Date.now();
    // Insert live rows first, expired rows last — the per-write sweeps run
    // before each insert, so only trailing expired rows survive until the
    // periodic sweep removes them.
    s.createSession(session("live", now + 60_000));
    s.createSession(session("old", now - 1));
    s.createLoginCsrf("live-csrf", now + 60_000);
    s.createLoginCsrf("old-csrf", now - 1);
    s.recordAuthEvent({ event: "login_success", at: now, userId: "u1" });
    s.recordAuthEvent({ event: "login_success", at: now - 91 * 24 * 60 * 60 * 1000, userId: "u1" });
    expect(rowCount(path)).toBe(2);
    expect(rowCount(path, "login_csrf")).toBe(2);
    expect(s.readAuthAudit(10)).toHaveLength(2);

    s.sweepExpired(now);

    expect(rowCount(path)).toBe(1);
    expect(rowCount(path, "login_csrf")).toBe(1);
    expect(s.readAuthAudit(10)).toHaveLength(1);
    expect(s.readSession("live", now)?.userId).toBe("u1");
  });

  it("runs the periodic sweep on an unref'd interval", async () => {
    const { path } = open();
    store!.close();
    const s = new SqliteSessionStore(path, SECRET, 25);
    store = s;
    const now = Date.now();
    s.createSession(session("old", now - 1));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(rowCount(path)).toBe(0);
  });

  it("sweeps audit rows older than the retention window on write", () => {
    const s = open().store;
    const now = Date.now();
    const expired = now - 91 * 24 * 60 * 60 * 1000;
    s.recordAuthEvent({ event: "login_success", at: expired, email: "old@gruia.app" });
    s.recordAuthEvent({ event: "login_success", at: expired + 1, email: "old@gruia.app" });
    expect(s.readAuthAudit(10)).toHaveLength(2);
    s.recordAuthEvent({ event: "logout", at: now, userId: "u1" });
    const rows = s.readAuthAudit(10);
    expect(rows).toHaveLength(1);
    expect(rows[0].event).toBe("logout");
  });
});
