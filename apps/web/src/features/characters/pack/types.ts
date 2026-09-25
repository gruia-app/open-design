// character-pack v1 — the shared contract between pack generation (offline
// agent runs) and this review UI. A pack is a folder with a `pack.json`, a
// `ref/` directory and one folder of PNG frames per emotion.
//
// The shape is deliberately permissive about forward-compatible fields
// (frame `origin`/`note`, `qc`, unknown top-level keys) so F3/F4 work —
// frame editing, regeneration jobs, extra export formats and proposal
// galleries — can grow the same manifest without breaking older viewers.

export const CHARACTER_PACK_SCHEMA = 'gruia.character-pack/1';

/** v1.1 adds reviewer fields (frame `liked`, emotion `note`/`liked`) written
 *  by the editor. Both schema ids parse into the same manifest shape. */
export const CHARACTER_PACK_SCHEMA_V11 = 'gruia.character-pack/1.1';
export const CHARACTER_PACK_SCHEMAS: readonly string[] = [
  CHARACTER_PACK_SCHEMA,
  CHARACTER_PACK_SCHEMA_V11,
];

export const EMOTION_KEYS = [
  'idle',
  'smile',
  'joy',
  'surprise',
  'sad',
  'annoyed',
  'thinking',
  'wave',
  'nudge',
  'triumph',
] as const;

/** The ten canonical emotions. Unknown keys are allowed (forward-compat) and
 *  surface as parser warnings, not errors. */
export type KnownEmotionKey = (typeof EMOTION_KEYS)[number];
export type EmotionKey = KnownEmotionKey | (string & {});

export type PlaybackMode = 'loop' | 'pingpong' | 'once';

/** Engines render an emotion's frames. `raster-frames` is the only one
 *  implemented today; the rest are reserved ids that render as
 *  "coming soon" so packs authored ahead of the engine still load. */
export const IMPLEMENTED_ENGINE_IDS = ['raster-frames'] as const;
export const RESERVED_ENGINE_IDS = ['svg-rig', 'three', 'blender'] as const;
export type ImplementedEngineId = (typeof IMPLEMENTED_ENGINE_IDS)[number];
export type ReservedEngineId = (typeof RESERVED_ENGINE_IDS)[number];
export type EngineId = ImplementedEngineId | ReservedEngineId | (string & {});

export interface CharacterPackCanvas {
  w: number;
  h: number;
}

/** Feet line + horizontal center: every frame is authored so the character
 *  stands on `anchor.y` at the same scale. */
export interface CharacterPackAnchor {
  x: number;
  y: number;
}

export interface CharacterFrame {
  /** Path relative to the pack root, e.g. `idle/000.png`. */
  src: string;
  /** Per-frame duration override; `null` means "use 1000/fps". */
  ms: number | null;
  /** Provenance tag for editing workflows (`gen`, `edit`, `upload`, …). */
  origin?: string;
  /** Human note attached to the frame (regeneration feedback, reviewer note). */
  note?: string;
  /** Reviewer "me gusta" flag (pack v1.1). */
  liked?: boolean;
}

export interface CharacterEmotion {
  label: string;
  engine: EngineId;
  fps?: number;
  playback?: PlaybackMode;
  /** Reviewer note for the whole emotion (pack v1.1). */
  note?: string;
  /** Reviewer "me gusta" flag for the whole emotion (pack v1.1). */
  liked?: boolean;
  /** Usage metadata (pack v1.1): the base emotion this one derives from,
   *  whether it plays once and holds the pose, and its intended use. */
  base?: string;
  oneShot?: boolean;
  usage?: string;
  frames: CharacterFrame[];
}

export interface CharacterPackDefaults {
  engine: EngineId;
  fps: number;
  playback: PlaybackMode;
}

/** Pack meta (v1.1) — free-form provenance block. Personajes stores the r150
 *  «¿Para qué lo quieres?» answer here: `goal` is one of app|video|brand|
 *  story|other and `detail` the free text for "other". Kept opaque to the
 *  parser: unknown sibling keys inside `meta` survive a round-trip. */
export interface PackMeta {
  goal?: string;
  detail?: string;
  [key: string]: unknown;
}

export interface EmotionQc {
  paletteDeltaE?: number;
  silhouetteIoUMin?: number;
  flags?: string[];
}

export interface CharacterPack {
  schema: string;
  id: string;
  name: string;
  brand?: string;
  canvas: CharacterPackCanvas;
  anchor: CharacterPackAnchor;
  palette: string[];
  reference?: string;
  defaults: CharacterPackDefaults;
  emotions: Record<string, CharacterEmotion>;
  qc?: Record<string, EmotionQc>;
  /** Provenance block (v1.1) — the r150 meta question answer lives here. */
  meta?: PackMeta;
  /** Forward-compat: generation/edit jobs (F3) live under `jobs/*.json`;
   *  manifest-level declarations land here so the viewer can ignore them. */
  jobs?: unknown;
}

/** Effective playback settings for one emotion after defaults are applied. */
export function emotionFps(pack: CharacterPack, emotion: CharacterEmotion): number {
  return emotion.fps ?? pack.defaults.fps;
}

export function emotionPlayback(pack: CharacterPack, emotion: CharacterEmotion): PlaybackMode {
  return emotion.playback ?? pack.defaults.playback;
}
