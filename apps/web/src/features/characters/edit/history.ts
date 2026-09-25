// Snapshot-based undo/redo. Emotion edits are small (a dozen frame entries
// and a few scalars), so keeping whole immutable snapshots is cheap and makes
// every operation uniformly revertible without command inversion.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

const HISTORY_LIMIT = 60;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Push a new present. Identical snapshots (same reference or deep-equal
 *  JSON) are dropped so no-op edits do not pollute the undo stack. */
export function record<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) return history;
  if (JSON.stringify(next) === JSON.stringify(history.present)) return history;
  const past = [...history.past, history.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}
