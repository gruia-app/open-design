// Personajes: the character-pack review surface. Loads the bundled sample
// pack on /characters, opens an emotion into the player, changes FPS and
// steps frame-by-frame with buttons and arrow keys.

import { expect, test } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { gotoEntryHome } from '@/playwright/amr';
import type { Page } from '@playwright/test';
import { T } from '@/timeouts';

const EMOTION_KEYS = [
  'idle',
  'smile',
  'joy',
  'surprise',
  'sad',
  'annoyed',
  'thinking',
  'wave',
  'nudge',
] as const;

test.describe.configure({ timeout: T.xlong });

test.beforeEach(async ({ page }) => {
  await applyStandardMocks(page);
});

async function gotoCharacters(page: Page, path = '/characters') {
  await gotoEntryHome(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  // The bundled sample pack loads on its own; wait for the grid (or the
  // player, when the path already names an emotion) to materialize.
  await expect(
    page.getByTestId('characters-grid').or(page.getByTestId('characters-player')),
  ).toBeVisible({ timeout: T.long });
}

async function frameIndicatorValue(page: Page): Promise<string> {
  return (await page.getByTestId('characters-frame-indicator').innerText()).trim();
}

test('characters grid shows the nine sample-pack emotions', async ({ page }) => {
  await gotoCharacters(page);
  for (const key of EMOTION_KEYS) {
    await expect(page.getByTestId(`characters-emotion-${key}`)).toBeVisible();
  }
});

test('emotion player changes fps and steps frame by frame', async ({ page }) => {
  await gotoCharacters(page);

  await page.getByTestId('characters-emotion-idle').click();
  await expect(page.getByTestId('characters-player')).toBeVisible();
  await expect(page).toHaveURL(/\/characters\/idle$/);
  await expect(page.getByTestId('characters-canvas')).toBeVisible();
  await expect(page.getByTestId('characters-frame-strip')).toBeVisible();

  // FPS selector: full 4–24 range, change sticks.
  const fps = page.getByTestId('characters-fps');
  await expect(fps.locator('option')).toHaveCount(21);
  await fps.selectOption('24');
  await expect(fps).toHaveValue('24');
  await fps.selectOption('4');
  await expect(fps).toHaveValue('4');

  // Park the playhead on frame 1 so stepping is deterministic.
  await page.getByTestId('characters-play-pause').click(); // pause
  const indicator = page.getByTestId('characters-frame-indicator');
  for (let i = 0; i < 12; i += 1) {
    if ((await frameIndicatorValue(page)).startsWith('1/')) break;
    await page.getByTestId('characters-step-prev').click();
  }
  await expect(indicator).toHaveText(/^1\//);

  // Button step forward.
  await page.getByTestId('characters-step-next').click();
  await expect(indicator).toHaveText(/^2\//);

  // Arrow keys step too.
  await page.keyboard.press('ArrowRight');
  await expect(indicator).toHaveText(/^3\//);
  await page.keyboard.press('ArrowLeft');
  await expect(indicator).toHaveText(/^2\//);

  // Stepping pauses playback; play resumes it.
  await expect(page.getByTestId('characters-play-pause')).toHaveAttribute('aria-label', /play|reproduc/i);
  await page.getByTestId('characters-play-pause').click();
  await expect(page.getByTestId('characters-play-pause')).toHaveAttribute('aria-label', /pause|pausa/i);
});

test('frame strip seeks to the clicked frame', async ({ page }) => {
  await gotoCharacters(page, '/characters/idle');
  await expect(page.getByTestId('characters-player')).toBeVisible();

  const strip = page.getByTestId('characters-frame-strip');
  await expect(strip).toBeVisible();
  const indicator = page.getByTestId('characters-frame-indicator');
  await expect(indicator).toHaveText(/^\d+\/\d+$/);
  const total = Number((await indicator.innerText()).split('/')[1]);
  const frames = strip.locator('button');
  await expect(frames).toHaveCount(total);

  // Park the playhead: strip seek does not pause, and at 8–10 fps the active
  // marker moves on before the assertion polls.
  await page.getByTestId('characters-play-pause').click();
  await frames.nth(5).click();
  await expect(indicator).toHaveText(`6/${total}`);
  await expect(frames.nth(5)).toHaveAttribute('data-active', 'true');
});

test('pack picker switches between bundled characters', async ({ page }) => {
  await gotoCharacters(page);
  const picker = page.getByTestId('characters-pack-select');
  await expect(picker).toBeVisible();
  const first = await picker.inputValue();

  // Another bundled character loads its own manifest and grid.
  const second = first === 'gruia-grulla' ? 'contenido-tinta' : 'gruia-grulla';
  await picker.selectOption(second);
  await expect(page.locator('[class*="packMeta"]')).toContainText(second, {
    timeout: T.medium,
  });
  for (const key of EMOTION_KEYS) {
    await expect(page.getByTestId(`characters-emotion-${key}`)).toBeVisible();
  }
});
