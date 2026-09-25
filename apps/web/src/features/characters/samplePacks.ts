// Bundled packs shipped under `apps/web/public/character-packs/`. The
// catalogue is plain data + fetch probing: replacing or adding a pack means
// dropping a folder into `character-packs/` and (at most) a line here — no
// other code changes. `gruia-grulla` (Gui) leads the list so the real pack
// wins as soon as it exists; `pixel-demo` stays the generated fallback.

import { loadPackFromBaseUrl, PackImportError, type LoadedPack } from './import/importPack';

export interface BundledPackEntry {
  /** Directory name under `public/character-packs/`; also the select value. */
  id: string;
  base: string;
}

export const BUNDLED_PACKS: BundledPackEntry[] = [
  { id: 'gruia-grulla', base: '/character-packs/gruia-grulla' },
  { id: 'contenido-tinta', base: '/character-packs/contenido-tinta' },
  { id: 'pixel-demo', base: '/character-packs/pixel-demo' },
];

export interface BundledPackOption extends BundledPackEntry {
  /** pack.json answered and passed validation. */
  available: boolean;
  /** Manifest `name` when loadable, the id while it is not. */
  label: string;
}

/** Fetch every catalogue entry's pack.json once, so the picker can mark
 *  packs that are not on disk yet as unavailable instead of failing late. */
export async function probeBundledPacks(): Promise<BundledPackOption[]> {
  return Promise.all(
    BUNDLED_PACKS.map(async (entry) => {
      try {
        const pack = await loadPackFromBaseUrl(entry.base);
        return { ...entry, available: true, label: pack.manifest.name };
      } catch {
        return { ...entry, available: false, label: entry.id };
      }
    }),
  );
}

export async function loadBundledPack(id: string): Promise<LoadedPack> {
  const entry = BUNDLED_PACKS.find((candidate) => candidate.id === id);
  if (!entry) throw new PackImportError(`unknown bundled pack: ${id}`);
  return loadPackFromBaseUrl(entry.base);
}

/** The first catalogue entry that answers with a valid pack.json becomes the
 *  default pack. */
export async function loadDefaultPack(): Promise<LoadedPack> {
  const failures: string[] = [];
  for (const entry of BUNDLED_PACKS) {
    try {
      return await loadBundledPack(entry.id);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new PackImportError('no bundled character pack answered', failures);
}
