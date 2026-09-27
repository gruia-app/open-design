// Emotion-editor unit tests: pure frame ops, undo/redo history, the edit
// controller's baseline/dirty/manifest contract, and pack v1.1 parsing.

import { describe, expect, it } from 'vitest';

import type { CharacterEmotion, CharacterPack } from '../src/features/characters/pack/types';
import {
  applyVariantFrame,
  duplicateFrame,
  moveFrame,
  nextUploadOrigin,
  removeFrame,
  setEmotionLiked,
  setEmotionNote,
  setEmotionPlayback,
  setEmotionFps,
  setFrameLiked,
  setFrameMs,
  setFrameNote,
} from '../src/features/characters/edit/emotionEdit';
import { canRedo, canUndo, initHistory, record, redo, undo } from '../src/features/characters/edit/history';
import { EditsController } from '../src/features/characters/edit/editsStore';
import type { LoadedPack } from '../src/features/characters/import/importPack';
import { parseCharacterPack } from '../src/features/characters/pack/parse';

function makeEmotion(srcs: string[]): CharacterEmotion {
  return {
    label: 'Joy',
    engine: 'raster-frames',
    frames: srcs.map((src) => ({ src, ms: null })),
  };
}

describe('emotion edit ops', () => {
  it('moves a frame forward and backward', () => {
    const emotion = makeEmotion(['a.png', 'b.png', 'c.png']);
    expect(moveFrame(emotion, 0, 2).frames.map((f) => f.src)).toEqual(['b.png', 'c.png', 'a.png']);
    expect(moveFrame(emotion, 2, 0).frames.map((f) => f.src)).toEqual(['c.png', 'a.png', 'b.png']);
    // Out-of-range / same-index are no-ops returning the same object.
    expect(moveFrame(emotion, 0, 0)).toBe(emotion);
    expect(moveFrame(emotion, 5, 1)).toBe(emotion);
  });

  it('duplicates a frame in place', () => {
    const emotion = makeEmotion(['a.png', 'b.png']);
    const next = duplicateFrame(emotion, 0);
    expect(next.frames.map((f) => f.src)).toEqual(['a.png', 'a.png', 'b.png']);
    expect(next.frames[1]).not.toBe(emotion.frames[0]);
  });

  it('removes a frame but never the last one', () => {
    const emotion = makeEmotion(['a.png', 'b.png']);
    expect(removeFrame(emotion, 0).frames.map((f) => f.src)).toEqual(['b.png']);
    const single = makeEmotion(['only.png']);
    expect(removeFrame(single, 0)).toBe(single);
  });

  it('sets per-frame ms, clearing invalid values to null', () => {
    const emotion = makeEmotion(['a.png']);
    expect(setFrameMs(emotion, 0, 240).frames[0]!.ms).toBe(240);
    expect(setFrameMs(emotion, 0, null).frames[0]!.ms).toBeNull();
    expect(setFrameMs(emotion, 0, -5).frames[0]!.ms).toBeNull();
  });

  it('sets notes and like flags on frames and emotions', () => {
    let emotion = makeEmotion(['a.png', 'b.png']);
    emotion = setFrameNote(emotion, 1, 'check the wing');
    emotion = setFrameLiked(emotion, 0, true);
    emotion = setEmotionNote(emotion, 'review me');
    emotion = setEmotionLiked(emotion, true);
    expect(emotion.frames[1]!.note).toBe('check the wing');
    expect(emotion.frames[0]!.liked).toBe(true);
    expect(emotion.note).toBe('review me');
    expect(emotion.liked).toBe(true);
    // Clearing removes the keys rather than leaving empties.
    emotion = setFrameNote(emotion, 1, '  ');
    emotion = setFrameLiked(emotion, 0, false);
    emotion = setEmotionLiked(emotion, false);
    expect('note' in emotion.frames[1]!).toBe(false);
    expect('liked' in emotion.frames[0]!).toBe(false);
    expect('liked' in emotion).toBe(false);
  });

  it('sets fps and playback', () => {
    let emotion = makeEmotion(['a.png']);
    emotion = setEmotionFps(emotion, 12);
    emotion = setEmotionPlayback(emotion, 'pingpong');
    expect(emotion.fps).toBe(12);
    expect(emotion.playback).toBe('pingpong');
    expect(setEmotionFps(emotion, undefined).fps).toBeUndefined();
  });

  it('applies a variant as replace or append', () => {
    const emotion = makeEmotion(['a.png', 'b.png']);
    const variant = { src: 'jobs/x/out/000.png', ms: null, origin: 'regen:x' };
    expect(applyVariantFrame(emotion, 1, variant).frames[1]!.src).toBe('jobs/x/out/000.png');
    expect(applyVariantFrame(emotion, -1, variant).frames.map((f) => f.src))
      .toEqual(['a.png', 'b.png', 'jobs/x/out/000.png']);
  });

  it('tags manual replacements with a unique upload origin', () => {
    // The emotion cache keys on src+ms+origin — repeated uploads of the same
    // slot must produce distinct identities or the previous image stays drawn.
    let emotion = makeEmotion(['a.png', 'b.png']);
    emotion = applyVariantFrame(emotion, 0, {
      src: 'idle/000.png',
      ms: null,
      origin: nextUploadOrigin(emotion.frames[0]!.origin),
    });
    expect(emotion.frames[0]!.origin).toBe('upload');
    emotion = applyVariantFrame(emotion, 0, {
      src: 'idle/000.png',
      ms: null,
      origin: nextUploadOrigin(emotion.frames[0]!.origin),
    });
    expect(emotion.frames[0]!.origin).toBe('upload#2');
    expect(nextUploadOrigin('regen:job-1')).toBe('upload');
    expect(nextUploadOrigin(undefined)).toBe('upload');
  });
});

describe('edit history', () => {
  it('undoes and redoes snapshots', () => {
    let h = initHistory(1);
    h = record(h, 2);
    h = record(h, 3);
    expect(h.present).toBe(3);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(3);
    expect(canRedo(h)).toBe(false);
  });

  it('clears the redo stack on a new edit', () => {
    let h = initHistory('a');
    h = record(h, 'b');
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = record(h, 'c');
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe('c');
  });

  it('drops identical snapshots', () => {
    const a = { x: 1 };
    let h = initHistory({ x: 1 });
    h = record(h, { x: 1 });
    expect(h.present).not.toBe(a);
    expect(canUndo(h)).toBe(false);
  });
});

function fakeLoadedPack(manifest: CharacterPack): LoadedPack {
  return {
    manifest,
    origin: 'bundled',
    sourceLabel: 'test',
    version: 'v1',
    warnings: [],
    resolve: async (src) => `/${src}`,
    dispose: () => {},
  };
}

function fakeManifest(): CharacterPack {
  return {
    schema: 'gruia.character-pack/1',
    id: 'test-pack',
    name: 'Test',
    canvas: { w: 96, h: 96 },
    anchor: { x: 48, y: 88 },
    palette: [],
    defaults: { engine: 'raster-frames', fps: 10, playback: 'loop' },
    emotions: { joy: makeEmotion(['joy/000.png', 'joy/001.png']) },
  };
}

describe('EditsController', () => {
  it('keeps baseline separate from edits and reports dirty state', () => {
    const controller = new EditsController(fakeLoadedPack(fakeManifest()));
    expect(controller.isDirty('joy')).toBe(false);
    controller.mutate('joy', (e) => duplicateFrame(e, 0));
    expect(controller.isDirty('joy')).toBe(true);
    expect(controller.emotionFor('joy')!.frames).toHaveLength(3);
    expect(controller.baselineFor('joy')!.frames).toHaveLength(2);
  });

  it('undo restores the baseline and clears dirty', () => {
    const controller = new EditsController(fakeLoadedPack(fakeManifest()));
    controller.mutate('joy', (e) => removeFrame(e, 0));
    controller.undoEmotion('joy');
    expect(controller.isDirty('joy')).toBe(false);
    expect(controller.emotionFor('joy')!.frames).toHaveLength(2);
  });

  it('reset reverts to baseline through the undoable path', () => {
    const controller = new EditsController(fakeLoadedPack(fakeManifest()));
    controller.mutate('joy', (e) => removeFrame(e, 0));
    controller.mutate('joy', (e) => setEmotionFps(e, 8));
    controller.resetEmotion('joy');
    expect(controller.emotionFor('joy')!.frames).toHaveLength(2);
    expect(controller.emotionFor('joy')!.fps).toBeUndefined();
    expect(controller.isDirty('joy')).toBe(false);
    // Reset is undoable — it went through the history.
    controller.undoEmotion('joy');
    expect(controller.emotionFor('joy')!.frames).toHaveLength(1);
  });

  it('emits a pack v1.1 manifest carrying the edits', () => {
    const controller = new EditsController(fakeLoadedPack(fakeManifest()));
    controller.mutate('joy', (e) => setFrameLiked(e, 0, true));
    controller.mutate('joy', (e) => setEmotionFps(e, 16));
    const manifest = controller.manifestWithEdits();
    expect(manifest.schema).toBe('gruia.character-pack/1.1');
    expect(manifest.emotions['joy']!.frames[0]!.liked).toBe(true);
    expect(manifest.emotions['joy']!.fps).toBe(16);
    // Original manifest untouched.
    expect(controller.pack.manifest.emotions['joy']!.frames[0]!.liked).toBeUndefined();
  });

  it('serves extra-file blobs before the pack resolver', async () => {
    const controller = new EditsController(fakeLoadedPack(fakeManifest()));
    controller.putExtraFile('jobs/x/out/000.png', new Blob([new Uint8Array([1, 2, 3])]));
    const url = await controller.resolve('jobs/x/out/000.png');
    expect(url.startsWith('blob:')).toBe(true);
    expect(await controller.resolve('joy/000.png')).toBe('/joy/000.png');
  });
});

describe('pack v1.1 parsing', () => {
  it('accepts schema 1.1 with reviewer fields', () => {
    const result = parseCharacterPack({
      schema: 'gruia.character-pack/1.1',
      id: 'test',
      name: 'Test',
      canvas: { w: 96, h: 96 },
      anchor: { x: 48, y: 88 },
      defaults: { engine: 'raster-frames', fps: 10, playback: 'loop' },
      emotions: {
        joy: {
          label: 'Joy',
          engine: 'raster-frames',
          note: 'emotion note',
          liked: true,
          frames: [{ src: 'joy/000.png', ms: null, liked: true, note: 'frame note' }],
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const joy = result.pack.emotions['joy']!;
      expect(joy.note).toBe('emotion note');
      expect(joy.liked).toBe(true);
      expect(joy.frames[0]!.liked).toBe(true);
      expect(joy.frames[0]!.note).toBe('frame note');
    }
  });

  it('still rejects an unknown schema', () => {
    const result = parseCharacterPack({ schema: 'gruia.character-pack/2', id: 'x', name: 'x' });
    expect(result.ok).toBe(false);
  });
});
