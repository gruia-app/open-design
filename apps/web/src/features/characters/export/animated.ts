// Animation exporters — GIF via gifenc, APNG via upng-js, animated WebP via
// the browser's still-WebP encoder plus the ANMF muxer. All three consume the
// same per-frame RGBA dump drawn offscreen from the engine, so timing and
// pixels stay identical across formats.

import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import UPNG from 'upng-js';

import type { CharacterPack, PlaybackMode } from '../pack/types';
import type { CharacterEngine, LoadedEmotion } from '../engines/types';
import { muxAnimatedWebp } from './webpAnim';
import { crc32 } from './zipWriter';

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

/** `repeat` follows gifenc's convention: -1 = play once (no NETSCAPE
 *  extension written), 0 = loop forever, >0 = that many iterations. Only the
 *  first frame consumes it. */
export function encodeGif(
  frames: RgbaFrame[],
  width: number,
  height: number,
  repeat = 0,
): Uint8Array {
  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, width, height, { palette, delay: frame.delayMs, repeat });
  }
  gif.finish();
  return gif.bytes();
}

/** UPNG always emits acTL num_plays=0 (loop forever). Rewrite the field — and
 *  the chunk CRC, which covers type+data — when the export should play a
 *  bounded number of times. No acTL chunk (still PNG) is left untouched. */
export function setApngLoopCount(buffer: ArrayBuffer, numPlays: number): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 8; // past the PNG signature
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const isActl =
      bytes[offset + 4] === 0x61 && bytes[offset + 5] === 0x63 &&
      bytes[offset + 6] === 0x54 && bytes[offset + 7] === 0x4c; // 'acTL'
    if (isActl) {
      view.setUint32(offset + 8 + 4, numPlays, false); // num_plays
      const crcData = bytes.subarray(offset + 4, offset + 8 + length);
      view.setUint32(offset + 8 + length, crc32(crcData), false);
      return buffer;
    }
    offset += 12 + length; // length + type + data + crc
  }
  return buffer;
}

/** `numPlays` follows the APNG acTL semantics: 0 = loop forever, N = N plays. */
export function encodeApng(
  frames: RgbaFrame[],
  width: number,
  height: number,
  numPlays = 0,
): ArrayBuffer {
  // cnum=0 keeps the frames truecolor — pack palettes are already curated,
  // quantization would just lose alpha edges.
  const buffer = UPNG.encode(
    frames.map((frame) => frame.data),
    width,
    height,
    0,
    frames.map((frame) => frame.delayMs),
  );
  return numPlays === 0 ? buffer : setApngLoopCount(buffer, numPlays);
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

/** `loopCount` follows the WebP ANIM semantics: 0 = loop forever, N = N plays. */
export async function encodeAnimatedWebp(
  frames: RgbaFrame[],
  width: number,
  height: number,
  loopCount = 0,
): Promise<Uint8Array> {
  const stills = [];
  for (const frame of frames) {
    stills.push({
      bytes: await encodeStillWebp(frame.data, width, height),
      delayMs: frame.delayMs,
    });
  }
  return muxAnimatedWebp(stills, width, height, loopCount);
}

export type AnimFormat = 'gif' | 'apng' | 'webp';

export interface AnimExportResult {
  fileName: string;
  blob: Blob;
}

/** One entry point for the UI: pick a format, get a downloadable blob. The
 *  exported file honors the player's loop choice — `once` produces a file
 *  that plays a single pass instead of looping forever. */
export async function buildAnimationExport(
  format: AnimFormat,
  pack: CharacterPack,
  emotionKey: string,
  frames: RgbaFrame[],
  playback: PlaybackMode = 'loop',
): Promise<AnimExportResult> {
  const { w, h } = pack.canvas;
  const baseName = `${pack.id}-${emotionKey}`;
  const playOnce = playback === 'once';
  if (format === 'gif') {
    return {
      fileName: `${baseName}.gif`,
      blob: new Blob([encodeGif(frames, w, h, playOnce ? -1 : 0) as BlobPart], {
        type: 'image/gif',
      }),
    };
  }
  if (format === 'apng') {
    return {
      fileName: `${baseName}.png`,
      blob: new Blob([encodeApng(frames, w, h, playOnce ? 1 : 0)], { type: 'image/apng' }),
    };
  }
  return {
    fileName: `${baseName}.webp`,
    blob: new Blob([await encodeAnimatedWebp(frames, w, h, playOnce ? 1 : 0) as BlobPart], {
      type: 'image/webp',
    }),
  };
}
