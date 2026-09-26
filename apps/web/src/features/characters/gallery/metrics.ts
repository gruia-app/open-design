// Local usage metric (r150): a localStorage map of manifestId → export count.
// "Used outside design" = at least one export (sheet / GIF / APNG / WebP /
// pack zip) left the app. No backend — the counter lives in the browser.

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

export function recordExport(manifestId: string): void {
  try {
    const map = readAll();
    map[manifestId] = (map[manifestId] ?? 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(EXPORTS_EVENT));
  } catch {
    // localStorage unavailable — the metric is best-effort.
  }
}

export function exportCount(manifestId: string): number {
  return readAll()[manifestId] ?? 0;
}
