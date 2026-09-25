// Shared per-view cache of engine-loaded emotions. Grid thumbnails and the
// player ask for the same `LoadedEmotion` so frames decode once per pack.

import { useCallback, useRef } from 'react';

import type { CharacterEmotion } from '../pack/types';
import type { LoadedPack } from '../import/importPack';
import type { FrameUrlResolver, LoadedEmotion } from '../engines/types';
import { getEngine } from '../engines/registry';

export type EmotionLoader = (key: string, emotion: CharacterEmotion) => Promise<LoadedEmotion> | null;

/** `resolveOverride` lets the editor serve accepted-variant blobs that are not
 *  part of the pack source yet. */
export function useEmotionCache(
  pack: LoadedPack | null,
  resolveOverride?: FrameUrlResolver,
): EmotionLoader {
  const packRef = useRef<LoadedPack | null>(null);
  const cacheRef = useRef(new Map<string, Promise<LoadedEmotion>>());

  if (packRef.current !== pack) {
    // Pack switched: drop every decoded emotion bound to the old bytes.
    cacheRef.current = new Map();
    packRef.current = pack;
  }

  return useCallback((key, emotion) => {
    const pack = packRef.current;
    const engine = getEngine(emotion.engine);
    if (!pack || !engine) return null;
    // Edited emotions produce a new frame list per change — the cache key must
    // track frame identity (src + ms + order), not just the emotion key, or a
    // reordered/duplicated strip would keep drawing stale indices.
    const cacheKey = `${key}|${emotion.frames.map((f) => `${f.src}:${f.ms ?? ''}:${f.origin ?? ''}`).join(',')}`;
    let pending = cacheRef.current.get(cacheKey);
    if (!pending) {
      const resolve = resolveOverride ?? ((src: string) => pack.resolve(src));
      pending = engine.loadEmotion(emotion, resolve);
      cacheRef.current.set(cacheKey, pending);
    }
    return pending;
  }, [resolveOverride]);
}
