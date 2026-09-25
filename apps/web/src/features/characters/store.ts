// Session-level store for the currently loaded pack and its edit controller.
// Route changes between the grid and the player must not force a re-import —
// File blobs and object URLs live for the session, not for a component mount.

import type { LoadedPack } from './import/importPack';
import { EditsController } from './edit/editsStore';

let currentPack: LoadedPack | null = null;
let currentEdits: EditsController | null = null;

export function getCurrentPack(): LoadedPack | null {
  return currentPack;
}

export function getCurrentEdits(): EditsController | null {
  return currentEdits;
}

export function setCurrentPack(pack: LoadedPack | null): void {
  if (currentPack && currentPack !== pack) currentPack.dispose();
  if (currentEdits && currentEdits.pack !== pack) {
    currentEdits.dispose();
    currentEdits = null;
  }
  currentPack = pack;
  if (pack && !currentEdits) {
    currentEdits = new EditsController(pack);
    currentEdits.setVersion(pack.version);
    void currentEdits.hydrate();
  }
}
