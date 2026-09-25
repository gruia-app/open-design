// usePlayback — the rAF-driven playhead. All timing math lives in
// `timeline.ts`; this hook only owns "where is the clock right now" and the
// play/pause/step/seek intents around it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CharacterFrame, PlaybackMode } from '../pack/types';
import { buildTimeline, frameIndexAt, stepIndex, type FrameTimeline } from './timeline';

export interface PlaybackControls {
  playing: boolean;
  frameIndex: number;
  timeline: FrameTimeline;
  play(): void;
  pause(): void;
  toggle(): void;
  step(delta: number): void;
  seekToFrame(index: number): void;
}

export function usePlayback(
  frames: ReadonlyArray<Pick<CharacterFrame, 'ms'>>,
  fps: number,
  mode: PlaybackMode,
): PlaybackControls {
  const timeline = useMemo(() => buildTimeline(frames, fps), [frames, fps]);
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  // `elapsedBase` is the accumulated playhead while paused; while playing the
  // live playhead is `performance.now() - startedAt`.
  const elapsedBaseRef = useRef(0);
  const startedAtRef = useRef<number | null>(performance.now());
  const playingRef = useRef(true);
  playingRef.current = playing;

  const liveElapsed = useCallback(() => {
    const startedAt = startedAtRef.current;
    return playingRef.current && startedAt != null
      ? performance.now() - startedAt
      : elapsedBaseRef.current;
  }, []);

  const pause = useCallback(() => {
    if (!playingRef.current) return;
    elapsedBaseRef.current = liveElapsed();
    startedAtRef.current = null;
    setPlaying(false);
  }, [liveElapsed]);

  const play = useCallback(() => {
    if (playingRef.current) return;
    // A finished "once" restarts from the top instead of sitting on the last
    // frame — pressing play on a dead clip means "run it again".
    if (mode === 'once' && elapsedBaseRef.current >= timeline.total) {
      elapsedBaseRef.current = 0;
    }
    startedAtRef.current = performance.now() - elapsedBaseRef.current;
    setPlaying(true);
  }, [mode, timeline.total]);

  const seekToFrame = useCallback(
    (index: number) => {
      const target = timeline.starts[index] ?? 0;
      elapsedBaseRef.current = target;
      if (playingRef.current) {
        startedAtRef.current = performance.now() - target;
      }
      setFrameIndex(index);
    },
    [timeline.starts],
  );

  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      playingRef.current = false;
      startedAtRef.current = null;
      setFrameIndex((current) => {
        const next = stepIndex(current, delta, timeline.durations.length);
        elapsedBaseRef.current = timeline.starts[next] ?? 0;
        return next;
      });
    },
    [timeline.durations.length, timeline.starts],
  );

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  // The rAF loop only asks the pure timeline for the current index; a "once"
  // clip that ran out stops the clock so it stays parked on its last frame.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = liveElapsed();
      if (mode === 'once' && elapsed >= timeline.total) {
        elapsedBaseRef.current = timeline.total;
        startedAtRef.current = null;
        setPlaying(false);
      }
      setFrameIndex(frameIndexAt(timeline, mode, elapsed));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeline, mode, liveElapsed]);

  return { playing, frameIndex, timeline, play, pause, toggle, step, seekToFrame };
}
