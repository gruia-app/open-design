// Playback timing tests for the character player: loop / pingpong / once
// contracts, per-frame ms overrides, fps clamping and manual stepping.
// These are pure functions — the rAF hook is a thin wrapper over them.

import { describe, expect, it } from 'vitest';

import {
  buildTimeline,
  clampFps,
  frameIndexAt,
  MAX_FPS,
  MIN_FPS,
  pingpongCycleIndexes,
  stepIndex,
} from '../src/features/characters/playback/timeline';

const FOUR_FRAMES = [{ ms: null }, { ms: null }, { ms: null }, { ms: null }];

describe('buildTimeline', () => {
  it('spaces frames at 1000/fps when ms is null', () => {
    const timeline = buildTimeline(FOUR_FRAMES, 10);
    expect(timeline.durations).toEqual([100, 100, 100, 100]);
    expect(timeline.starts).toEqual([0, 100, 200, 300]);
    expect(timeline.total).toBe(400);
  });

  it('lets a per-frame ms override win over fps', () => {
    const timeline = buildTimeline([{ ms: null }, { ms: 250 }, { ms: null }], 10);
    expect(timeline.durations).toEqual([100, 250, 100]);
    expect(timeline.starts).toEqual([0, 100, 350]);
    expect(timeline.total).toBe(450);
  });
});

describe('frameIndexAt', () => {
  it('loops back to the first frame', () => {
    const timeline = buildTimeline(FOUR_FRAMES, 10); // 400ms pass
    expect(frameIndexAt(timeline, 'loop', 0)).toBe(0);
    expect(frameIndexAt(timeline, 'loop', 150)).toBe(1);
    expect(frameIndexAt(timeline, 'loop', 399)).toBe(3);
    expect(frameIndexAt(timeline, 'loop', 400)).toBe(0);
    expect(frameIndexAt(timeline, 'loop', 550)).toBe(1);
  });

  it('clamps on the last frame for once playback', () => {
    const timeline = buildTimeline(FOUR_FRAMES, 10);
    expect(frameIndexAt(timeline, 'once', 0)).toBe(0);
    expect(frameIndexAt(timeline, 'once', 250)).toBe(2);
    expect(frameIndexAt(timeline, 'once', 400)).toBe(3);
    expect(frameIndexAt(timeline, 'once', 9999)).toBe(3);
  });

  it('plays endpoints once per ping-pong cycle', () => {
    expect(pingpongCycleIndexes(4)).toEqual([0, 1, 2, 3, 2, 1]);
    expect(pingpongCycleIndexes(1)).toEqual([0]);
  });

  it('ping-pongs across the cycle with per-frame durations', () => {
    const timeline = buildTimeline(FOUR_FRAMES, 10); // cycle = 600ms
    const seen = [0, 50, 150, 250, 350, 450, 550, 650, 750].map((t) =>
      frameIndexAt(timeline, 'pingpong', t),
    );
    expect(seen).toEqual([0, 0, 1, 2, 3, 2, 1, 0, 1]);
  });
});

describe('clampFps', () => {
  it('stays inside the 4–24 selector range', () => {
    expect(clampFps(MIN_FPS)).toBe(4);
    expect(clampFps(MAX_FPS)).toBe(24);
    expect(clampFps(1)).toBe(4);
    expect(clampFps(60)).toBe(24);
    expect(clampFps(Number.NaN)).toBe(4);
  });
});

describe('stepIndex', () => {
  it('clamps inside the frame range', () => {
    expect(stepIndex(0, 1, 4)).toBe(1);
    expect(stepIndex(0, -1, 4)).toBe(0);
    expect(stepIndex(3, 1, 4)).toBe(3);
    expect(stepIndex(3, -1, 4)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});
