// Gallery (F4) unit coverage: the derived-manifest builder — emotions subset,
// frame-count trim, v1.1 schema and v1.1 metadata preservation (oneShot/base).

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GENERATION_OPTIONS,
  deriveResultManifest,
} from '../src/features/characters/gallery/types';
import { CHARACTER_PACK_SCHEMA_V11, type CharacterPack } from '../src/features/characters/pack/types';

function basePack(): CharacterPack {
  return {
    schema: 'gruia.character-pack/1',
    id: 'gruia-grulla',
    name: 'Gui',
    canvas: { w: 512, h: 512 },
    anchor: { x: 256, y: 472 },
    palette: ['#4A5178'],
    defaults: { engine: 'raster-frames', fps: 10, playback: 'loop' },
    emotions: {
      idle: {
        label: 'Respiración',
        engine: 'raster-frames',
        frames: Array.from({ length: 8 }, (_, i) => ({ src: `idle/00${i}.png`, ms: null })),
      },
      triumph: {
        label: 'Celebración',
        engine: 'raster-frames',
        playback: 'once',
        oneShot: true,
        base: 'joy',
        usage: 'celebrar un logro',
        frames: Array.from({ length: 8 }, (_, i) => ({
          src: `triumph/00${i}.png`,
          ms: i === 7 ? 1000 : null,
        })),
      },
    },
  };
}

describe('deriveResultManifest', () => {
  it('clones every emotion by default and stamps v1.1', () => {
    const derived = deriveResultManifest(basePack(), DEFAULT_GENERATION_OPTIONS, 'salta', 'abc');
    expect(derived.schema).toBe(CHARACTER_PACK_SCHEMA_V11);
    expect(Object.keys(derived.emotions).sort()).toEqual(['idle', 'triumph']);
    expect(derived.id).toBe('gruia-grulla-gen-abc');
    expect(derived.name).toBe('Gui · salta');
  });

  it('trims frames to the requested count', () => {
    const derived = deriveResultManifest(
      basePack(),
      { ...DEFAULT_GENERATION_OPTIONS, frameCount: 4 },
      'salta',
      'abc',
    );
    expect(derived.emotions.idle!.frames).toHaveLength(4);
    expect(derived.emotions.triumph!.frames).toHaveLength(4);
  });

  it('keeps only the selected emotions', () => {
    const derived = deriveResultManifest(
      basePack(),
      { ...DEFAULT_GENERATION_OPTIONS, emotions: ['triumph'] },
      'salta',
      'abc',
    );
    expect(Object.keys(derived.emotions)).toEqual(['triumph']);
  });

  it('preserves v1.1 oneShot/base/usage metadata through derivation', () => {
    const derived = deriveResultManifest(basePack(), DEFAULT_GENERATION_OPTIONS, 'salta', 'abc');
    const triumph = derived.emotions.triumph!;
    expect(triumph.oneShot).toBe(true);
    expect(triumph.base).toBe('joy');
    expect(triumph.usage).toBe('celebrar un logro');
    expect(triumph.playback).toBe('once');
    // Sustained pose: the last frame keeps its 1000 ms.
    expect(triumph.frames[7]!.ms).toBe(1000);
  });

  it('never empties an emotion below one frame', () => {
    const derived = deriveResultManifest(
      basePack(),
      { ...DEFAULT_GENERATION_OPTIONS, frameCount: 0 },
      'salta',
      'abc',
    );
    expect(derived.emotions.idle!.frames.length).toBeGreaterThanOrEqual(1);
  });
});
