// Engine registry — one CharacterEngine per id. Reserved ids register no
// implementation; `engineStatus` reports them as coming soon so the UI can
// badge those emotions instead of failing the whole pack.

import { IMPLEMENTED_ENGINE_IDS, RESERVED_ENGINE_IDS, type EngineId } from '../pack/types';
import type { CharacterEngine } from './types';

export type EngineStatus = 'ready' | 'coming-soon' | 'unknown';

const engines = new Map<string, CharacterEngine>();

export function registerEngine(engine: CharacterEngine): void {
  engines.set(engine.id, engine);
}

export function getEngine(id: EngineId): CharacterEngine | undefined {
  return engines.get(id);
}

export function engineStatus(id: EngineId): EngineStatus {
  if (engines.has(id)) return 'ready';
  if ((RESERVED_ENGINE_IDS as readonly string[]).includes(id)) return 'coming-soon';
  return 'unknown';
}

export function isReservedEngineId(id: string): boolean {
  return (RESERVED_ENGINE_IDS as readonly string[]).includes(id);
}

export function isImplementedEngineId(id: string): boolean {
  return (IMPLEMENTED_ENGINE_IDS as readonly string[]).includes(id);
}

export function listEngineIds(): string[] {
  return [...engines.keys()];
}
