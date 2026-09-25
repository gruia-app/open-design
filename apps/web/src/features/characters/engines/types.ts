// CharacterEngine — the swappable renderer behind each emotion. A pack picks
// an engine per emotion (`pack.json` → emotions.*.engine); the registry
// resolves the id to an implementation. Only `raster-frames` ships today;
// `svg-rig`, `three` and `blender` are reserved ids that surface as
// "coming soon" so forward-authored packs still import cleanly.

import type { CharacterEmotion, EngineId } from '../pack/types';

/** Resolves a pack-relative frame src (e.g. `idle/000.png`) into a URL the
 *  engine can load — an object URL for imported packs, a public path for
 *  bundled ones. */
export type FrameUrlResolver = (src: string) => Promise<string>;

/** Opaque per-emotion payload the engine returns from `loadEmotion` and later
 *  consumes in `renderFrame`. The player never looks inside. */
export interface LoadedEmotion {
  readonly frameCount: number;
}

export interface RenderOptions {
  /** Frame index to draw as a low-alpha ghost behind the current frame —
   *  the onion skin. Ignored when out of range. */
  ghostIndex?: number;
  /** Alpha for the ghost frame (0–1). */
  ghostAlpha?: number;
}

export interface CharacterEngine {
  readonly id: EngineId;
  /** Decode/prepare every frame of an emotion up front so playback is a
   *  pure draw call — no async work inside the rAF loop. */
  loadEmotion(emotion: CharacterEmotion, resolve: FrameUrlResolver): Promise<LoadedEmotion>;
  /** Draw `frameIndex` into `ctx`. The canvas is already sized to the pack
   *  canvas and cleared by the caller. */
  renderFrame(
    ctx: CanvasRenderingContext2D,
    loaded: LoadedEmotion,
    frameIndex: number,
    opts?: RenderOptions,
  ): void;
  /** Raw drawable for a frame — used by the frame strip thumbnails and the
   *  sprite-sheet exporter. Returns null when the engine has no bitmap for
   *  the frame (e.g. a rigged engine would need a rasterize step first). */
  frameImage?(loaded: LoadedEmotion, frameIndex: number): CanvasImageSource | null;
  dispose?(loaded: LoadedEmotion): void;
}
