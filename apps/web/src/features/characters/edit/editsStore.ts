// Per-pack edit controller. Owns the pristine baseline, the undo/redo
// history for every emotion, variant blobs accepted from regeneration jobs,
// and the IndexedDB write-behind. Components subscribe per pack; edits made
// in the player are visible when the grid remounts and survive reloads.

import type { CharacterEmotion, CharacterFrame, CharacterPack } from '../pack/types';
import { CHARACTER_PACK_SCHEMA_V11 } from '../pack/types';
import {
  loadExtraFiles,
  loadPackEdits,
  removeExtraFile,
  saveExtraFile,
  savePackEdits,
  editsKey,
  type StoredEmotionEdit,
} from './editsDb';
import { isSessionEditOrigin } from './emotionEdit';
import {
  canRedo,
  canUndo,
  initHistory,
  record,
  redo,
  undo,
  type History,
} from './history';
import type { LoadedPack } from '../import/importPack';

const SAVE_DEBOUNCE_MS = 350;

function cloneEmotion(emotion: CharacterEmotion): CharacterEmotion {
  return {
    ...emotion,
    frames: emotion.frames.map((frame) => ({ ...frame })),
  };
}

function emotionFromStored(edit: StoredEmotionEdit, baseline: CharacterEmotion): CharacterEmotion {
  return {
    ...cloneEmotion(baseline),
    fps: edit.fps ?? undefined,
    note: edit.note,
    liked: edit.liked,
    frames: edit.frames.map((frame) => ({ ...frame })),
  };
}

function emotionToStored(emotion: CharacterEmotion): StoredEmotionEdit {
  const stored: StoredEmotionEdit = { frames: emotion.frames.map((f) => ({ ...f })) };
  if (emotion.fps !== undefined) stored.fps = emotion.fps;
  if (emotion.note) stored.note = emotion.note;
  if (emotion.liked) stored.liked = true;
  return stored;
}

export class EditsController {
  readonly pack: LoadedPack;
  private baseline = new Map<string, CharacterEmotion>();
  private histories = new Map<string, History<CharacterEmotion>>();
  private listeners = new Set<() => void>();
  private extras = new Map<string, Blob>();
  private extraUrls = new Map<string, string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private hydrated = false;
  /** Manifest token captured at hydrate time; falls back to 'local'. */
  version = 'local';

  constructor(pack: LoadedPack) {
    this.pack = pack;
    for (const [key, emotion] of Object.entries(pack.manifest.emotions)) {
      this.baseline.set(key, cloneEmotion(emotion));
    }
    // A pending debounced write dies with the page — flush it when the tab
    // hides or unloads so the last keystroke is not lost.
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.flushSave);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.flushSave();
  };

  /** Same hash the bundler puts on frame URLs — bundled packs only. */
  setVersion(version: string): void {
    if (this.hydrated) return;
    this.version = version;
  }

  /** Pull saved edits for this pack+version and drop them on the histories.
   *  Extra-file blobs are restored too, but only for srcs a present frame
   *  still claims — rows left behind by reverted edits are pruned instead of
   *  resurrecting over the authored image. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const packKey = editsKey(this.pack.manifest.id, this.version);
      const [stored, extras] = await Promise.all([
        loadPackEdits(this.pack.manifest.id, this.version),
        loadExtraFiles(packKey),
      ]);
      if (stored) {
        for (const [key, edit] of Object.entries(stored.emotions)) {
          const baseline = this.baseline.get(key);
          if (!baseline) continue;
          // Stored edits only apply when the frame set still matches the pack
          // version they were saved against — edits are keyed by version, but
          // belt-and-braces for hand-edited manifests.
          this.histories.set(key, initHistory(emotionFromStored(edit, baseline)));
        }
      }
      const claimed = this.claimedExtraSrcs();
      for (const row of extras) {
        if (claimed.has(row.src)) {
          this.extras.set(row.src, row.blob);
        } else {
          void removeExtraFile(packKey, row.src).catch(() => {});
        }
      }
    } catch {
      // IndexedDB unavailable (private mode, quota) — editing still works,
      // it just does not persist.
    }
    this.notify();
  }

  private baselineEmotion(key: string): CharacterEmotion | null {
    return this.baseline.get(key) ?? null;
  }

  /** Pristine emotion as authored in the manifest — the "before" view. */
  baselineFor(key: string): CharacterEmotion | null {
    const baseline = this.baselineEmotion(key);
    return baseline ? cloneEmotion(baseline) : null;
  }

  historyFor(key: string): History<CharacterEmotion> | null {
    const baseline = this.baselineEmotion(key);
    if (!baseline) return null;
    let history = this.histories.get(key);
    if (!history) {
      history = initHistory(cloneEmotion(baseline));
      this.histories.set(key, history);
    }
    return history;
  }

  /** The effective (edited) emotion shown everywhere. */
  emotionFor(key: string): CharacterEmotion | null {
    const history = this.historyFor(key);
    return history ? history.present : null;
  }

  /** True when the current state differs from the authored baseline. */
  isDirty(key: string): boolean {
    const history = this.histories.get(key);
    const baseline = this.baselineEmotion(key);
    if (!history || !baseline) return false;
    return JSON.stringify(history.present) !== JSON.stringify(baseline);
  }

  anyDirty(): boolean {
    for (const key of this.baseline.keys()) {
      if (this.isDirty(key)) return true;
    }
    return false;
  }

  canUndo(key: string): boolean {
    const history = this.histories.get(key);
    return history ? canUndo(history) : false;
  }

  canRedo(key: string): boolean {
    const history = this.histories.get(key);
    return history ? canRedo(history) : false;
  }

  /** Record a mutation on one emotion. The mutator must return the next
   *  emotion (pure ops live in emotionEdit.ts). */
  mutate(key: string, mutator: (emotion: CharacterEmotion) => CharacterEmotion): void {
    const history = this.historyFor(key);
    if (!history) return;
    const next = record(history, mutator(history.present));
    if (next !== history) {
      this.histories.set(key, next);
      this.notify();
      this.scheduleSave();
    }
  }

  undoEmotion(key: string): void {
    const history = this.histories.get(key);
    if (!history || !canUndo(history)) return;
    this.histories.set(key, undo(history));
    this.notify();
    this.scheduleSave();
  }

  redoEmotion(key: string): void {
    const history = this.histories.get(key);
    if (!history || !canRedo(history)) return;
    this.histories.set(key, redo(history));
    this.notify();
    this.scheduleSave();
  }

  /** Reset one emotion back to the authored baseline. */
  resetEmotion(key: string): void {
    const baseline = this.baselineEmotion(key);
    if (!baseline) return;
    this.mutate(key, () => cloneEmotion(baseline));
  }

  /** Srcs whose pixels live in the extras store — every present frame that
   *  carries a session-edit origin claims its canonical src. Frames that
   *  lost that marker (undo, reset, a restored baseline) stop claiming, so a
   *  stored blob can never shadow the authored bytes again. */
  private claimedExtraSrcs(): Set<string> {
    const claimed = new Set<string>();
    for (const key of this.baseline.keys()) {
      const emotion = this.emotionFor(key);
      if (!emotion) continue;
      for (const frame of emotion.frames) {
        if (isSessionEditOrigin(frame.origin)) claimed.add(frame.src);
      }
    }
    return claimed;
  }

  /** Register a blob for a pack-relative src (accepted variants land here so
   *  `resolve` can draw them without a server round-trip). Written through
   *  to IndexedDB so the pixels survive a reload like the structural edits. */
  putExtraFile(src: string, blob: Blob): void {
    this.extras.set(src, blob);
    this.extraUrls.delete(src); // force a fresh object URL on next resolve
    void saveExtraFile(
      editsKey(this.pack.manifest.id, this.version),
      src,
      blob,
    ).catch(() => {});
  }

  /** Resolve like the pack does, but serving accepted-variant blobs first —
   *  and only while a present frame claims the src, so undo/reset restore
   *  the authored image instead of the stored blob. */
  resolve = async (src: string): Promise<string> => {
    const blob = this.extras.get(src);
    if (blob && this.claimedExtraSrcs().has(src)) {
      const cached = this.extraUrls.get(src);
      if (cached) return cached;
      const url = URL.createObjectURL(blob);
      this.extraUrls.set(src, url);
      return url;
    }
    return this.pack.resolve(src);
  };

  /** Accepted-variant blobs keyed by their pack-relative src — enumerated by
   *  the daemon "save to disk" flow so they land inside the pack dir. */
  extraFiles(): Array<[string, Blob]> {
    return [...this.extras.entries()];
  }

  /** Effective manifest with every edit applied — exported as pack v1.1. */
  manifestWithEdits(): CharacterPack {
    const emotions: Record<string, CharacterEmotion> = {};
    for (const [key] of Object.entries(this.pack.manifest.emotions)) {
      emotions[key] = this.emotionFor(key) ?? this.baselineEmotion(key)!;
    }
    return {
      ...this.pack.manifest,
      schema: CHARACTER_PACK_SCHEMA_V11,
      emotions,
    };
  }

  /** Serializes every touched emotion for IndexedDB. */
  private snapshotEdits(): Record<string, StoredEmotionEdit> {
    const emotions: Record<string, StoredEmotionEdit> = {};
    for (const key of this.baseline.keys()) {
      if (this.isDirty(key)) {
        emotions[key] = emotionToStored(this.historyFor(key)!.present);
      }
    }
    return emotions;
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), SAVE_DEBOUNCE_MS);
  }

  private flushSave = (): void => {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    void savePackEdits({
      key: editsKey(this.pack.manifest.id, this.version),
      packId: this.pack.manifest.id,
      packVersion: this.version,
      savedAt: Date.now(),
      emotions: this.snapshotEdits(),
    }).catch(() => {});
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    this.flushSave();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.flushSave);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    for (const url of this.extraUrls.values()) URL.revokeObjectURL(url);
    this.extraUrls.clear();
    this.listeners.clear();
  }
}
