// Personajes F4 gallery on the static export: the revid-style entry surface
// is the landing view — one input + «Generar», animated starters (Gui and
// Tinta), collapsed advanced options, and result cards that carry likes and
// notes. The review grid (and with it the frame editor) only appears once a
// result exists.

import { test, expect } from '@playwright/test';
import type { Server } from 'node:http';
import { T } from '@/timeouts';
import { serveCharactersStaticExport } from '@/playwright/static-export';

test.describe.configure({ timeout: 10 * 60_000 });

let server: Server;
let baseUrl: string;

test.beforeAll(async () => {
  const served = await serveCharactersStaticExport();
  server = served.server;
  baseUrl = served.baseUrl;
});

test.afterAll(async () => {
  await new Promise((resolvePromise) => server.close(resolvePromise));
});

test('gallery lands first, generates a result, and the editor opens from it', async ({ page }) => {
  await page.goto(`${baseUrl}/characters`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });

  // One input + one «Generar» button on top; no grid/editor before results.
  const gallery = page.getByTestId('characters-gallery');
  await expect(gallery).toBeVisible();
  await expect(page.getByTestId('characters-generate-input')).toBeVisible();
  await expect(page.getByTestId('characters-generate')).toBeDisabled();
  await expect(page.getByTestId('characters-grid')).toHaveCount(0);
  await expect(page.getByTestId('emotion-editor')).toHaveCount(0);

  // Animated starters for the characters that already work.
  await expect(page.getByTestId('characters-starter-gruia-grulla')).toBeVisible();
  await expect(page.getByTestId('characters-starter-contenido-tinta')).toBeVisible();

  // Advanced options collapsed by default; frame count defaults to 8.
  const advanced = page.getByTestId('characters-advanced');
  await expect(advanced).toBeVisible();
  await expect(advanced).not.toHaveAttribute('open', '');
  await expect(page.getByTestId('characters-adv-frames')).toBeHidden();
  await advanced.locator('summary').click();
  await expect(page.getByTestId('characters-adv-frames')).toHaveValue('8');
  await expect(page.getByTestId('characters-adv-engine')).toHaveValue('raster-frames');
  await expect(page.getByTestId('characters-adv-emotions')).toBeVisible();

  // Pick Tinta as the base and generate from a phrase.
  await page.getByTestId('characters-starter-contenido-tinta').click();
  await page.getByTestId('characters-generate-input').fill('una tinta que celebra');
  await page.getByTestId('characters-generate').click();

  const results = page.getByTestId('characters-results');
  await expect(results).toBeVisible();
  const card = results.locator('[data-testid^="characters-result-"]').first();
  await expect(card).toBeVisible();

  // r150 meta question: appears once, warm and skippable — answer «app».
  const meta = page.getByTestId('characters-meta');
  await expect(meta).toBeVisible();
  await expect(page.getByTestId('characters-meta-question')).toContainText(/para qué/i);
  await page.getByTestId('characters-meta-app').click();
  await expect(meta).toHaveCount(0);

  // The card now carries the goal CTA («Exportar para tu app») plus the
  // always-on Roberto CTA.
  const cardId = (await card.getAttribute('data-testid'))!.replace('characters-result-', '');
  const cta = page.getByTestId(`characters-meta-cta-app-${cardId}`);
  await expect(cta).toBeVisible();
  await expect(card).toContainText('Construimos tu app con Roberto');

  // Likes and notes on the card (v1.1 fields).
  await card.locator('[data-testid^="characters-result-like-"]').click();
  await card.locator('[data-testid^="characters-result-note-"]').fill('nota de prueba');
  // The note write is debounced (400 ms) — let it land before navigating.
  await page.waitForTimeout(700);

  // «Exportar para tu app» opens the result straight into the player, where
  // the export buttons live.
  await cta.click();
  await expect(page.getByTestId('characters-player')).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('characters-canvas')).toBeVisible();
  await expect(page.getByTestId('emotion-editor')).toBeVisible();

  // Exporting the pack counts the character as used outside design.
  const download = page.waitForEvent('download');
  await page.getByTestId('characters-export-zip').click();
  await download;

  // Back at the gallery the card shows the discreet exported mark.
  await page.goto(`${baseUrl}/characters`);
  await expect(results).toBeVisible({ timeout: T.long });
  await expect(
    page.getByTestId('characters-results').locator('[data-testid^="characters-result-"]').first(),
  ).toContainText('Exportado');

  // Reload: meta stays answered (no re-ask), CTA + like + note persist.
  await page.reload();
  await expect(page.getByTestId('characters-meta')).toHaveCount(0);
  await expect(page.getByTestId(`characters-meta-cta-app-${cardId}`)).toBeVisible();
  const persisted = page.getByTestId('characters-results').locator('[data-testid^="characters-result-note-"]');
  await expect(persisted.first()).toHaveValue('nota de prueba');
  await expect(
    page.getByTestId('characters-results').locator('[data-testid^="characters-result-like-"]').first(),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('living stage greets, reacts to chips and pokes, and speaks in the base voice', async ({ page }) => {
  await page.goto(`${baseUrl}/characters`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });

  // The stage is the first thing in the gallery: canvas + speech bubble +
  // the «Hazle sentir algo» chips in the G-UX order.
  const stage = page.getByTestId('characters-stage');
  await expect(stage).toBeVisible();
  const bubble = page.getByTestId('characters-bubble');
  await expect(bubble).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('characters-bubble-text')).toContainText('Soy Gui');
  await expect(stage).toContainText('Hazle sentir algo');
  const chipButtons = page.getByTestId('characters-emo-chips').locator('button');
  await expect(chipButtons).toHaveCount(10);
  await expect(chipButtons.nth(0)).toHaveAttribute('data-testid', 'characters-emo-wave');
  await expect(chipButtons.nth(9)).toHaveAttribute('data-testid', 'characters-emo-idle');

  // Tapping an emotion plays it and updates the bubble in Gui's voice.
  await page.getByTestId('characters-emo-joy').click();
  await expect(page.getByTestId('characters-bubble-text')).toContainText('Yuju');
  await expect(page.getByTestId('characters-emo-joy')).toHaveAttribute('aria-pressed', 'true');

  // Poking the character makes it react too.
  await page.getByTestId('characters-stage-canvas').click();
  await expect(page.getByTestId('characters-bubble-text')).toContainText('cosquillas');

  // Switching the base to Tinta switches the stage voice.
  await page.getByTestId('characters-starter-contenido-tinta').click();
  await expect(page.getByTestId('characters-bubble-text')).toContainText('Tinta');
});

test('mobile 390px: prompt field spans its own row and nothing overflows horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/characters`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  const gallery = page.getByTestId('characters-gallery');
  await expect(gallery).toBeVisible();

  // The field gets its own full-width row — at least 90% of the gallery
  // container (the R140 report left it squeezed to ~47% with a clipped
  // placeholder).
  const input = page.getByTestId('characters-generate-input');
  await expect(input).toBeVisible();
  const galleryBox = await gallery.boundingBox();
  const inputBox = await input.boundingBox();
  expect(galleryBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(inputBox!.width).toBeGreaterThanOrEqual(galleryBox!.width * 0.9);

  // The attach and Generar buttons sit below the field, each a ≥44px
  // touch target.
  const attach = page.getByTestId('characters-generate-attach');
  const generate = page.getByTestId('characters-generate');
  const attachBox = await attach.boundingBox();
  const generateBox = await generate.boundingBox();
  expect(attachBox).not.toBeNull();
  expect(generateBox).not.toBeNull();
  expect(attachBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
  expect(generateBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
  expect(attachBox!.height).toBeGreaterThanOrEqual(44);
  expect(generateBox!.height).toBeGreaterThanOrEqual(44);
  expect(attachBox!.width).toBeGreaterThanOrEqual(44);

  // No horizontal scroll anywhere in the document at 390px.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
