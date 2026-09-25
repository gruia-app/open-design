// Pure emotion-edit operations — every function takes a CharacterEmotion and
// returns a new one. The editor history stores these snapshots, and the
// persisted pack edits are built from the resulting frame lists.

import type { CharacterEmotion, CharacterFrame } from '../pack/types';

function cloneFrame(frame: CharacterFrame): CharacterFrame {
  return { ...frame };
}

function withFrames(emotion: CharacterEmotion, frames: CharacterFrame[]): CharacterEmotion {
  return { ...emotion, frames };
}

/** Drag-reorder: move the frame at `from` so it lands at `to`. */
export function moveFrame(
  emotion: CharacterEmotion,
  from: number,
  to: number,
): CharacterEmotion {
  const { frames } = emotion;
  if (from === to || from < 0 || to < 0 || from >= frames.length || to >= frames.length) {
    return emotion;
  }
  const next = [...frames];
  const [frame] = next.splice(from, 1);
  next.splice(to, 0, frame!);
  return withFrames(emotion, next);
}

export function duplicateFrame(emotion: CharacterEmotion, index: number): CharacterEmotion {
  const frame = emotion.frames[index];
  if (!frame) return emotion;
  const next = [...emotion.frames];
  next.splice(index + 1, 0, cloneFrame(frame));
  return withFrames(emotion, next);
}

/** Removing the last frame is refused — the pack contract requires ≥1. */
export function removeFrame(emotion: CharacterEmotion, index: number): CharacterEmotion {
  if (emotion.frames.length <= 1 || index < 0 || index >= emotion.frames.length) {
    return emotion;
  }
  return withFrames(emotion, emotion.frames.filter((_, i) => i !== index));
}

export function setFrameMs(
  emotion: CharacterEmotion,
  index: number,
  ms: number | null,
): CharacterEmotion {
  const frame = emotion.frames[index];
  if (!frame) return emotion;
  const clean = ms != null && Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
  const frames = emotion.frames.map((f, i) => (i === index ? { ...f, ms: clean } : f));
  return withFrames(emotion, frames);
}

export function setFrameNote(
  emotion: CharacterEmotion,
  index: number,
  note: string,
): CharacterEmotion {
  const frame = emotion.frames[index];
  if (!frame) return emotion;
  const trimmed = note.trim();
  const frames = emotion.frames.map((f, i) => {
    if (i !== index) return f;
    const next = { ...f };
    if (trimmed) next.note = trimmed;
    else delete next.note;
    return next;
  });
  return withFrames(emotion, frames);
}

export function setFrameLiked(
  emotion: CharacterEmotion,
  index: number,
  liked: boolean,
): CharacterEmotion {
  const frames = emotion.frames.map((f, i) => {
    if (i !== index) return f;
    const next = { ...f };
    if (liked) next.liked = true;
    else delete next.liked;
    return next;
  });
  return withFrames(emotion, frames);
}

export function setEmotionFps(
  emotion: CharacterEmotion,
  fps: number | undefined,
): CharacterEmotion {
  const next = { ...emotion };
  if (fps != null && Number.isFinite(fps) && fps > 0) next.fps = Math.round(fps);
  else delete next.fps;
  return next;
}

export function setEmotionNote(emotion: CharacterEmotion, note: string): CharacterEmotion {
  const next = { ...emotion };
  const trimmed = note.trim();
  if (trimmed) next.note = trimmed;
  else delete next.note;
  return next;
}

export function setEmotionPlayback(
  emotion: CharacterEmotion,
  playback: CharacterEmotion['playback'],
): CharacterEmotion {
  const next = { ...emotion };
  if (playback) next.playback = playback;
  else delete next.playback;
  return next;
}

export function setEmotionLiked(emotion: CharacterEmotion, liked: boolean): CharacterEmotion {
  const next = { ...emotion };
  if (liked) next.liked = true;
  else delete next.liked;
  return next;
}

/** Accept a generated variant: replace the frame at `index` with `frame`,
 *  or insert it at `index` when `index < 0`. */
export function applyVariantFrame(
  emotion: CharacterEmotion,
  index: number,
  frame: CharacterFrame,
): CharacterEmotion {
  const next = [...emotion.frames];
  if (index >= 0 && index < next.length) next[index] = { ...frame };
  else next.splice(Math.max(0, index < 0 ? next.length : index), 0, { ...frame });
  return withFrames(emotion, next);
}
