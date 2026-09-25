// Playback timing for the character player. Pure functions — no DOM, no
// rAF — so the loop/pingpong/once contract is unit-testable and the React
// layer only has to ask "which frame at elapsed T?".

import type { CharacterFrame, PlaybackMode } from '../pack/types';

export interface FrameTimeline {
  /** Effective duration of each frame in ms (per-frame `ms` wins over fps). */
  durations: number[];
  /** Start offset of each frame inside one forward pass. */
  starts: number[];
  /** Duration of one forward pass through all frames. */
  total: number;
}

export const MIN_FPS = 4;
export const MAX_FPS = 24;

export function clampFps(fps: number): number {
  if (!Number.isFinite(fps)) return MIN_FPS;
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)));
}

export function frameDurationMs(frame: Pick<CharacterFrame, 'ms'>, fps: number): number {
  return frame.ms != null && frame.ms > 0 ? frame.ms : 1000 / fps;
}

export function buildTimeline(frames: ReadonlyArray<Pick<CharacterFrame, 'ms'>>, fps: number): FrameTimeline {
  const durations = frames.map((frame) => frameDurationMs(frame, fps));
  const starts: number[] = [];
  let total = 0;
  for (const duration of durations) {
    starts.push(total);
    total += duration;
  }
  return { durations, starts, total };
}

/** Ping-pong cycle as frame indexes: 0,1,…,n-1,n-2,…,1 — the endpoints are
 *  played once per cycle, matching Aseprite's ping-pong. */
export function pingpongCycleIndexes(count: number): number[] {
  if (count <= 1) return [0];
  const cycle: number[] = [];
  for (let i = 0; i < count; i += 1) cycle.push(i);
  for (let i = count - 2; i >= 1; i -= 1) cycle.push(i);
  return cycle;
}

function indexAtOffset(timeline: FrameTimeline, offset: number): number {
  // Linear scan is fine: packs carry single-digit frame counts.
  const { starts, durations } = timeline;
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    if (offset >= starts[i]! && offset < starts[i]! + durations[i]!) return i;
  }
  return starts.length - 1;
}

/**
 * Frame index to show at `elapsedMs` after playback started.
 * - loop: wraps at the end of the forward pass.
 * - pingpong: alternates forward/backward passes, endpoints played once.
 * - once: clamps on the last frame when the pass finishes.
 */
export function frameIndexAt(timeline: FrameTimeline, mode: PlaybackMode, elapsedMs: number): number {
  const count = timeline.durations.length;
  if (count === 0 || timeline.total <= 0) return 0;
  const t = Math.max(0, elapsedMs);

  if (mode === 'once') {
    return indexAtOffset(timeline, Math.min(t, timeline.total - Number.EPSILON));
  }
  if (mode === 'loop') {
    return indexAtOffset(timeline, t % timeline.total);
  }

  // pingpong
  const cycle = pingpongCycleIndexes(count);
  const cycleDurations = cycle.map((index) => timeline.durations[index]!);
  const cycleTotal = cycleDurations.reduce((sum, ms) => sum + ms, 0);
  let offset = t % cycleTotal;
  for (let i = 0; i < cycle.length; i += 1) {
    const duration = cycleDurations[i]!;
    if (offset < duration) return cycle[i]!;
    offset -= duration;
  }
  return cycle[cycle.length - 1]!;
}

/** Position inside the ping-pong cycle (0 … 2n-3) at elapsed time — used to
 *  show "bouncing" direction in the frame strip if needed later. */
export function pingpongPositionAt(timeline: FrameTimeline, elapsedMs: number): number {
  const count = timeline.durations.length;
  if (count <= 1 || timeline.total <= 0) return 0;
  const cycle = pingpongCycleIndexes(count);
  const cycleDurations = cycle.map((index) => timeline.durations[index]!);
  const cycleTotal = cycleDurations.reduce((sum, ms) => sum + ms, 0);
  let offset = Math.max(0, elapsedMs) % cycleTotal;
  for (let i = 0; i < cycle.length; i += 1) {
    const duration = cycleDurations[i]!;
    if (offset < duration) return i;
    offset -= duration;
  }
  return cycle.length - 1;
}

/** Manual stepping: clamps inside the frame range and always pauses. */
export function stepIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, current + delta));
}
