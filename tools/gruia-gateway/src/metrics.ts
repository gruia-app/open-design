import type { AuthEventCount } from "./types.js";

export interface GatewayMetricsInput {
  readonly uptimeSeconds: number;
  readonly activeSessions: number;
  readonly authEvents: readonly AuthEventCount[];
}

function labelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Prometheus text exposition for the gateway. Every series is a gauge on
 * purpose: auth event counts are read back out of the retained auth_audit
 * window, so they shrink when retention prunes — reporting them as counters
 * would promise monotonicity the store does not keep.
 *
 * Cardinality is bounded: `event` comes from the fixed AuthAuditEvent union
 * and `detail` from the fixed failure reasons written in gateway.ts, so a
 * scrape can never mint attacker-controlled label values. No IPs, emails,
 * user ids, or organization ids ever appear in the output.
 */
export function renderGatewayMetrics(input: GatewayMetricsInput): string {
  const lines: string[] = [
    "# HELP gruia_gateway_uptime_seconds Seconds since this gateway process started.",
    "# TYPE gruia_gateway_uptime_seconds gauge",
    `gruia_gateway_uptime_seconds ${Math.max(0, Math.floor(input.uptimeSeconds))}`,
    "# HELP gruia_gateway_sessions_active Sessions whose expiry has not passed.",
    "# TYPE gruia_gateway_sessions_active gauge",
    `gruia_gateway_sessions_active ${input.activeSessions}`,
    "# HELP gruia_gateway_auth_events Auth audit rows retained, by event and failure detail.",
    "# TYPE gruia_gateway_auth_events gauge",
  ];
  const sorted = [...input.authEvents].sort((a, b) => a.event.localeCompare(b.event) || a.detail.localeCompare(b.detail));
  for (const row of sorted) {
    lines.push(`gruia_gateway_auth_events{event="${labelValue(row.event)}",detail="${labelValue(row.detail)}"} ${row.count}`);
  }
  return lines.join("\n") + "\n";
}
