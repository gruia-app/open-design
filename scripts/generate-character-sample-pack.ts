#!/usr/bin/env tsx
// Generates the bundled placeholder character pack for the Personajes
// section: `apps/web/public/character-packs/pixel-demo/`.
//
// The art is a deliberately simple blob mascot ("Pixel") drawn straight into
// RGBA buffers and encoded with a minimal PNG writer — no native deps, so the
// script stays deterministic in CI and in bare Node checkouts. When the real
// gruia-grulla pack lands it replaces this one; this stays as the fallback.
//
// Run: pnpm exec tsx scripts/generate-character-sample-pack.ts

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 512;
const H = 512;
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'public',
  'character-packs',
  'pixel-demo',
);

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA, filter 0)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, w);
  view.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = new Uint8Array(h * (1 + w * 4));
  for (let y = 0; y < h; y += 1) {
    raw[y * (1 + w * 4)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (1 + w * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return concat([
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tiny painter
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

interface Ctx {
  buf: Uint8ClampedArray;
}

function newCtx(): Ctx {
  return { buf: new Uint8ClampedArray(W * H * 4) };
}

function px(ctx: Ctx, x: number, y: number, [r, g, b]: Rgb, a = 1): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 4;
  const sa = a;
  ctx.buf[i] = Math.round(r * sa + ctx.buf[i]! * (1 - sa));
  ctx.buf[i + 1] = Math.round(g * sa + ctx.buf[i + 1]! * (1 - sa));
  ctx.buf[i + 2] = Math.round(b * sa + ctx.buf[i + 2]! * (1 - sa));
  ctx.buf[i + 3] = Math.min(255, ctx.buf[i + 3]! + Math.round(255 * sa));
}

function fillEllipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: Rgb, a = 1): void {
  const x0 = Math.floor(cx - rx - 1);
  const x1 = Math.ceil(cx + rx + 1);
  const y0 = Math.floor(cy - ry - 1);
  const y1 = Math.ceil(cy + ry + 1);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1.05) continue;
      // ~1px antialias edge
      const edge = Math.min(1, Math.max(0, (1.0 - d) * Math.max(rx, ry)));
      px(ctx, x, y, color, a * Math.min(1, edge));
    }
  }
}

function fillCircle(ctx: Ctx, cx: number, cy: number, r: number, color: Rgb, a = 1): void {
  fillEllipse(ctx, cx, cy, r, r, color, a);
}

function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number, color: Rgb, a = 1): void {
  const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    fillCircle(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, color, a);
  }
}

function arc(ctx: Ctx, cx: number, cy: number, r: number, a0: number, a1: number, width: number, color: Rgb, alpha = 1): void {
  const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r));
  for (let i = 0; i <= steps; i += 1) {
    const t = a0 + ((a1 - a0) * i) / steps;
    fillCircle(ctx, cx + Math.cos(t) * r, cy + Math.sin(t) * r, width / 2, color, alpha);
  }
}

// ---------------------------------------------------------------------------
// Pixel the blob
// ---------------------------------------------------------------------------

const BODY: Rgb = [74, 81, 120];
const BODY_DARK: Rgb = [56, 61, 94];
const BELLY: Rgb = [107, 116, 168];
const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [38, 41, 61];
const ACCENT: Rgb = [232, 100, 90];
const GOLD: Rgb = [255, 207, 92];

const ANCHOR_X = 256;
const ANCHOR_Y = 472;

interface Pose {
  bob: number; // px up from rest
  squash: number; // 1 = none, <1 flattened, >1 stretched
  lean: number; // px horizontal shift
  lookX: number; // pupil offset
  lookY: number;
  mouth: 'smile' | 'flat' | 'open' | 'frown' | 'o' | 'grin';
  eyes: 'open' | 'happy' | 'blink' | 'wide';
  brows: 'none' | 'angry' | 'raised';
  armRaise: number; // 0..1 waving arm
}

function drawPixel(ctx: Ctx, p: Pose): void {
  const feetY = ANCHOR_Y;
  const bodyH = 300 * p.squash;
  const bodyW = 210 * (2 - p.squash);
  const cx = ANCHOR_X + p.lean;
  const cy = feetY - bodyH / 2 - p.bob;

  // shadow
  fillEllipse(ctx, ANCHOR_X, feetY + 8, 120 * (2 - p.squash), 18, BODY_DARK, 0.35);
  // body
  fillEllipse(ctx, cx, cy, bodyW / 2, bodyH / 2, BODY);
  fillEllipse(ctx, cx, cy + bodyH * 0.22, bodyW * 0.32, bodyH * 0.24, BELLY, 0.9);
  // cheeks
  fillCircle(ctx, cx - bodyW * 0.3, cy - bodyH * 0.02, 14, ACCENT, 0.45);
  fillCircle(ctx, cx + bodyW * 0.3, cy - bodyH * 0.02, 14, ACCENT, 0.45);

  // waving arm (behind cheek line)
  if (p.armRaise > 0) {
    const sx = cx + bodyW * 0.42;
    const sy = cy + bodyH * 0.05;
    const hx = sx + 46;
    const hy = sy - 30 - p.armRaise * 60;
    line(ctx, sx, sy, hx, hy, 22, BODY_DARK);
    fillCircle(ctx, hx, hy, 15, GOLD);
  }

  const eyeY = cy - bodyH * 0.18;
  const eyeDX = bodyW * 0.18;
  const eyeR = p.eyes === 'wide' ? 26 : 21;

  if (p.eyes === 'happy') {
    arc(ctx, cx - eyeDX, eyeY + 4, eyeR, Math.PI + 0.35, Math.PI * 2 - 0.35, 9, INK);
    arc(ctx, cx + eyeDX, eyeY + 4, eyeR, Math.PI + 0.35, Math.PI * 2 - 0.35, 9, INK);
  } else if (p.eyes === 'blink') {
    line(ctx, cx - eyeDX - 12, eyeY, cx - eyeDX + 12, eyeY, 8, INK);
    line(ctx, cx + eyeDX - 12, eyeY, cx + eyeDX + 12, eyeY, 8, INK);
  } else {
    fillCircle(ctx, cx - eyeDX, eyeY, eyeR, WHITE);
    fillCircle(ctx, cx + eyeDX, eyeY, eyeR, WHITE);
    fillCircle(ctx, cx - eyeDX + p.lookX, eyeY + p.lookY, eyeR * 0.45, INK);
    fillCircle(ctx, cx + eyeDX + p.lookX, eyeY + p.lookY, eyeR * 0.45, INK);
  }

  if (p.brows === 'angry') {
    line(ctx, cx - eyeDX - 16, eyeY - eyeR - 18, cx - eyeDX + 12, eyeY - eyeR - 6, 8, BODY_DARK);
    line(ctx, cx + eyeDX - 12, eyeY - eyeR - 6, cx + eyeDX + 16, eyeY - eyeR - 18, 8, BODY_DARK);
  } else if (p.brows === 'raised') {
    line(ctx, cx - eyeDX - 14, eyeY - eyeR - 14, cx - eyeDX + 14, eyeY - eyeR - 20, 7, BODY_DARK);
    line(ctx, cx + eyeDX - 14, eyeY - eyeR - 20, cx + eyeDX + 14, eyeY - eyeR - 14, 7, BODY_DARK);
  }

  const mouthY = cy + bodyH * 0.08;
  if (p.mouth === 'smile') {
    arc(ctx, cx, mouthY - 4, 26, 0.25 * Math.PI, 0.75 * Math.PI, 9, INK);
  } else if (p.mouth === 'grin') {
    arc(ctx, cx, mouthY - 6, 36, 0.15 * Math.PI, 0.85 * Math.PI, 10, INK);
  } else if (p.mouth === 'open') {
    fillEllipse(ctx, cx, mouthY + 6, 22, 16, INK);
    fillEllipse(ctx, cx, mouthY + 11, 12, 7, ACCENT);
  } else if (p.mouth === 'o') {
    fillEllipse(ctx, cx, mouthY + 4, 12, 14, INK);
  } else if (p.mouth === 'frown') {
    arc(ctx, cx, mouthY + 22, 24, 1.2 * Math.PI, 1.8 * Math.PI, 9, INK);
  } else {
    line(ctx, cx - 18, mouthY + 4, cx + 18, mouthY + 4, 8, INK);
  }
}

const BASE: Pose = {
  bob: 0,
  squash: 1,
  lean: 0,
  lookX: 0,
  lookY: 4,
  mouth: 'smile',
  eyes: 'open',
  brows: 'none',
  armRaise: 0,
};

// t ∈ [0,1) along the clip
type EmotionPose = (t: number) => Pose;

const EMOTION_POSES: Record<string, { label: string; frames: number; fps: number; playback: string; pose: EmotionPose }> = {
  idle: {
    label: 'Respiración',
    frames: 10,
    fps: 8,
    playback: 'pingpong',
    pose: (t) => ({
      ...BASE,
      bob: Math.sin(t * Math.PI * 2) * 6,
      squash: 1 - Math.sin(t * Math.PI * 2) * 0.02,
      eyes: t > 0.42 && t < 0.52 ? 'blink' : 'open',
    }),
  },
  smile: {
    label: 'Sonrisa',
    frames: 8,
    fps: 10,
    playback: 'pingpong',
    pose: (t) => ({
      ...BASE,
      bob: Math.sin(t * Math.PI * 2) * 4,
      mouth: t < 0.5 ? 'smile' : 'grin',
      eyes: t < 0.5 ? 'open' : 'happy',
    }),
  },
  joy: {
    label: 'Alegría',
    frames: 8,
    fps: 12,
    playback: 'loop',
    pose: (t) => {
      const jump = Math.abs(Math.sin(t * Math.PI * 2));
      return {
        ...BASE,
        bob: jump * 46,
        squash: 0.96 + jump * 0.08,
        mouth: 'open',
        eyes: 'happy',
      };
    },
  },
  surprise: {
    label: 'Sorpresa',
    frames: 6,
    fps: 10,
    playback: 'pingpong',
    pose: (t) => ({
      ...BASE,
      bob: Math.sin(Math.min(1, t * 1.4) * Math.PI) * 18,
      squash: 1 + Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.08,
      mouth: 'o',
      eyes: 'wide',
      brows: 'raised',
      lookY: 2,
    }),
  },
  sad: {
    label: 'Tristeza',
    frames: 8,
    fps: 8,
    playback: 'pingpong',
    pose: (t) => ({
      ...BASE,
      bob: -8 + Math.sin(t * Math.PI * 2) * 3,
      squash: 0.97,
      mouth: 'frown',
      lookY: 9,
      lookX: Math.sin(t * Math.PI * 2) * 4,
    }),
  },
  annoyed: {
    label: 'Mosqueo',
    frames: 8,
    fps: 10,
    playback: 'pingpong',
    pose: (t) => ({
      ...BASE,
      lean: Math.sin(t * Math.PI * 2) * 5,
      mouth: 'flat',
      brows: 'angry',
      lookX: Math.sin(t * Math.PI * 2) * 7,
    }),
  },
  thinking: {
    label: 'Pensando',
    frames: 8,
    fps: 8,
    playback: 'pingpong',
    pose: (t) => ({
      ...BASE,
      bob: Math.sin(t * Math.PI * 2) * 3,
      mouth: 'flat',
      lookX: 8,
      lookY: -8,
      lean: 4 + Math.sin(t * Math.PI * 2) * 3,
    }),
  },
  wave: {
    label: 'Saludo',
    frames: 8,
    fps: 12,
    playback: 'loop',
    pose: (t) => ({
      ...BASE,
      bob: Math.sin(t * Math.PI * 2) * 5,
      mouth: 'grin',
      eyes: 'happy',
      armRaise: 0.5 + Math.sin(t * Math.PI * 2) * 0.5,
    }),
  },
  nudge: {
    label: 'Codazo',
    frames: 8,
    fps: 10,
    playback: 'pingpong',
    pose: (t) => {
      const sway = Math.sin(t * Math.PI * 2);
      return {
        ...BASE,
        lean: sway * 22,
        squash: 1 - Math.abs(sway) * 0.04,
        mouth: 'grin',
        lookX: sway * 8,
      };
    },
  },
};

// ---------------------------------------------------------------------------

function renderFrame(emotion: EmotionPose, t: number): Uint8Array {
  const ctx = newCtx();
  drawPixel(ctx, emotion(t));
  return encodePng(ctx.buf, W, H);
}

function main(): void {
  const emotions: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(EMOTION_POSES)) {
    const dir = join(OUT, key);
    mkdirSync(dir, { recursive: true });
    const frames = [];
    for (let i = 0; i < spec.frames; i += 1) {
      const name = `${String(i).padStart(3, '0')}.png`;
      const t = spec.playback === 'pingpong' ? i / (spec.frames - 1) : i / spec.frames;
      writeFileSync(join(dir, name), renderFrame(spec.pose, t));
      frames.push({ src: `${key}/${name}`, ms: null, origin: 'gen' });
    }
    emotions[key] = {
      label: spec.label,
      engine: 'raster-frames',
      fps: spec.fps,
      playback: spec.playback,
      frames,
    };
  }

  // Reference frame: the hero pose.
  mkdirSync(join(OUT, 'ref'), { recursive: true });
  writeFileSync(
    join(OUT, 'ref', 'master.png'),
    renderFrame((t) => ({ ...BASE, mouth: 'grin', eyes: 'open', armRaise: t }), 0.8),
  );

  const manifest = {
    schema: 'gruia.character-pack/1',
    id: 'pixel-demo',
    name: 'Pixel',
    brand: 'gruia',
    canvas: { w: W, h: H },
    anchor: { x: ANCHOR_X, y: ANCHOR_Y },
    palette: ['#4A5178', '#6B74A8', '#E8645A', '#FFCF5C', '#FFFFFF', '#26293D'],
    reference: 'ref/master.png',
    defaults: { engine: 'raster-frames', fps: 10, playback: 'loop' },
    emotions,
  };
  writeFileSync(join(OUT, 'pack.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`pixel-demo pack written to ${OUT}`);
}

main();
