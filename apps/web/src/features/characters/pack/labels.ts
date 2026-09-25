// Localized emotion labels: the canonical keys ship a UI translation
// (es-ES «Triunfo», …); unknown/custom emotion keys fall back to the
// manifest's own `label`.

import { EMOTION_KEYS } from './types';
import type { useT } from '../../../i18n';

type T = ReturnType<typeof useT>;

const CANONICAL = new Set<string>(EMOTION_KEYS);

export function emotionLabel(t: T, key: string, fallback: string): string {
  if (!CANONICAL.has(key)) return fallback;
  return t(`characters.emotionLabel.${key}` as Parameters<T>[0]);
}
