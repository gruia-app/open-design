// Living stage (G-UX 1) unit coverage: chip order, character voice, poke
// rotation and pass counting — the contract the canvas loop and the
// «primer valor» meta hook rely on.

import { describe, expect, it } from 'vitest';

import {
  emotionPasses,
  passesDurationMs,
  pokeEmotionAt,
  STAGE_CHIP_ORDER,
  voiceForPack,
} from '../src/features/characters/gallery/stage';
import type { CharacterEmotion } from '../src/features/characters/pack/types';

function emotion(playback?: 'loop' | 'pingpong' | 'once'): CharacterEmotion {
  return {
    label: 'x',
    engine: 'raster-frames',
    ...(playback ? { playback } : {}),
    frames: [{ src: 'a/000.png', ms: null }],
  };
}

describe('STAGE_CHIP_ORDER', () => {
  it('matches the exact G-UX chip order', () => {
    expect([...STAGE_CHIP_ORDER]).toEqual([
      'wave', 'joy', 'surprise', 'thinking', 'nudge',
      'triumph', 'smile', 'sad', 'annoyed', 'idle',
    ]);
  });
});

describe('voiceForPack', () => {
  it('gives Tinta her own voice and every other base Gui', () => {
    expect(voiceForPack('contenido-tinta')).toBe('tinta');
    expect(voiceForPack('gruia-grulla')).toBe('gui');
    expect(voiceForPack('pixel-demo')).toBe('gui');
  });
});

describe('pokeEmotionAt', () => {
  it('cycles surprise → joy → wave', () => {
    expect([0, 1, 2, 3, 4].map(pokeEmotionAt)).toEqual([
      'surprise', 'joy', 'wave', 'surprise', 'joy',
    ]);
  });
});

describe('emotionPasses', () => {
  it('plays loop/pingpong emotions twice and once-emotions a single pass', () => {
    expect(emotionPasses(emotion('loop'), 'loop')).toBe(2);
    expect(emotionPasses(emotion('pingpong'), 'loop')).toBe(2);
    expect(emotionPasses(emotion('once'), 'loop')).toBe(1);
    expect(emotionPasses(emotion(), 'once')).toBe(1);
    expect(emotionPasses(emotion(), 'loop')).toBe(2);
  });
});

describe('passesDurationMs', () => {
  it('scales the timeline total by the pass count', () => {
    expect(passesDurationMs(800, 2)).toBe(1600);
    expect(passesDurationMs(800, 1)).toBe(800);
    expect(passesDurationMs(0, 2)).toBe(0);
  });
});
