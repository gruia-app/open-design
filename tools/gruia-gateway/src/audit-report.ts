import { DatabaseSync } from "node:sqlite";

export interface AuditReportOptions {
  days?: number;
  organizationId?: string;
}

interface OrgSummary {
  events: Record<string, number>;
  distinctUsers: number;
  lastActivityAt: number | null;
}

export interface AuditReport {
  generatedAt: string;
  since: string;
  days: number;
  totals: Record<string, number>;
  organizations: Record<string, OrgSummary>;
  topIps: Array<{ ip: string; events: number }>;
}

// Operator-only usage report over the auth_audit table: per-organization auth
// activity for the fleet's usage-analytics stream. Read-only open — never
// touches sessions or secrets, so it can run against a mounted DB copy.
export function buildAuditReport(databasePath: string, options: AuditReportOptions = {}): AuditReport {
  const days = options.days ?? 30;
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Invalid days");
  const since = Date.now() - days * 86_400_000;
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const scope = options.organizationId === undefined ? "" : " AND organization_id = ?";
    const args = options.organizationId === undefined ? [since] : [since, options.organizationId];
    const totals: Record<string, number> = {};
    const organizations: Record<string, OrgSummary> = {};
    const rows = db.prepare(`SELECT event, organization_id, MAX(at) AS last_at, COUNT(*) AS n FROM auth_audit WHERE at >= ?${scope} GROUP BY event, organization_id`).all(...args) as Array<{ event: string; organization_id: string | null; last_at: number; n: number }>;
    for (const row of rows) {
      totals[row.event] = (totals[row.event] ?? 0) + row.n;
      const org = row.organization_id ?? "(none)";
      const summary = (organizations[org] ??= { events: {}, distinctUsers: 0, lastActivityAt: null });
      summary.events[row.event] = (summary.events[row.event] ?? 0) + row.n;
      if (row.last_at > (summary.lastActivityAt ?? 0)) summary.lastActivityAt = row.last_at;
    }
    for (const org of Object.keys(organizations)) {
      const counted = db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM auth_audit WHERE at >= ? AND organization_id IS ?`).get(since, org === "(none)" ? null : org) as { n: number };
      organizations[org]!.distinctUsers = counted.n;
    }
    const topIps = (db.prepare(`SELECT ip, COUNT(*) AS n FROM auth_audit WHERE at >= ? AND ip IS NOT NULL${scope} GROUP BY ip ORDER BY n DESC LIMIT 10`).all(...args) as Array<{ ip: string; n: number }>).map((row) => ({ ip: row.ip, events: row.n }));
    return { generatedAt: new Date().toISOString(), since: new Date(since).toISOString(), days, totals, organizations, topIps };
  } finally {
    db.close();
  }
}
