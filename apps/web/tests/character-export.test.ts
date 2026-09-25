// Export-format unit tests: zip writer round-trips through the existing
// reader, GIF/APNG encoders produce real container bytes from raw RGBA
// frames, and the animated-WebP muxer emits a valid RIFF/ANMF container.

import { describe, expect, it } from 'vitest';

import { buildZip } from '../src/features/characters/export/zipWriter';
import { openZip } from '../src/features/characters/import/zip';
import { encodeApng, encodeGif, effectiveFrameOrder } from '../src/features/characters/export/animated';
import { extractFrameData, muxAnimatedWebp } from '../src/features/characters/export/webpAnim';
import type { RgbaFrame } from '../src/features/characters/export/animated';

function rgba(width: number, height: number, fill: number[]): Uint8ClampedArray<ArrayBuffer> {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0]!;
    data[i + 1] = fill[1]!;
    data[i + 2] = fill[2]!;
    data[i + 3] = fill[3]!;
  }
  return data as Uint8ClampedArray<ArrayBuffer>;
}

const FRAMES: RgbaFrame[] = [
  { data: rgba(4, 4, [255, 0, 0, 255]), delayMs: 100 },
  { data: rgba(4, 4, [0, 255, 0, 255]), delayMs: 200 },
];

describe('zip writer', () => {
  it('round-trips through the pack zip reader', async () => {
    const manifest = new TextEncoder().encode('{"schema":"test"}');
    const bytes = buildZip([
      { name: 'pack.json', data: manifest },
      { name: 'joy/000.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
    ]);
    const archive = openZip(bytes);
    expect(archive.entries.map((e) => e.name).sort()).toEqual(['joy/000.png', 'pack.json']);
    const manifestEntry = archive.entries.find((e) => e.name === 'pack.json')!;
    expect(await archive.read(manifestEntry)).toEqual(manifest);
    const pngEntry = archive.entries.find((e) => e.name === 'joy/000.png')!;
    expect(await archive.read(pngEntry)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  });
});

describe('GIF encoder', () => {
  it('emits a GIF89a with both frames', () => {
    const bytes = encodeGif(FRAMES, 4, 4);
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a');
    expect(bytes[bytes.length - 1]).toBe(0x3b); // trailer
    expect(bytes.length).toBeGreaterThan(40);
  });
});

describe('APNG encoder', () => {
  it('emits a PNG signature with animation chunks', () => {
    const buffer = encodeApng(FRAMES, 4, 4);
    const bytes = new Uint8Array(buffer);
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('acTL'); // animation control — proves it is APNG, not PNG
    expect(text).toContain('fcTL');
  });
});

describe('animated WebP muxer', () => {
  // Minimal still WebP: RIFF header + a fake VP8 chunk.
  function fakeStill(tag: string): Uint8Array {
    const vp8 = new Uint8Array(8 + 4);
    vp8.set([tag.charCodeAt(0), tag.charCodeAt(1), tag.charCodeAt(2), tag.charCodeAt(3)], 0);
    new DataView(vp8.buffer).setUint32(4, 4, true);
    vp8.set([1, 2, 3, 4], 8);
    const file = new Uint8Array(12 + vp8.length);
    file.set([0x52, 0x49, 0x46, 0x46], 0);
    new DataView(file.buffer).setUint32(4, 4 + vp8.length, true);
    file.set([0x57, 0x45, 0x42, 0x50], 8);
    file.set(vp8, 12);
    return file;
  }

  it('extracts the VP8 chunk from a still WebP', () => {
    const still = fakeStill('VP8 ');
    const extracted = extractFrameData(still);
    expect(String.fromCharCode(...extracted.image.subarray(0, 4))).toBe('VP8 ');
    expect(extracted.image.length).toBe(12);
    expect(extracted.hasAlpha).toBe(false);
  });

  it('demuxes VP8X-wrapped stills (ALPH + VP8) like Chromium emits', () => {
    // Still with alpha: RIFF WEBP + VP8X + ALPH + VP8 — what canvas.toBlob
    // produces for frames with transparency.
    const vp8x = new Uint8Array(18);
    vp8x.set([0x56, 0x50, 0x38, 0x58], 0); // 'VP8X'
    new DataView(vp8x.buffer).setUint32(4, 10, true);
    const alph = new Uint8Array(10); // 8-byte header + 1 byte payload + 1 pad
    alph.set([0x41, 0x4c, 0x50, 0x48], 0); // 'ALPH'
    new DataView(alph.buffer).setUint32(4, 1, true); // odd size → padded
    const vp8 = new Uint8Array(12);
    vp8.set([0x56, 0x50, 0x38, 0x20], 0); // 'VP8 '
    new DataView(vp8.buffer).setUint32(4, 4, true);
    const body = vp8x.length + alph.length + vp8.length;
    const file = new Uint8Array(12 + body);
    file.set([0x52, 0x49, 0x46, 0x46], 0);
    new DataView(file.buffer).setUint32(4, 4 + body, true);
    file.set([0x57, 0x45, 0x42, 0x50], 8);
    file.set(vp8x, 12);
    file.set(alph, 12 + vp8x.length);
    file.set(vp8, 12 + vp8x.length + alph.length);

    const extracted = extractFrameData(file);
    expect(extracted.hasAlpha).toBe(true);
    expect(String.fromCharCode(...extracted.image.subarray(0, 4))).toBe('ALPH');
    expect(extracted.image.includes(0x20)).toBe(true); // 'VP8 ' follows ALPH
  });

  it('wraps stills in VP8X + ANIM + ANMF chunks', () => {
    const out = muxAnimatedWebp(
      [
        { bytes: fakeStill('VP8 '), delayMs: 100 },
        { bytes: fakeStill('VP8 '), delayMs: 200 },
      ],
      96,
      96,
    );
    expect(String.fromCharCode(...out.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...out.subarray(8, 12))).toBe('WEBP');
    const text = new TextDecoder('latin1').decode(out);
    expect(text).toContain('VP8X');
    expect(text).toContain('ANIM');
    expect(text.match(/ANMF/g)).toHaveLength(2);
    // RIFF length field covers the whole file minus its own 8-byte header.
    const riffSize = new DataView(out.buffer).getUint32(4, true);
    expect(riffSize).toBe(out.length - 8);
  });

  it('rejects non-WebP input', () => {
    expect(() => extractFrameData(new Uint8Array(20))).toThrow(/WebP/);
    expect(() => muxAnimatedWebp([], 4, 4)).toThrow(/no frames/);
  });
});

describe('effectiveFrameOrder', () => {
  it('flattens ping-pong into the played order', () => {
    expect(effectiveFrameOrder(4, 'pingpong')).toEqual([0, 1, 2, 3, 2, 1]);
    expect(effectiveFrameOrder(4, 'loop')).toEqual([0, 1, 2, 3]);
    expect(effectiveFrameOrder(1, 'pingpong')).toEqual([0]);
  });
});
