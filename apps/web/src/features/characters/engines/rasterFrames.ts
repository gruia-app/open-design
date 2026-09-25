// raster-frames — the v1 engine: one RGBA PNG per frame, drawn 1:1 onto a
// canvas 2D context. Frame images are preloaded in `loadEmotion` so the
// playback loop is synchronous draws only.

import type { CharacterEmotion } from '../pack/types';
import type { CharacterEngine, FrameUrlResolver, LoadedEmotion, RenderOptions } from './types';
import { registerEngine } from './registry';

interface RasterFrame {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface RasterEmotion extends LoadedEmotion {
  frames: RasterFrame[];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load frame ${url}`));
    image.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, frame: RasterFrame): void {
  // Pack frames are authored on the shared pack canvas, so they draw 1:1 —
  // a mismatched file is scaled to fit rather than silently cropped.
  const { width, height } = ctx.canvas;
  if (frame.width === width && frame.height === height) {
    ctx.drawImage(frame.image, 0, 0);
    return;
  }
  const scale = Math.min(width / frame.width, height / frame.height);
  const w = frame.width * scale;
  const h = frame.height * scale;
  ctx.drawImage(frame.image, (width - w) / 2, (height - h) / 2, w, h);
}

export const rasterFramesEngine: CharacterEngine = {
  id: 'raster-frames',

  async loadEmotion(emotion: CharacterEmotion, resolve: FrameUrlResolver): Promise<RasterEmotion> {
    const frames = await Promise.all(
      emotion.frames.map(async (frame): Promise<RasterFrame> => {
        const url = await resolve(frame.src);
        const image = await loadImage(url);
        return { image, width: image.naturalWidth, height: image.naturalHeight };
      }),
    );
    return { frameCount: frames.length, frames };
  },

  renderFrame(ctx, loaded, frameIndex, opts?: RenderOptions): void {
    const raster = loaded as RasterEmotion;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const ghost = opts?.ghostIndex;
    if (ghost != null && ghost >= 0 && ghost < raster.frames.length && ghost !== frameIndex) {
      ctx.globalAlpha = Math.min(1, Math.max(0, opts?.ghostAlpha ?? 0.25));
      drawCover(ctx, raster.frames[ghost]!);
    }
    ctx.globalAlpha = 1;
    const frame = raster.frames[frameIndex];
    if (frame) drawCover(ctx, frame);
    ctx.restore();
  },

  frameImage(loaded, frameIndex) {
    const frame = (loaded as RasterEmotion).frames[frameIndex];
    return frame ? frame.image : null;
  },
};

registerEngine(rasterFramesEngine);
