// «¿Para qué quieres tu personaje?» (G-UX 2) unit coverage: suggested chip
// order and highlighting per goal — the plan contract the stage and the
// goal card rely on.

import { describe, expect, it } from 'vitest';

import { chipOrderFor, GOAL_PLAN, suggestedFor } from '../src/features/characters/gallery/goalPlan';
import { STAGE_CHIP_ORDER } from '../src/features/characters/gallery/stage';

describe('GOAL_PLAN', () => {
  it('suggests four real emotions per goal in the G-UX order', () => {
    expect(GOAL_PLAN.app).toEqual(['wave', 'joy', 'nudge', 'thinking']);
    expect(GOAL_PLAN.video).toEqual(['wave', 'surprise', 'triumph', 'thinking']);
    expect(GOAL_PLAN.brand).toEqual(['smile', 'joy', 'thinking', 'wave']);
    expect(GOAL_PLAN.story).toEqual(['joy', 'sad', 'surprise', 'annoyed']);
    expect(GOAL_PLAN.other).toEqual(['wave', 'joy', 'surprise', 'thinking']);
  });
});

describe('chipOrderFor', () => {
  it('keeps the G-UX order untouched without a goal', () => {
    expect([...chipOrderFor(null)]).toEqual([...STAGE_CHIP_ORDER]);
  });

  it('moves suggested emotions first and keeps the rest in order', () => {
    expect([...chipOrderFor('app')]).toEqual([
      'wave', 'joy', 'nudge', 'thinking',
      'surprise', 'triumph', 'smile', 'sad', 'annoyed', 'idle',
    ]);
    const story = chipOrderFor('story');
    expect([...story.slice(0, 4)]).toEqual(['joy', 'sad', 'surprise', 'annoyed']);
    expect(story).toContain('idle');
    expect(story).toHaveLength(STAGE_CHIP_ORDER.length);
  });
});

describe('suggestedFor', () => {
  it('highlights exactly the plan emotions', () => {
    expect([...suggestedFor('video')].sort()).toEqual(
      ['surprise', 'thinking', 'triumph', 'wave'].sort(),
    );
    expect(suggestedFor(null).size).toBe(0);
  });
});
