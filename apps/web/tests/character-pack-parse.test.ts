// Parser coverage for the character-pack v1 contract: the happy path, the
// per-field errors that must reject a pack, and the tolerated drift
// (reserved engines, unknown emotions) that should only warn.

import { describe, expect, it } from 'vitest';

import { parseCharacterPack } from '../src/features/characters/pack/parse';
import { CHARACTER_PACK_SCHEMA } from '../src/features/characters/pack/types';

function validPack(): Record<string, unknown> {
  return {
    schema: CHARACTER_PACK_SCHEMA,
    id: 'pixel-demo',
    name: 'Pixel',
    canvas: { w: 512, h: 512 },
    anchor: { x: 256, y: 472 },
    palette: ['#4A5178'],
    defaults: { engine: 'raster-frames', fps: 10, playback: 'loop' },
    emotions: {
      idle: {
        label: 'Respiración',
        engine: 'raster-frames',
        fps: 8,
        playback: 'pingpong',
        frames: [
          { src: 'idle/000.png', ms: null },
          { src: 'idle/001.png', ms: 180 },
        ],
      },
    },
  };
}

describe('parseCharacterPack', () => {
  it('accepts a well-formed pack and applies defaults', () => {
    const result = parseCharacterPack(validPack());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pack.id).toBe('pixel-demo');
    expect(result.pack.defaults).toEqual({ engine: 'raster-frames', fps: 10, playback: 'loop' });
    expect(result.pack.emotions.idle?.frames).toHaveLength(2);
    expect(result.pack.emotions.idle?.frames[0]?.ms).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('rejects non-object input and the wrong schema', () => {
    expect(parseCharacterPack(null)).toEqual({ ok: false, errors: ['pack.json is not a JSON object'] });
    const result = parseCharacterPack({ ...validPack(), schema: 'other/2' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('gruia.character-pack/1');
  });

  it('rejects missing identity, canvas, anchor and emotions', () => {
    const result = parseCharacterPack({ schema: CHARACTER_PACK_SCHEMA });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toMatch(/"id"/);
    expect(result.errors.join('\n')).toMatch(/"name"/);
    expect(result.errors.join('\n')).toMatch(/canvas/);
    expect(result.errors.join('\n')).toMatch(/anchor/);
    expect(result.errors.join('\n')).toMatch(/emotion/);
  });

  it('rejects frame srcs that escape the pack folder', () => {
    const pack = validPack();
    (pack.emotions as Record<string, { frames: unknown[] }>).idle!.frames = [
      { src: '../secrets.png', ms: null },
      { src: '/abs/path.png', ms: null },
      { src: 'win\\path.png', ms: null },
    ];
    const result = parseCharacterPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toMatch(/inside the pack folder/);
  });

  it('rejects a bad playback mode', () => {
    const pack = validPack();
    (pack.emotions as Record<string, Record<string, unknown>>).idle!.playback = 'yoyo';
    const result = parseCharacterPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toMatch(/playback/);
  });

  it('rejects non-positive fps', () => {
    const pack = validPack();
    (pack.emotions as Record<string, Record<string, unknown>>).idle!.fps = 0;
    const result = parseCharacterPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toMatch(/fps/);
  });

  it('lets reserved engine ids through so they can render as coming soon', () => {
    const pack = validPack();
    (pack.emotions as Record<string, Record<string, unknown>>).idle!.engine = 'svg-rig';
    const result = parseCharacterPack(pack);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pack.emotions.idle?.engine).toBe('svg-rig');
    expect(result.warnings).toEqual([]);
  });

  it('warns — but does not fail — on unknown engines and extra emotions', () => {
    const pack = validPack();
    (pack.emotions as Record<string, Record<string, unknown>>).idle!.engine = 'unreal';
    (pack.emotions as Record<string, unknown>).sleepy = {
      engine: 'raster-frames',
      frames: [{ src: 'sleepy/000.png', ms: null }],
    };
    const result = parseCharacterPack(pack);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join('\n')).toMatch(/unknown engine "unreal"/);
    expect(result.warnings.join('\n')).toMatch(/sleepy/);
    expect(result.pack.emotions.sleepy).toBeDefined();
  });

  it('requires at least one usable frame per emotion', () => {
    const pack = validPack();
    (pack.emotions as Record<string, unknown>).idle = { engine: 'raster-frames', frames: [] };
    const result = parseCharacterPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toMatch(/at least one frame/);
  });
});
