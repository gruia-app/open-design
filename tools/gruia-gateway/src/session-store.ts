import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AuthAuditRecord, SessionStore, StoredSession } from "./types.js";

type SessionRow = { id_hash: string; user_id: string; organization_id: string; role: string; csrf_token: string; expires_at: number };
const digest = (value: string): string => createHash("sha256").update(value).digest("base64url");
const AUTH_AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const AUTH_AUDIT_MAX_ROWS = 100_000;

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
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA trusted_schema=OFF; CREATE TABLE IF NOT EXISTS password_sessions (id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT NOT NULL, role TEXT NOT NULL, csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS login_csrf (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS auth_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, at INTEGER NOT NULL, email TEXT, user_id TEXT, organization_id TEXT, ip TEXT, user_agent TEXT, detail TEXT);");
  }
  createLoginCsrf(token: string, expiresAt: number): void { this.db.prepare("DELETE FROM login_csrf WHERE expires_at < ?").run(Date.now()); this.db.prepare("INSERT INTO login_csrf(token_hash, expires_at) VALUES (?, ?)").run(digest(token), expiresAt); this.db.prepare("DELETE FROM login_csrf WHERE rowid NOT IN (SELECT rowid FROM login_csrf ORDER BY expires_at DESC LIMIT 10000)").run(); }
  consumeLoginCsrf(cookieToken: string, formToken: string, now: number): boolean {
    if (!equal(cookieToken, formToken)) return false;
    const hash = digest(cookieToken); this.db.exec("BEGIN IMMEDIATE");
    try { const row = this.db.prepare("SELECT expires_at FROM login_csrf WHERE token_hash = ?").get(hash) as { expires_at: number } | undefined; this.db.prepare("DELETE FROM login_csrf WHERE token_hash = ?").run(hash); this.db.exec("COMMIT"); return !!row && row.expires_at >= now; } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  createSession(session: StoredSession): void { this.db.prepare("DELETE FROM password_sessions WHERE expires_at < ?").run(Date.now()); this.db.prepare("INSERT INTO password_sessions VALUES (?, ?, ?, ?, ?, ?)").run(digest(session.id), session.userId, session.organizationId, session.role, encrypted(this.key, session.csrfToken), session.expiresAt); }
  readSession(id: string, now: number): StoredSession | null {
    const row = this.db.prepare("SELECT * FROM password_sessions WHERE id_hash = ?").get(digest(id)) as SessionRow | undefined;
    if (!row || row.expires_at < now) { if (row) { this.db.prepare("DELETE FROM password_sessions WHERE id_hash = ?").run(digest(id)); this.recordAuthEvent({ event: "session_expired", at: now, userId: row.user_id, organizationId: row.organization_id }); } return null; }
    const csrfToken = decrypted(this.key, row.csrf_token);
    if (!csrfToken) { this.deleteSession(id); return null; }
    return Object.freeze({ id, userId: row.user_id, organizationId: row.organization_id, role: row.role, csrfToken, expiresAt: row.expires_at });
  }
  verifyCsrf(id: string, csrf: string, now: number): boolean { const session = this.readSession(id, now); return !!session && equal(csrf, session.csrfToken); }
  deleteSession(id: string): void { this.db.prepare("DELETE FROM password_sessions WHERE id_hash = ?").run(digest(id)); }
  recordAuthEvent(record: AuthAuditRecord): void {
    const cutoff = record.at - AUTH_AUDIT_RETENTION_MS;
    this.db.prepare("DELETE FROM auth_audit WHERE at < ?").run(cutoff);
    this.db.prepare("INSERT INTO auth_audit(event, at, email, user_id, organization_id, ip, user_agent, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      record.event, record.at, record.email ?? null, record.userId ?? null, record.organizationId ?? null, record.ip ?? null, record.userAgent ?? null, record.detail ?? null,
    );
    this.db.prepare("DELETE FROM auth_audit WHERE id NOT IN (SELECT id FROM auth_audit ORDER BY id DESC LIMIT ?)").run(AUTH_AUDIT_MAX_ROWS);
  }
  readAuthAudit(limit: number): AuthAuditRecord[] {
    const rows = this.db.prepare("SELECT event, at, email, user_id, organization_id, ip, user_agent, detail FROM auth_audit ORDER BY id DESC LIMIT ?").all(limit) as Array<{
      event: AuthAuditRecord["event"]; at: number; email: string | null; user_id: string | null; organization_id: string | null; ip: string | null; user_agent: string | null; detail: string | null;
    }>;
    return rows.map((row) => Object.freeze({
      event: row.event, at: row.at,
      ...(row.email ? { email: row.email } : {}),
      ...(row.user_id ? { userId: row.user_id } : {}),
      ...(row.organization_id ? { organizationId: row.organization_id } : {}),
      ...(row.ip ? { ip: row.ip } : {}),
      ...(row.user_agent ? { userAgent: row.user_agent } : {}),
      ...(row.detail ? { detail: row.detail } : {}),
    }));
  }
  close(): void { this.db.close(); }
}
