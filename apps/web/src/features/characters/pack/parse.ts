// Validation for character-pack v1 manifests. `parseCharacterPack` accepts
// unknown input (parsed JSON) and returns either a normalized `CharacterPack`
// or a flat list of human-readable errors. Warnings mark tolerated drift —
// unknown emotion keys, unknown engines — that should not block the preview.

import {
  CHARACTER_PACK_SCHEMAS,
  EMOTION_KEYS,
  IMPLEMENTED_ENGINE_IDS,
  RESERVED_ENGINE_IDS,
  type CharacterEmotion,
  type CharacterFrame,
  type CharacterPack,
  type EmotionKey,
  type EngineId,
  type PlaybackMode,
} from './types';

export type PackParseResult =
  | { ok: true; pack: CharacterPack; warnings: string[] }
  | { ok: false; errors: string[] };

const PLAYBACK_MODES: readonly PlaybackMode[] = ['loop', 'pingpong', 'once'];
const KNOWN_EMOTIONS = new Set<string>(EMOTION_KEYS);
const KNOWN_ENGINES = new Set<string>([
  ...IMPLEMENTED_ENGINE_IDS,
  ...RESERVED_ENGINE_IDS,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asPlayback(value: unknown): PlaybackMode | null {
  return typeof value === 'string' && (PLAYBACK_MODES as readonly string[]).includes(value)
    ? (value as PlaybackMode)
    : null;
}

function parseFrame(raw: unknown, where: string, errors: string[]): CharacterFrame | null {
  if (!isRecord(raw)) {
    errors.push(`${where}: frame entry must be an object`);
    return null;
  }
  if (!isNonEmptyString(raw.src)) {
    errors.push(`${where}: frame is missing a non-empty "src"`);
    return null;
  }
  if (raw.src.includes('..') || raw.src.startsWith('/') || raw.src.includes('\\')) {
    errors.push(`${where}: frame src "${raw.src}" must stay inside the pack folder`);
    return null;
  }
  if (raw.ms !== undefined && raw.ms !== null && !isPositiveNumber(raw.ms)) {
    errors.push(`${where}: frame "${raw.src}" has invalid "ms" (expected a positive number or null)`);
    return null;
  }
  const frame: CharacterFrame = {
    src: raw.src,
    ms: (raw.ms ?? null) as number | null,
  };
  if (isNonEmptyString(raw.origin)) frame.origin = raw.origin;
  if (typeof raw.note === 'string' && raw.note.length > 0) frame.note = raw.note;
  if (typeof raw.liked === 'boolean') frame.liked = raw.liked;
  return frame;
}

function parseEmotion(
  key: string,
  raw: unknown,
  warnings: string[],
  errors: string[],
): CharacterEmotion | null {
  const where = `emotions.${key}`;
  if (!isRecord(raw)) {
    errors.push(`${where}: emotion must be an object`);
    return null;
  }
  const engine = isNonEmptyString(raw.engine) ? (raw.engine as EngineId) : null;
  if (!engine) {
    errors.push(`${where}: missing "engine"`);
    return null;
  }
  if (!KNOWN_ENGINES.has(engine)) {
    warnings.push(`${where}: unknown engine "${engine}" — it will show as unavailable`);
  }
  if (raw.fps !== undefined && !isPositiveNumber(raw.fps)) {
    errors.push(`${where}: "fps" must be a positive number`);
    return null;
  }
  if (raw.playback !== undefined && asPlayback(raw.playback) === null) {
    errors.push(`${where}: "playback" must be one of ${PLAYBACK_MODES.join(', ')}`);
    return null;
  }
  if (!Array.isArray(raw.frames) || raw.frames.length === 0) {
    errors.push(`${where}: needs at least one frame`);
    return null;
  }
  const frames: CharacterFrame[] = [];
  raw.frames.forEach((frame, index) => {
    const parsed = parseFrame(frame, `${where}.frames[${index}]`, errors);
    if (parsed) frames.push(parsed);
  });
  if (frames.length === 0) {
    errors.push(`${where}: no usable frames`);
    return null;
  }
  const emotion: CharacterEmotion = {
    label: isNonEmptyString(raw.label) ? raw.label : key,
    engine,
    frames,
  };
  if (raw.fps !== undefined) emotion.fps = raw.fps as number;
  const playback = asPlayback(raw.playback);
  if (playback) emotion.playback = playback;
  if (typeof raw.note === 'string' && raw.note.length > 0) emotion.note = raw.note;
  if (typeof raw.liked === 'boolean') emotion.liked = raw.liked;
  if (isNonEmptyString(raw.base)) emotion.base = raw.base;
  if (typeof raw.oneShot === 'boolean') emotion.oneShot = raw.oneShot;
  if (isNonEmptyString(raw.usage)) emotion.usage = raw.usage;
  return emotion;
}

export function parseCharacterPack(raw: unknown): PackParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ['pack.json is not a JSON object'] };
  }
  if (typeof raw.schema !== 'string' || !CHARACTER_PACK_SCHEMAS.includes(raw.schema)) {
    errors.push(
      `schema must be one of ${CHARACTER_PACK_SCHEMAS.join(', ')} (got ${JSON.stringify(raw.schema ?? null)})`,
    );
  }
  if (!isNonEmptyString(raw.id)) errors.push('missing "id"');
  if (!isNonEmptyString(raw.name)) errors.push('missing "name"');

  const canvas = isRecord(raw.canvas) ? raw.canvas : null;
  if (!canvas || !isPositiveNumber(canvas.w) || !isPositiveNumber(canvas.h)) {
    errors.push('canvas needs positive "w" and "h"');
  }
  const anchor = isRecord(raw.anchor) ? raw.anchor : null;
  if (
    !anchor
    || typeof anchor.x !== 'number'
    || typeof anchor.y !== 'number'
    || !Number.isFinite(anchor.x)
    || !Number.isFinite(anchor.y)
  ) {
    errors.push('anchor needs numeric "x" and "y"');
  }

  const defaults = isRecord(raw.defaults) ? raw.defaults : {};
  const defaultEngine = isNonEmptyString(defaults.engine)
    ? (defaults.engine as EngineId)
    : 'raster-frames';
  if (!KNOWN_ENGINES.has(defaultEngine)) {
    warnings.push(`defaults.engine "${defaultEngine}" is not a known engine`);
  }
  const defaultFps = isPositiveNumber(defaults.fps) ? defaults.fps : 10;
  const defaultPlayback = asPlayback(defaults.playback) ?? 'loop';
  if (defaults.playback !== undefined && asPlayback(defaults.playback) === null) {
    errors.push('defaults.playback must be one of loop, pingpong, once');
  }

  const palette = Array.isArray(raw.palette)
    ? raw.palette.filter((entry): entry is string => typeof entry === 'string')
    : [];

  const emotions: Record<string, CharacterEmotion> = {};
  if (!isRecord(raw.emotions) || Object.keys(raw.emotions).length === 0) {
    errors.push('the pack needs at least one emotion');
  } else {
    for (const [key, value] of Object.entries(raw.emotions)) {
      if (!KNOWN_EMOTIONS.has(key)) {
        warnings.push(`emotions.${key}: not one of the nine canon keys — showing it anyway`);
      }
      const parsed = parseEmotion(key, value, warnings, errors);
      if (parsed) emotions[key as EmotionKey] = parsed;
    }
    if (Object.keys(emotions).length === 0) {
      errors.push('no emotion survived validation');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const pack: CharacterPack = {
    schema: raw.schema as string,
    id: (raw.id as string).trim(),
    name: (raw.name as string).trim(),
    canvas: { w: canvas!.w as number, h: canvas!.h as number },
    anchor: { x: anchor!.x as number, y: anchor!.y as number },
    palette,
    defaults: { engine: defaultEngine, fps: defaultFps, playback: defaultPlayback },
    emotions,
  };
  if (isNonEmptyString(raw.brand)) pack.brand = raw.brand;
  if (isNonEmptyString(raw.reference)) pack.reference = raw.reference;
  if (isRecord(raw.qc)) pack.qc = raw.qc as CharacterPack['qc'];
  if (raw.jobs !== undefined) pack.jobs = raw.jobs;
  return { ok: true, pack, warnings };
}
