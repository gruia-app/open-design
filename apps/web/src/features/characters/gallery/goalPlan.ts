// «¿Para qué quieres tu personaje?» (G-UX change 2) — pure data for the
// goal card so the ordering/highlighting rules stay unit-testable without a
// DOM: which emotions each goal suggests first, and the four suggested
// emotions rendered in the «Te preparo estas emociones» plan.

import { STAGE_CHIP_ORDER } from './stage';

export const GOAL_IDS = ['app', 'video', 'brand', 'story', 'other'] as const;
export type GoalId = (typeof GOAL_IDS)[number];

/** Suggested emotions per goal, in plan order (G-UX 2 table). */
export const GOAL_PLAN: Record<GoalId, readonly string[]> = {
  app: ['wave', 'joy', 'nudge', 'thinking'],
  video: ['wave', 'surprise', 'triumph', 'thinking'],
  brand: ['smile', 'joy', 'thinking', 'wave'],
  story: ['joy', 'sad', 'surprise', 'annoyed'],
  other: ['wave', 'joy', 'surprise', 'thinking'],
};

/** Chip order with the goal's suggested emotions first; the rest keep the
 *  original G-UX order. No goal → untouched order. */
export function chipOrderFor(goal: GoalId | null): readonly string[] {
  if (!goal) return STAGE_CHIP_ORDER;
  const suggested = GOAL_PLAN[goal].filter((key) =>
    (STAGE_CHIP_ORDER as readonly string[]).includes(key),
  );
  const rest = STAGE_CHIP_ORDER.filter((key) => !suggested.includes(key));
  return [...suggested, ...rest];
}

/** Set of chips to highlight once a goal is chosen. */
export function suggestedFor(goal: GoalId | null): ReadonlySet<string> {
  return new Set(goal ? GOAL_PLAN[goal] : []);
}
