// Sprite-sheet export — packs the decoded frames of one emotion into a
// horizontal PNG strip plus an Aseprite "hash"-format JSON with a frameTag
// per emotion, the same shape Aseprite/TexturePacker consumers expect.

import type { CharacterPack, PlaybackMode } from '../pack/types';

export interface SpriteFrameInput {
  image: CanvasImageSource;
  durationMs: number;
}

interface AsepriteFrameEntry {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  duration: number;
}

interface AsepriteHashJson {
  frames: Record<string, AsepriteFrameEntry>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
    frameTags: Array<{ name: string; from: number; to: number; direction: string }>;
  };
}

export interface SpriteSheetResult {
  pngBlob: Blob;
  json: string;
  /** Suggested base name, e.g. `gruia-grulla-idle`. */
  baseName: string;
  pngFileName: string;
  jsonFileName: string;
}

function asepriteDirection(playback: PlaybackMode): string {
  if (playback === 'pingpong') return 'pingpong';
  if (playback === 'once') return 'forward';
  return 'forward';
}

export async function buildSpriteSheet(options: {
  pack: CharacterPack;
  emotionKey: string;
  playback: PlaybackMode;
  frames: SpriteFrameInput[];
}): Promise<SpriteSheetResult> {
  const { pack, emotionKey, playback, frames } = options;
  if (frames.length === 0) throw new Error('nothing to export — the emotion has no frames');
  const { w, h } = pack.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = w * frames.length;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D is not available in this browser');
  frames.forEach((frame, index) => {
    ctx.drawImage(frame.image, index * w, 0, w, h);
  });

  const baseName = `${pack.id}-${emotionKey}`;
  const pngFileName = `${baseName}.sheet.png`;
  const jsonFileName = `${baseName}.sheet.json`;

  const frameEntries: Record<string, AsepriteFrameEntry> = {};
  frames.forEach((frame, index) => {
    const name = `${baseName}-${String(index).padStart(3, '0')}.png`;
    frameEntries[name] = {
      frame: { x: index * w, y: 0, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
      duration: Math.max(1, Math.round(frame.durationMs)),
    };
  });
  const json: AsepriteHashJson = {
    frames: frameEntries,
    meta: {
      app: 'gruia.design/character-pack',
      version: '1',
      image: pngFileName,
      format: 'RGBA8888',
      size: { w: canvas.width, h: canvas.height },
      scale: '1',
      frameTags: [
        {
          name: emotionKey,
          from: 0,
          to: frames.length - 1,
          direction: asepriteDirection(playback),
        },
      ],
    },
  };

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('could not encode the sprite sheet PNG'));
    }, 'image/png');
  });

  return { pngBlob, json: JSON.stringify(json, null, 2), baseName, pngFileName, jsonFileName };
}

/** Trigger a browser download for a blob — the only DOM-touching bit here. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadJson(fileName: string, json: string): void {
  downloadBlob(fileName, new Blob([json], { type: 'application/json' }));
}
