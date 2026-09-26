// G-UX change 3: reactive personality — typing cue, generation progress,
// result/like/editor reactions and the inactivity nudge schedule.

export const NUDGE_DELAYS_MS = [9000, 14000, 14000] as const;
export const MAX_NUDGES = NUDGE_DELAYS_MS.length;
export const TYPING_CUE_DELAY_MS = 700;

export interface NudgeGate {
  hasResults: boolean;
  inputFocused: boolean;
  generating: boolean;
}

export function nudgeDelayAt(fired: number): number | null {
  const delay = NUDGE_DELAYS_MS[fired];
  return delay === undefined ? null : delay;
}

export function nudgeAllowed(fired: number, gate: NudgeGate): boolean {
  if (gate.hasResults || gate.inputFocused || gate.generating) return false;
  return nudgeDelayAt(fired) !== null;
}

export interface Cue {
  seq: number;
  emotion?: string;
  line?: string;
}
