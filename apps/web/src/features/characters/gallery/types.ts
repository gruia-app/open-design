// Gallery (F4) — a generation result is a pack derived from a working base
// («parte de uno que ya funciona»): the base manifest is cloned, filtered to
// the chosen emotions and trimmed to the chosen frame count, then persisted
// in IndexedDB so the card, its likes and its notes survive reloads. Frame
// bytes are shared with the base pack — the srcs are unchanged, so the
// result resolves them through the base pack's resolver.

import {
  CHARACTER_PACK_SCHEMA_V11,
  type CharacterEmotion,
  type CharacterPack,
  type PackMeta,
} from '../pack/types';

export interface GenerationOptions {
  /** Free-form style hint carried into the derived manifest note. */
  style: string;
  /** Frames kept per emotion (default 8, pack frames are 0..7). */
  frameCount: number;
  /** Emotion keys to keep; empty means "all of the base's". */
  emotions: string[];
  engine: string;
  background: string;
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  style: '',
  frameCount: 8,
  emotions: [],
  engine: 'raster-frames',
  background: 'transparent',
};

export interface GenerationResult {
  id: string;
  createdAt: number;
  /** The phrase, or the image file name when the input was an image. */
  prompt: string;
  /** Optional reference image (structured-cloned into IndexedDB). */
  image?: Blob;
  imageName?: string;
  /** Bundled pack id of the base ('gruia-grulla', 'contenido-tinta', …). */
  basePackId: string;
  baseLabel: string;
  options: GenerationOptions;
  /** Derived pack manifest, schema v1.1. */
  manifest: CharacterPack;
  /** Reviewer fields (v1.1) on the result card. */
  liked?: boolean;
  note?: string;
  /** r150 meta answer («¿Para qué lo quieres?») — mirrored into
   *  `manifest.meta` so pack exports carry it. */
  meta?: PackMeta;
}

let counter = 0;

export function newResultId(now = Date.now()): string {
  counter = (counter + 1) % 1296;
  return `${now.toString(36)}-${counter.toString(36).padStart(2, '0')}`;
}

function cloneEmotionTrimmed(emotion: CharacterEmotion, frameCount: number): CharacterEmotion {
  return {
    ...emotion,
    frames: emotion.frames.slice(0, Math.max(1, frameCount)).map((frame) => ({ ...frame })),
  };
}

/** Clone a base manifest into a pack v1.1 shaped by the generation options. */
export function deriveResultManifest(
  base: CharacterPack,
  options: GenerationOptions,
  prompt: string,
  id: string,
): CharacterPack {
  const keep = options.emotions.length > 0 ? new Set(options.emotions) : null;
  const emotions: Record<string, CharacterEmotion> = {};
  for (const [key, emotion] of Object.entries(base.emotions)) {
    if (keep && !keep.has(key)) continue;
    emotions[key] = cloneEmotionTrimmed(emotion, options.frameCount);
  }
  const title = prompt.trim().slice(0, 60) || id;
  return {
    ...base,
    schema: CHARACTER_PACK_SCHEMA_V11,
    id: `${base.id}-gen-${id}`,
    name: `${base.name} · ${title}`,
    emotions,
  };
}
