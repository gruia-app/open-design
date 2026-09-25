// Pack loading — three doors into the same `LoadedPack`:
//   - `loadPackFromBaseUrl` for packs bundled under public/ (the sample pack).
//   - `importPackFromFiles` for a folder picked with `webkitdirectory`.
//   - `importPackFromZip` for a `.zip` dropped on the picker.
// Each returns a validated manifest plus a `resolve` that turns pack-relative
// frame srcs into URLs a canvas engine can draw. Object URLs are created
// lazily and revoked on `dispose`.

import { parseCharacterPack } from '../pack/parse';
import type { CharacterPack } from '../pack/types';
import { openZip } from './zip';

export type PackOrigin = 'bundled' | 'folder' | 'zip' | 'generated';

export interface LoadedPack {
  manifest: CharacterPack;
  origin: PackOrigin;
  /** Where the bytes came from, for the header line. */
  sourceLabel: string;
  /** Deterministic manifest token (`fnv1a` of pack.json). Identifies the pack
   *  revision the editor's IndexedDB records are keyed to. */
  version: string;
  warnings: string[];
  resolve(src: string): Promise<string>;
  /** Raw bytes for a pack-relative file — used by the pack-zip exporter so
   *  edited packs round-trip without re-encoding PNGs. Returns null when the
   *  file is not part of the pack source (e.g. an accepted variant blob). */
  readFile?(src: string): Promise<Blob | null>;
  dispose(): void;
}

export class PackImportError extends Error {
  readonly details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'PackImportError';
    this.details = details;
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

async function parseManifestText(text: string): Promise<{ pack: CharacterPack; warnings: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PackImportError('pack.json is not valid JSON');
  }
  const result = parseCharacterPack(raw);
  if (!result.ok) {
    throw new PackImportError('pack.json did not pass validation', result.errors);
  }
  return { pack: result.pack, warnings: result.warnings };
}

// FNV-1a 32-bit over the manifest text — a deterministic cache-bust token,
// not a security hash. pack.json is always fetched `no-store`, so the token
// tracks the live pack: a regenerated pack ships a new manifest (QC metrics
// are rewritten on each pass) and every frame URL changes with it.
function packVersion(manifestText: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < manifestText.length; i++) {
    hash ^= manifestText.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Deterministic token for an in-memory manifest (gallery results have no
 *  pack.json text on disk). */
export function manifestToken(manifest: CharacterPack): string {
  return packVersion(JSON.stringify(manifest));
}

/** Bundled pack under public/: files resolve to plain URLs, nothing is
 *  fetched until a frame is actually drawn. Frame URLs carry `?v=<manifest
 *  hash>` so browsers/CDNs never serve a stale PNG after a pack regen. */
export async function loadPackFromBaseUrl(baseUrl: string): Promise<LoadedPack> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const response = await fetch(`${base}pack.json`, { cache: 'no-store' });
  if (!response.ok) {
    throw new PackImportError(`no pack.json at ${base} (${response.status})`);
  }
  const manifestText = await response.text();
  const { pack, warnings } = await parseManifestText(manifestText);
  const version = packVersion(manifestText);
  return {
    manifest: pack,
    origin: 'bundled',
    sourceLabel: baseUrl,
    version,
    warnings,
    resolve: async (src) => {
      const path = normalizePath(src);
      return `${base}${path}${path.includes('?') ? '&' : '?'}v=${version}`;
    },
    readFile: async (src) => {
      const path = normalizePath(src);
      const res = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}v=${version}`);
      return res.ok ? res.blob() : null;
    },
    dispose: () => {},
  };
}

interface FileBackedSource {
  files: Map<string, Blob>;
  sourceLabel: string;
  origin: PackOrigin;
}

function makeFileBackedLoadedPack(
  { files, sourceLabel, origin }: FileBackedSource,
  pack: CharacterPack,
  warnings: string[],
  version: string,
): LoadedPack {
  const objectUrls = new Map<string, string>();
  let disposed = false;
  return {
    manifest: pack,
    origin,
    sourceLabel,
    version,
    warnings,
    resolve: async (src) => {
      const key = normalizePath(src);
      const cached = objectUrls.get(key);
      if (cached) return cached;
      if (disposed) throw new PackImportError('this pack was already disposed');
      const blob = files.get(key);
      if (!blob) throw new PackImportError(`missing file in pack: ${src}`);
      const url = URL.createObjectURL(blob);
      objectUrls.set(key, url);
      return url;
    },
    readFile: async (src) => files.get(normalizePath(src)) ?? null,
    dispose: () => {
      disposed = true;
      for (const url of objectUrls.values()) URL.revokeObjectURL(url);
      objectUrls.clear();
    },
  };
}

function packRootPrefix(paths: string[]): string | null {
  const manifest = paths.find((path) => path === 'pack.json' || path.endsWith('/pack.json'));
  if (manifest == null) return null;
  return manifest.slice(0, manifest.length - 'pack.json'.length);
}

/** Folder import: accepts the FileList from an `<input webkitdirectory>` or a
 *  loose File[] drop. The pack root is whichever directory holds pack.json. */
export async function importPackFromFiles(fileList: Iterable<File>): Promise<LoadedPack> {
  const entries = [...fileList].map((file) => ({
    file,
    path: normalizePath(file.webkitRelativePath || file.name),
  }));
  const root = packRootPrefix(entries.map((entry) => entry.path));
  if (root == null) {
    throw new PackImportError('no pack.json found in the picked folder');
  }
  const files = new Map<string, Blob>();
  for (const { file, path } of entries) {
    if (!path.startsWith(root)) continue;
    files.set(path.slice(root.length), file);
  }
  const manifestBlob = files.get('pack.json');
  if (!manifestBlob) throw new PackImportError('no pack.json found in the picked folder');
  const manifestText = await manifestBlob.text();
  const { pack, warnings } = await parseManifestText(manifestText);
  const sourceLabel = root ? root.replace(/\/$/, '') : pack.id;
  return makeFileBackedLoadedPack(
    { files, sourceLabel, origin: 'folder' },
    pack,
    warnings,
    packVersion(manifestText),
  );
}

/** Zip import: reads the archive into memory once (packs are small), then
 *  materializes each file as a Blob under its pack-relative path. */
export async function importPackFromZip(file: Blob, sourceLabel = 'pack.zip'): Promise<LoadedPack> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let archive: ReturnType<typeof openZip>;
  try {
    archive = openZip(bytes);
  } catch (error) {
    throw new PackImportError(error instanceof Error ? error.message : 'could not read the zip');
  }
  const fileEntries = archive.entries.filter((entry) => !entry.name.endsWith('/'));
  const root = packRootPrefix(fileEntries.map((entry) => normalizePath(entry.name)));
  if (root == null) {
    throw new PackImportError('the zip has no pack.json inside');
  }
  const files = new Map<string, Blob>();
  for (const entry of fileEntries) {
    const path = normalizePath(entry.name);
    if (!path.startsWith(root)) continue;
    const data = await archive.read(entry);
    files.set(path.slice(root.length), new Blob([data as BlobPart]));
  }
  const manifestBlob = files.get('pack.json');
  if (!manifestBlob) throw new PackImportError('the zip has no pack.json inside');
  const manifestText = await manifestBlob.text();
  const { pack, warnings } = await parseManifestText(manifestText);
  return makeFileBackedLoadedPack(
    { files, sourceLabel, origin: 'zip' },
    pack,
    warnings,
    packVersion(manifestText),
  );
}
