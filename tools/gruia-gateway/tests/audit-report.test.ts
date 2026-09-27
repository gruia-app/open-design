import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAuditReport } from "../src/audit-report.js";
import { SqliteSessionStore } from "../src/session-store.js";

function seeded(): string {
  const dir = mkdtempSync(join(tmpdir(), "audit-"));
  const store = new SqliteSessionStore(join(dir, "sessions.db"), randomBytes(32).toString("base64"));
  const now = Date.now();
  store.recordAuthEvent({ event: "login_success", at: now - 1000, email: "a@x.io", userId: "u1", organizationId: "org-a", ip: "10.0.0.1", userAgent: "ua" });
  store.recordAuthEvent({ event: "login_success", at: now - 2000, email: "b@x.io", userId: "u2", organizationId: "org-a", ip: "10.0.0.2", userAgent: "ua" });
  store.recordAuthEvent({ event: "login_failure", at: now - 3000, email: "c@x.io", ip: "10.0.0.9", detail: "bad_credentials" });
  store.recordAuthEvent({ event: "session_revoked", at: now - 4000, userId: "u1", organizationId: "org-a", ip: "10.0.0.9", detail: "org_not_admitted" });
  store.recordAuthEvent({ event: "login_success", at: now - 40 * 86_400_000, email: "old@x.io", userId: "u9", organizationId: "org-b", ip: "10.9.9.9" });
  store.close();
  return join(dir, "sessions.db");
}

describe("gateway audit report", () => {
  it("aggregates per-organization auth activity within the window", () => {
    const report = buildAuditReport(seeded(), { days: 30 });
    expect(report.totals.login_success).toBe(2);
    expect(report.totals.login_failure).toBe(1);
    expect(report.totals.session_revoked).toBe(1);
    const org = report.organizations["org-a"];
    expect(org?.distinctUsers).toBe(2);
    expect(org?.events.login_success).toBe(2);
    expect(org?.events.session_revoked).toBe(1);
    expect(org?.lastActivityAt).toBeTypeOf("number");
    expect(report.organizations["org-b"]).toBeUndefined();
    expect(report.organizations["(none)"]?.events.login_failure).toBe(1);
    expect(report.topIps[0]?.ip).toBe("10.0.0.0");
    expect(report.topIps[0]?.events).toBe(4);
  });

  it("scopes to a single organization when asked", () => {
    const report = buildAuditReport(seeded(), { days: 30, organizationId: "org-a" });
    expect(report.totals.login_success).toBe(2);
    expect(report.totals.login_failure).toBeUndefined();
    expect(Object.keys(report.organizations)).toEqual(["org-a"]);
  });

  it("rejects an invalid window", () => {
    expect(() => buildAuditReport(seeded(), { days: 0 })).toThrow(/Invalid days/);
    expect(() => buildAuditReport(seeded(), { days: 400 })).toThrow(/Invalid days/);
  });
});
