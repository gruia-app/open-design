// Animated canvas thumbnail for one emotion — the loading + rAF draw loop
// shared by the emotion grid cards, the gallery starter cards and the
// gallery result cards. Engine loading goes through the caller's
// EmotionLoader so edits/accepted variants resolve like everywhere else.

import { useEffect, useRef, useState } from 'react';

import { emotionFps, emotionPlayback, type CharacterEmotion, type CharacterPack } from '../pack/types';
import { getEngine } from '../engines/registry';
import type { LoadedEmotion } from '../engines/types';
import { buildTimeline, frameIndexAt } from '../playback/timeline';
import type { EmotionLoader } from './useEmotionCache';
import { useReducedMotion } from './useReducedMotion';

interface Props {
  pack: CharacterPack;
  emotionKey: string;
  emotion: CharacterEmotion;
  load: EmotionLoader;
  className?: string;
  label?: string;
  onFrames?: (loaded: LoadedEmotion | null) => void;
}

export function AnimatedThumb({ pack, emotionKey, emotion, load, className, label, onFrames }: Props) {
  const engine = getEngine(emotion.engine);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<LoadedEmotion | null>(null);
  const fps = emotionFps(pack, emotion);
  const playback = emotionPlayback(pack, emotion);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!engine) return;
    let alive = true;
    const pending = load(emotionKey, emotion);
    if (!pending) return;
    pending
      .then((result) => {
        if (!alive) return;
        setLoaded(result);
        onFrames?.(result);
      })
      .catch(() => {
        if (alive) onFrames?.(null);
      });
    return () => {
      alive = false;
    };
  }, [engine, load, emotionKey, emotion, onFrames]);

  useEffect(() => {
    if (!loaded || !engine) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const timeline = buildTimeline(emotion.frames, fps);
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const index = reducedMotion ? 0 : frameIndexAt(timeline, playback, performance.now() - startedAt);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      engine.renderFrame(ctx, loaded, index);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, engine, emotion.frames, fps, playback, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={pack.canvas.w}
      height={pack.canvas.h}
      aria-label={label ?? emotionKey}
    />
  );
}
