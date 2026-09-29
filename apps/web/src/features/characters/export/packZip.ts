// Edited-pack export — materializes the effective manifest (pack v1.1) plus
// every referenced file into a .zip the importer can read back, so an edited
// pack survives outside IndexedDB. Variant blobs stored in the edits
// controller are included under their pack-relative src.

import type { LoadedPack } from '../import/importPack';
import type { EditsController } from '../edit/editsStore';
import { buildZip, type ZipWriteEntry } from './zipWriter';
import { downloadBlob } from './spritesheet';

export async function buildEditedPackZip(
  pack: LoadedPack,
  edits: EditsController,
): Promise<{ fileName: string; blob: Blob }> {
  const manifest = edits.manifestWithEdits();
  const entries: ZipWriteEntry[] = [];
  const encoder = new TextEncoder();

  entries.push({
    name: 'pack.json',
    data: encoder.encode(JSON.stringify(manifest, null, 2)),
  });

  // Every file the manifest can reference: frame srcs + the reference image.
  const srcs = new Set<string>();
  for (const emotion of Object.values(manifest.emotions)) {
    for (const frame of emotion.frames) srcs.add(frame.src);
  }
  if (manifest.reference) srcs.add(manifest.reference);

  for (const src of srcs) {
    // Session edits (uploads, accepted regen proposals) register a blob under
    // the same canonical src — the override wins over the authored bytes.
    let blob = edits.extraFile(src) ?? (await pack.readFile?.(src) ?? null);
    if (!blob) {
      // Accepted variants live in the edits controller, not the pack source —
      // resolve them and re-read the blob from its object URL.
      const url = await edits.resolve(src);
      const res = await fetch(url);
      blob = res.ok ? await res.blob() : null;
    }
    if (!blob) continue; // tolerate missing files; the importer warns via parse
    entries.push({ name: src, data: new Uint8Array(await blob.arrayBuffer()) });
  }

  const bytes = buildZip(entries);
  const fileName = `${manifest.id}-edited.zip`;
  return { fileName, blob: new Blob([bytes as BlobPart], { type: 'application/zip' }) };
}

export async function downloadEditedPackZip(
  pack: LoadedPack,
  edits: EditsController,
): Promise<void> {
  const { fileName, blob } = await buildEditedPackZip(pack, edits);
  downloadBlob(fileName, blob);
}
