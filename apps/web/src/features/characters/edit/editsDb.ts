// IndexedDB persistence for editor state and regeneration jobs. Two object
// stores: `edits` keyed by `${packId}@${manifestVersion}` and `jobs` keyed by
// job id with a `pack` index so the queue survives reloads on both static
// previews and daemon-backed sessions.

import type { CharacterFrame } from '../pack/types';
import type { RegenJob } from '../jobs/jobTypes';
import type { GenerationResult } from '../gallery/types';

export interface StoredEmotionEdit {
  frames: CharacterFrame[];
  fps?: number | null;
  note?: string;
  liked?: boolean;
}

export interface StoredPackEdits {
  /** `${packId}@${packVersion}` — edits are pinned to the manifest they were
   *  made against so a regenerated pack never inherits stale structure. */
  key: string;
  packId: string;
  packVersion: string;
  savedAt: number;
  emotions: Record<string, StoredEmotionEdit>;
}

const DB_NAME = 'od-personajes';
const DB_VERSION = 3;
const STORE_EDITS = 'edits';
const STORE_JOBS = 'jobs';
const STORE_RESULTS = 'results';
const STORE_EXTRAS = 'extras';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_EDITS)) {
          db.createObjectStore(STORE_EDITS);
        }
        if (!db.objectStoreNames.contains(STORE_JOBS)) {
          const jobs = db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
          jobs.createIndex('pack', 'packId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_RESULTS)) {
          db.createObjectStore(STORE_RESULTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_EXTRAS)) {
          const extras = db.createObjectStore(STORE_EXTRAS, { keyPath: 'key' });
          extras.createIndex('pack', 'packKey', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
    });
  }
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const result = requestToPromise(run(tx.objectStore(storeName)));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'));
  });
  return result;
}

export function editsKey(packId: string, packVersion: string): string {
  return `${packId}@${packVersion}`;
}

export async function loadPackEdits(
  packId: string,
  packVersion: string,
): Promise<StoredPackEdits | null> {
  const key = editsKey(packId, packVersion);
  const stored = await withStore(STORE_EDITS, 'readonly', (store) =>
    store.get(key) as IDBRequest<StoredPackEdits | undefined>,
  );
  return stored ?? null;
}

export async function savePackEdits(edits: StoredPackEdits): Promise<void> {
  await withStore(STORE_EDITS, 'readwrite', (store) => store.put(edits, edits.key));
}

// Extra files — blob overrides registered by the editor (manual frame
// uploads, accepted regen proposals). They are keyed by pack+version like
// the structural edits so a regenerated pack never picks up stale bytes;
// the controller prunes rows no present frame claims on hydrate.

export interface StoredExtraFile {
  /** `${packKey}\0${src}` — NUL cannot appear in a pack-relative path. */
  key: string;
  packKey: string;
  src: string;
  blob: Blob;
}

export function extraFileKey(packKey: string, src: string): string {
  return `${packKey}\0${src}`;
}

export async function saveExtraFile(
  packKey: string,
  src: string,
  blob: Blob,
): Promise<void> {
  const record: StoredExtraFile = { key: extraFileKey(packKey, src), packKey, src, blob };
  await withStore(STORE_EXTRAS, 'readwrite', (store) => store.put(record));
}

export async function loadExtraFiles(packKey: string): Promise<StoredExtraFile[]> {
  const rows = await withStore(STORE_EXTRAS, 'readonly', (store) =>
    store.index('pack').getAll(packKey) as IDBRequest<StoredExtraFile[]>,
  );
  return rows;
}

export async function removeExtraFile(packKey: string, src: string): Promise<void> {
  await withStore(STORE_EXTRAS, 'readwrite', (store) =>
    store.delete(extraFileKey(packKey, src)),
  );
}

export async function saveJob(job: RegenJob): Promise<void> {
  await withStore(STORE_JOBS, 'readwrite', (store) => store.put(job));
}

export async function loadJobs(packId: string): Promise<RegenJob[]> {
  const jobs = await withStore(STORE_JOBS, 'readonly', (store) =>
    store.index('pack').getAll(packId) as IDBRequest<RegenJob[]>,
  );
  return jobs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function removeJob(jobId: string): Promise<void> {
  await withStore(STORE_JOBS, 'readwrite', (store) => store.delete(jobId));
}

// Gallery results — derived packs generated from a working base (F4). The
// manifest travels inside the record so a result reopens without the base
// pack being present; frame bytes still resolve through the base pack's
// resolver since the srcs are shared.

export async function saveResult(result: GenerationResult): Promise<void> {
  await withStore(STORE_RESULTS, 'readwrite', (store) => store.put(result));
}

export async function loadResults(): Promise<GenerationResult[]> {
  const results = await withStore(STORE_RESULTS, 'readonly', (store) =>
    store.getAll() as IDBRequest<GenerationResult[]>,
  );
  return results.sort((a, b) => b.createdAt - a.createdAt);
}

export async function removeResult(id: string): Promise<void> {
  await withStore(STORE_RESULTS, 'readwrite', (store) => store.delete(id));
}
