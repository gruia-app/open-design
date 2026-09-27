import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { DatabaseSync } from "node:sqlite";
import type { AuthAuditContext, AuthAuditRecord, GatewayStoreMetrics, SessionStore, StoredSession } from "./types.js";

type SessionRow = { id_hash: string; user_id: string; organization_id: string; role: string; csrf_token: string; expires_at: number };
const digest = (value: string): string => createHash("sha256").update(value).digest("base64url");
const AUTH_AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const AUTH_AUDIT_MAX_ROWS = 100_000;
const SESSION_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

function encrypted(key: Buffer, value: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}
function decrypted(key: Buffer, value: string): string | null {
  try { const data = Buffer.from(value, "base64url"); if (data.length < 29) return null; const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"); } catch { return null; }
}
function equal(value: string, expected: string): boolean { const actual = Buffer.from(value); const target = Buffer.from(expected); return actual.length === target.length && timingSafeEqual(actual, target); }

/** Audit rows keep a network prefix, not the host: IPv4 /24, IPv6 /64. */
export function truncateClientIp(ip: string | undefined): string | undefined {
  const mapped = ip?.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip;
  const version = mapped ? isIP(mapped) : 0;
  if (version === 4) { const [a, b, c] = mapped!.split("."); return `${a}.${b}.${c}.0`; }
  if (version === 6) {
    const [head = "", tail = ""] = mapped!.split("::");
    const heads = head ? head.split(":") : [];
    const tails = tail ? tail.split(":") : [];
    const groups = [...heads, ...Array<string>(8 - heads.length - tails.length).fill("0"), ...tails];
    return `${groups.slice(0, 4).join(":")}::`;
  }
  return undefined;
}

export class SqliteSessionStore implements SessionStore {
  private readonly db: DatabaseSync;
  private readonly key: Buffer;
  private readonly sweepTimer: NodeJS.Timeout | undefined;
  constructor(path: string, secret: string, sweepIntervalMs = SESSION_SWEEP_INTERVAL_MS) {
    this.key = Buffer.from(secret, "base64"); this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA trusted_schema=OFF; CREATE TABLE IF NOT EXISTS password_sessions (id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT NOT NULL, role TEXT NOT NULL, csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS login_csrf (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS auth_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, at INTEGER NOT NULL, email TEXT, user_id TEXT, organization_id TEXT, ip TEXT, user_agent TEXT, detail TEXT, user_hash TEXT, email_hash TEXT); CREATE INDEX IF NOT EXISTS auth_audit_at ON auth_audit(at);");
    // Additive migration for databases created before pseudonymized audit:
    // add the hash columns, never rewrite existing rows. Cleartext values in
    // legacy rows stay in place but are masked on read by readAuthAudit.
    const auditColumns = new Set((this.db.prepare("PRAGMA table_info(auth_audit)").all() as Array<{ name: string }>).map((column) => column.name));
    for (const column of ["user_hash", "email_hash"]) if (!auditColumns.has(column)) this.db.exec(`ALTER TABLE auth_audit ADD COLUMN ${column} TEXT`);
    // Sweep-on-write only covers orgs that keep logging in; a quiet org would
    // accumulate expired rows forever. An unref'd interval reaps them without
    // holding the process open. Pass 0 to disable (tests, embedded callers).
    if (sweepIntervalMs > 0) {
      this.sweepTimer = setInterval(() => this.sweepExpired(), sweepIntervalMs);
      this.sweepTimer.unref();
    }
  }
  sweepExpired(now = Date.now()): void {
    this.db.prepare("DELETE FROM password_sessions WHERE expires_at < ?").run(now);
    this.db.prepare("DELETE FROM login_csrf WHERE expires_at < ?").run(now);
    this.db.prepare("DELETE FROM auth_audit WHERE at < ?").run(now - AUTH_AUDIT_RETENTION_MS);
  }
  createLoginCsrf(token: string, expiresAt: number): void { this.db.prepare("DELETE FROM login_csrf WHERE expires_at < ?").run(Date.now()); this.db.prepare("INSERT INTO login_csrf(token_hash, expires_at) VALUES (?, ?)").run(digest(token), expiresAt); this.db.prepare("DELETE FROM login_csrf WHERE rowid NOT IN (SELECT rowid FROM login_csrf ORDER BY expires_at DESC LIMIT 10000)").run(); }
  consumeLoginCsrf(cookieToken: string, formToken: string, now: number): boolean {
    if (!equal(cookieToken, formToken)) return false;
    const hash = digest(cookieToken); this.db.exec("BEGIN IMMEDIATE");
    try { const row = this.db.prepare("SELECT expires_at FROM login_csrf WHERE token_hash = ?").get(hash) as { expires_at: number } | undefined; this.db.prepare("DELETE FROM login_csrf WHERE token_hash = ?").run(hash); this.db.exec("COMMIT"); return !!row && row.expires_at >= now; } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  createSession(session: StoredSession): void { this.db.prepare("DELETE FROM password_sessions WHERE expires_at < ?").run(Date.now()); this.db.prepare("INSERT INTO password_sessions VALUES (?, ?, ?, ?, ?, ?)").run(digest(session.id), session.userId, session.organizationId, session.role, encrypted(this.key, session.csrfToken), session.expiresAt); }
  readSession(id: string, now: number, context?: AuthAuditContext): StoredSession | null {
    const row = this.db.prepare("SELECT * FROM password_sessions WHERE id_hash = ?").get(digest(id)) as SessionRow | undefined;
    if (!row || row.expires_at < now) { if (row) { this.db.prepare("DELETE FROM password_sessions WHERE id_hash = ?").run(digest(id)); this.recordAuthEvent({ event: "session_expired", at: now, userId: row.user_id, organizationId: row.organization_id, ...(context ?? {}) }); } return null; }
    const csrfToken = decrypted(this.key, row.csrf_token);
    if (!csrfToken) { this.deleteSession(id); this.recordAuthEvent({ event: "session_revoked", at: now, userId: row.user_id, organizationId: row.organization_id, detail: "csrf_undecryptable", ...(context ?? {}) }); return null; }
    return Object.freeze({ id, userId: row.user_id, organizationId: row.organization_id, role: row.role, csrfToken, expiresAt: row.expires_at });
  }
  verifyCsrf(id: string, csrf: string, now: number, context?: AuthAuditContext): boolean { const session = this.readSession(id, now, context); return !!session && equal(csrf, session.csrfToken); }
  deleteSession(id: string): void { this.db.prepare("DELETE FROM password_sessions WHERE id_hash = ?").run(digest(id)); }
  /** Keyed pseudonym for audit rows: correlatable inside this deployment, opaque to anyone holding only the log. */
  principalHash(value: string): string { return createHmac("sha256", this.key).update(`audit:${value.trim().toLowerCase()}`).digest("base64url").slice(0, 16); }
  recordAuthEvent(record: AuthAuditRecord): void {
    const cutoff = record.at - AUTH_AUDIT_RETENTION_MS;
    this.db.prepare("DELETE FROM auth_audit WHERE at < ?").run(cutoff);
    this.db.prepare("INSERT INTO auth_audit(event, at, email, user_id, organization_id, ip, user_agent, detail, user_hash, email_hash) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)").run(
      record.event, record.at, record.organizationId ?? null, truncateClientIp(record.ip) ?? null, record.userAgent ?? null, record.detail ?? null,
      record.userId ? this.principalHash(record.userId) : null, record.email ? this.principalHash(record.email) : null,
    );
    this.db.prepare("DELETE FROM auth_audit WHERE id NOT IN (SELECT id FROM auth_audit ORDER BY id DESC LIMIT ?)").run(AUTH_AUDIT_MAX_ROWS);
  }
  readAuthAudit(limit: number): AuthAuditRecord[] {
    const rows = this.db.prepare("SELECT event, at, email, user_id, organization_id, ip, user_agent, detail, user_hash, email_hash FROM auth_audit ORDER BY id DESC LIMIT ?").all(limit) as Array<{
      event: AuthAuditRecord["event"]; at: number; email: string | null; user_id: string | null; organization_id: string | null; ip: string | null; user_agent: string | null; detail: string | null; user_hash: string | null; email_hash: string | null;
    }>;
    return rows.map((row) => Object.freeze({
      event: row.event, at: row.at,
      // Never hand cleartext principals back out — pre-migration rows are
      // pseudonymized on read instead of being rewritten.
      ...((row.user_hash ?? row.user_id) ? { userHash: row.user_hash ?? this.principalHash(row.user_id!) } : {}),
      ...((row.email_hash ?? row.email) ? { emailHash: row.email_hash ?? this.principalHash(row.email!) } : {}),
      ...(row.organization_id ? { organizationId: row.organization_id } : {}),
      ...(row.ip ? { ip: truncateClientIp(row.ip) ?? row.ip } : {}),
      ...(row.user_agent ? { userAgent: row.user_agent } : {}),
      ...(row.detail ? { detail: row.detail } : {}),
    }));
  }
  readMetrics(now: number): GatewayStoreMetrics {
    const rows = this.db.prepare("SELECT event, COALESCE(detail, '') AS detail, COUNT(*) AS n FROM auth_audit GROUP BY event, detail").all() as Array<{ event: string; detail: string; n: number }>;
    const activeSessions = (this.db.prepare("SELECT COUNT(*) AS n FROM password_sessions WHERE expires_at >= ?").get(now) as { n: number }).n;
    return Object.freeze({ authEvents: Object.freeze(rows.map((row) => Object.freeze({ event: row.event, detail: row.detail, count: row.n }))), activeSessions });
  }
  close(): void { clearInterval(this.sweepTimer); this.db.close(); }
}
