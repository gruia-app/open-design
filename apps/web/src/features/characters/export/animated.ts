// Animation exporters — GIF via gifenc, APNG via upng-js, animated WebP via
// the browser's still-WebP encoder plus the ANMF muxer. All three consume the
// same per-frame RGBA dump drawn offscreen from the engine, so timing and
// pixels stay identical across formats.

import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import UPNG from 'upng-js';

import type { CharacterPack, PlaybackMode } from '../pack/types';
import type { CharacterEngine, LoadedEmotion } from '../engines/types';
import { muxAnimatedWebp } from './webpAnim';

export interface RgbaFrame {
  data: Uint8ClampedArray<ArrayBuffer>;
  delayMs: number;
}

/** Draw every frame into an offscreen canvas and return raw RGBA + delays.
 *  DOM-only — callers live in the player/editor layer. */
export function collectRgbaFrames(
  engine: CharacterEngine,
  loaded: LoadedEmotion,
  durationsMs: number[],
  width: number,
  height: number,
): RgbaFrame[] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D is not available in this browser');
  const frames: RgbaFrame[] = [];
  for (let index = 0; index < loaded.frameCount; index += 1) {
    ctx.clearRect(0, 0, width, height);
    engine.renderFrame(ctx, loaded, index);
    const { data } = ctx.getImageData(0, 0, width, height);
    frames.push({
      data: data as Uint8ClampedArray<ArrayBuffer>,
      delayMs: Math.max(10, Math.round(durationsMs[index] ?? 100)),
    });
  }
  return frames;
}

/** Ping-pong playback is a viewer affordance; exporters flatten it to the
 *  effective frame order so the file plays like the preview. */
export function effectiveFrameOrder(
  count: number,
  playback: PlaybackMode,
): number[] {
  if (playback !== 'pingpong' || count <= 1) {
    return Array.from({ length: count }, (_, i) => i);
  }
  const order: number[] = [];
  for (let i = 0; i < count; i += 1) order.push(i);
  for (let i = count - 2; i >= 1; i -= 1) order.push(i);
  return order;
}

export function collectPlaybackFrames(
  engine: CharacterEngine,
  loaded: LoadedEmotion,
  durationsMs: number[],
  width: number,
  height: number,
  playback: PlaybackMode,
): RgbaFrame[] {
  const frames = collectRgbaFrames(engine, loaded, durationsMs, width, height);
  return effectiveFrameOrder(frames.length, playback).map((index) => frames[index]!);
}

export function encodeGif(frames: RgbaFrame[], width: number, height: number): Uint8Array {
  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, width, height, { palette, delay: frame.delayMs });
  }
  gif.finish();
  return gif.bytes();
}

export function encodeApng(
  frames: RgbaFrame[],
  width: number,
  height: number,
): ArrayBuffer {
  // cnum=0 keeps the frames truecolor — pack palettes are already curated,
  // quantization would just lose alpha edges.
  return UPNG.encode(
    frames.map((frame) => frame.data),
    width,
    height,
    0,
    frames.map((frame) => frame.delayMs),
  );
}

async function encodeStillWebp(
  data: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D is not available in this browser');
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('WebP encode failed'))),
      'image/webp',
      0.92,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function encodeAnimatedWebp(
  frames: RgbaFrame[],
  width: number,
  height: number,
): Promise<Uint8Array> {
  const stills = [];
  for (const frame of frames) {
    stills.push({
      bytes: await encodeStillWebp(frame.data, width, height),
      delayMs: frame.delayMs,
    });
  }
  return muxAnimatedWebp(stills, width, height);
}

export type AnimFormat = 'gif' | 'apng' | 'webp';

export interface AnimExportResult {
  fileName: string;
  blob: Blob;
}

/** One entry point for the UI: pick a format, get a downloadable blob. */
export async function buildAnimationExport(
  format: AnimFormat,
  pack: CharacterPack,
  emotionKey: string,
  frames: RgbaFrame[],
): Promise<AnimExportResult> {
  const { w, h } = pack.canvas;
  const baseName = `${pack.id}-${emotionKey}`;
  if (format === 'gif') {
    return {
      fileName: `${baseName}.gif`,
      blob: new Blob([encodeGif(frames, w, h) as BlobPart], { type: 'image/gif' }),
    };
  }
  if (format === 'apng') {
    return {
      fileName: `${baseName}.png`,
      blob: new Blob([encodeApng(frames, w, h)], { type: 'image/apng' }),
    };
  }
  return {
    fileName: `${baseName}.webp`,
    blob: new Blob([await encodeAnimatedWebp(frames, w, h) as BlobPart], {
      type: 'image/webp',
    }),
  };
}
