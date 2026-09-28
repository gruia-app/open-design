// Local usage metric (r150): a localStorage map of manifestId → export count.
// "Used outside design" = at least one export (sheet / GIF / APNG / WebP /
// pack zip) left the app. No backend — the counter lives in the browser.

import type {
  CharacterExportFormat,
  CharacterExportRequest,
} from '@open-design/contracts/analytics';

const KEY = 'od-personajes.exports.v1';
export const EXPORTS_EVENT = 'personajes:exports';

function readAll(): Record<string, number> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function recordExport(manifestId: string, format?: CharacterExportFormat): void {
  try {
    const map = readAll();
    map[manifestId] = (map[manifestId] ?? 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(EXPORTS_EVENT));
  } catch {
    // localStorage unavailable — the metric is best-effort.
  }
  if (format) void reportExportToDaemon(format);
}

// Daemon-side KPI event (R1102): the server stamps `account_id` and
// `occurred_at` itself; the browser only reports which format left the app.
// Best-effort — without analytics consent the daemon no-ops, and a network
// failure must never undo a finished download.
function reportExportToDaemon(format: CharacterExportFormat): Promise<void> {
  const body: CharacterExportRequest = { format };
  return fetch('/api/analytics/character-export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(() => undefined)
    .catch(() => undefined);
}

export function exportCount(manifestId: string): number {
  return readAll()[manifestId] ?? 0;
}
