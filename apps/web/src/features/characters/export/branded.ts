// G-UX 8A — branded GIF for the public trial route (`/characters/try`).
// Same local frames as the regular exporters plus one discreet
// «hecho con gruia» watermark per frame. No model or imagegen calls —
// everything is drawn and encoded in the browser.

import type { CharacterEngine, LoadedEmotion } from '../engines/types';
import type { CharacterPack, PlaybackMode } from '../pack/types';
import { emotionFps } from '../pack/types';
import { frameDurationMs } from '../playback/timeline';
import { collectPlaybackFrames, encodeGif, type RgbaFrame } from './animated';

const BRAND_LABEL = 'hecho con gruia';

/** Repaint every RGBA frame with the discreet brand line, bottom-right. */
function stampFrames(
  frames: RgbaFrame[],
  width: number,
  height: number,
): RgbaFrame[] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D is not available in this browser');
  const fontSize = Math.max(12, Math.round(height * 0.045));
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textBaseline = 'bottom';
  return frames.map((frame) => {
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(new ImageData(frame.data, width, height), 0, 0);
    ctx.fillStyle = 'rgba(30, 24, 18, 0.42)';
    ctx.fillText(BRAND_LABEL, width - ctx.measureText(BRAND_LABEL).width - fontSize, height - fontSize * 0.6);
    const { data } = ctx.getImageData(0, 0, width, height);
    return {
      data: data as Uint8ClampedArray<ArrayBuffer>,
      delayMs: frame.delayMs,
    };
  });
}

/** Build the watermarked GIF blob for the trial wall's «Descargar GIF con
 *  marca» action — the only export that works without an account. */
export function buildBrandedGif(
  engine: CharacterEngine,
  pack: CharacterPack,
  emotionKey: string,
  emotion: Parameters<CharacterEngine['loadEmotion']>[0],
  loaded: LoadedEmotion,
  playback: PlaybackMode,
): { fileName: string; blob: Blob } {
  const fps = emotionFps(pack, emotion);
  const durations = emotion.frames.map((frame) => frameDurationMs(frame, fps));
  const frames = collectPlaybackFrames(engine, loaded, durations, pack.canvas.w, pack.canvas.h, playback);
  const stamped = stampFrames(frames, pack.canvas.w, pack.canvas.h);
  return {
    fileName: `${pack.id}-${emotionKey}-gruia.gif`,
    blob: new Blob([encodeGif(stamped, pack.canvas.w, pack.canvas.h) as BlobPart], {
      type: 'image/gif',
    }),
  };
}
