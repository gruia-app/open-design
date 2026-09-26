import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_NUDGES,
  NUDGE_DELAYS_MS,
  nudgeAllowed,
  nudgeDelayAt,
  type NudgeGate,
} from '../src/features/characters/gallery/reactive';

const IDLE: NudgeGate = { hasResults: false, inputFocused: false, generating: false };

describe('reactive nudges', () => {
  it('schedules 9s, +14s, +14s and caps at three', () => {
    expect(NUDGE_DELAYS_MS).toEqual([9000, 14000, 14000]);
    expect(MAX_NUDGES).toBe(3);
    expect(nudgeDelayAt(0)).toBe(9000);
    expect(nudgeDelayAt(1)).toBe(14000);
    expect(nudgeDelayAt(2)).toBe(14000);
    expect(nudgeDelayAt(3)).toBeNull();
  });

  it('allows a nudge only while idle and under the cap', () => {
    expect(nudgeAllowed(0, IDLE)).toBe(true);
    expect(nudgeAllowed(2, IDLE)).toBe(true);
    expect(nudgeAllowed(3, IDLE)).toBe(false);
    expect(nudgeAllowed(0, { ...IDLE, hasResults: true })).toBe(false);
    expect(nudgeAllowed(0, { ...IDLE, inputFocused: true })).toBe(false);
    expect(nudgeAllowed(0, { ...IDLE, generating: true })).toBe(false);
  });

  describe('with fake timers', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('fires at most three nudges on the 9s / +14s / +14s schedule', () => {
      vi.useFakeTimers();
      const fired: number[] = [];
      let count = 0;
      const schedule = () => {
        const delay = nudgeDelayAt(count);
        if (delay === null) return;
        setTimeout(() => {
          if (nudgeAllowed(count, IDLE)) {
            count += 1;
            fired.push(count);
          }
          schedule();
        }, delay);
      };
      schedule();
      vi.advanceTimersByTime(9000);
      expect(fired).toEqual([1]);
      vi.advanceTimersByTime(14000);
      expect(fired).toEqual([1, 2]);
      vi.advanceTimersByTime(14000);
      expect(fired).toEqual([1, 2, 3]);
      vi.advanceTimersByTime(120000);
      expect(fired).toEqual([1, 2, 3]);
    });

    it('skips the fire while the gate is closed and resumes after it opens', () => {
      vi.useFakeTimers();
      const fired: number[] = [];
      let count = 0;
      let focused = true;
      const schedule = () => {
        const delay = nudgeDelayAt(count);
        if (delay === null) return;
        setTimeout(() => {
          if (nudgeAllowed(count, { ...IDLE, inputFocused: focused })) {
            count += 1;
            fired.push(count);
          }
          schedule();
        }, delay);
      };
      schedule();
      vi.advanceTimersByTime(30000);
      expect(fired).toEqual([]); // input focused — nothing fires
      focused = false;
      vi.advanceTimersByTime(9000);
      expect(fired).toEqual([1]);
    });
  });
});
