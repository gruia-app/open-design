// Living stage (G-UX change 1) — pure data + timing logic for the gallery
// hero so it stays unit-testable without a canvas: chip order, character
// voice, poke rotation and how many forward passes each emotion plays
// before the character falls back to `idle` ping-pong.

import type { CharacterEmotion, PlaybackMode } from '../pack/types';

/** Emotion chips under the stage, in the exact G-UX order. */
export const STAGE_CHIP_ORDER = [
  'wave',
  'joy',
  'surprise',
  'thinking',
  'nudge',
  'triumph',
  'smile',
  'sad',
  'annoyed',
  'idle',
] as const;

export type StageEmotionKey = (typeof STAGE_CHIP_ORDER)[number];

/** Emotions cycled when the user pokes the character on stage. */
export const POKE_EMOTIONS = ['surprise', 'joy', 'wave'] as const;

export type StageVoice = 'gui' | 'tinta';

/** Bubble voice comes from the pack, not from the UI: Tinta speaks like
 *  Tinta, every other base uses Gui's lines. */
export function voiceForPack(packId: string): StageVoice {
  return packId === 'contenido-tinta' ? 'tinta' : 'gui';
}

export function pokeEmotionAt(pokeIndex: number): (typeof POKE_EMOTIONS)[number] {
  return POKE_EMOTIONS[Math.abs(pokeIndex) % POKE_EMOTIONS.length]!;
}

/** Forward passes a chip/poke emotion plays before returning to idle.
 *  `once` emotions (triumph — oneShot sustained pose) play a single pass;
 *  loop/pingpong emotions play two, matching the prototype and the
 *  «saluda (wave, 2 bucles)» entry contract. */
export function emotionPasses(emotion: CharacterEmotion, fallback: PlaybackMode): number {
  const playback = emotion.playback ?? fallback;
  return playback === 'once' ? 1 : 2;
}

/** Duration in ms of `passes` forward passes through `timelineTotal`. */
export function passesDurationMs(timelineTotal: number, passes: number): number {
  return Math.max(0, timelineTotal) * Math.max(1, passes);
}
