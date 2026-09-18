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

function rowCount(path: string): number {
  const db = new DatabaseSync(path);
  try {
    return (db.prepare("SELECT COUNT(*) AS n FROM password_sessions").get() as { n: number }).n;
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
});
