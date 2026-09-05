import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { SessionStore, StoredSession, VerifiedProviderToken } from "./types.js";

type SessionRow = { id_hash: string; user_id: string; subject: string; organization_id: string; role: string; csrf_token: string; access_token: string; refresh_token: string | null; provider_session_id: string; provider_expires_at: number; expires_at: number };
const digest = (value: string): string => createHash("sha256").update(value).digest("base64url");

function encrypted(key: Buffer, value: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}
function decrypted(key: Buffer, value: string): string | null {
  try { const data = Buffer.from(value, "base64url"); if (data.length < 29) return null; const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"); } catch { return null; }
}
function equal(value: string, expected: string): boolean { const actual = Buffer.from(value); const target = Buffer.from(expected); return actual.length === target.length && timingSafeEqual(actual, target); }

export class SqliteSessionStore implements SessionStore {
  private readonly db: DatabaseSync;
  private readonly key: Buffer;
  constructor(path: string, secret: string) {
    this.key = Buffer.from(secret, "base64"); this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA trusted_schema=OFF; CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject TEXT NOT NULL, organization_id TEXT NOT NULL, role TEXT NOT NULL, csrf_token TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT, provider_session_id TEXT NOT NULL, provider_expires_at INTEGER NOT NULL, expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS pending_logins (state_hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL);");
  }
  createPendingLogin(state: string, verifier: string, expiresAt: number): void { this.db.prepare("DELETE FROM pending_logins WHERE expires_at < ?").run(Date.now()); this.db.prepare("INSERT INTO pending_logins(state_hash, verifier, expires_at) VALUES (?, ?, ?)").run(digest(state), encrypted(this.key, verifier), expiresAt); }
  consumePendingLogin(state: string, now: number): string | null {
    const hash = digest(state); this.db.exec("BEGIN IMMEDIATE");
    try { const row = this.db.prepare("SELECT verifier, expires_at FROM pending_logins WHERE state_hash = ?").get(hash) as { verifier: string; expires_at: number } | undefined; this.db.prepare("DELETE FROM pending_logins WHERE state_hash = ?").run(hash); this.db.exec("COMMIT"); return row && row.expires_at >= now ? decrypted(this.key, row.verifier) : null; } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  createSession(session: StoredSession): void { this.db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(digest(session.id), session.userId, session.subject, session.organizationId, session.role, encrypted(this.key, session.csrfToken), encrypted(this.key, session.accessToken), session.refreshToken ? encrypted(this.key, session.refreshToken) : null, encrypted(this.key, session.providerSessionId), session.providerExpiresAt, session.expiresAt); }
  readSession(id: string, now: number): StoredSession | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id_hash = ?").get(digest(id)) as SessionRow | undefined;
    if (!row || row.expires_at < now) { if (row) this.db.prepare("DELETE FROM sessions WHERE id_hash = ?").run(digest(id)); return null; }
    const accessToken = decrypted(this.key, row.access_token); const providerSessionId = decrypted(this.key, row.provider_session_id); const csrfToken = decrypted(this.key, row.csrf_token); const refreshToken = row.refresh_token ? decrypted(this.key, row.refresh_token) : undefined;
    if (!accessToken || !providerSessionId || !csrfToken || (row.refresh_token && !refreshToken)) { this.deleteSession(id); return null; }
    return Object.freeze({ id, userId: row.user_id, subject: row.subject, organizationId: row.organization_id, role: row.role, csrfToken, accessToken, refreshToken: refreshToken ?? undefined, providerSessionId, providerExpiresAt: row.provider_expires_at, expiresAt: row.expires_at });
  }
  verifyCsrf(id: string, csrf: string, now: number): boolean { const session = this.readSession(id, now); return !!session && equal(csrf, session.csrfToken); }
  updateProviderTokens(id: string, token: VerifiedProviderToken): void { this.db.prepare("UPDATE sessions SET access_token = ?, refresh_token = ?, provider_session_id = ?, provider_expires_at = ? WHERE id_hash = ?").run(encrypted(this.key, token.accessToken), token.refreshToken ? encrypted(this.key, token.refreshToken) : null, encrypted(this.key, token.sessionId), token.expiresAt, digest(id)); }
  deleteSession(id: string): void { this.db.prepare("DELETE FROM sessions WHERE id_hash = ?").run(digest(id)); }
  close(): void { this.db.close(); }
}
