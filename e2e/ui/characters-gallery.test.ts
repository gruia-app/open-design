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

  // Likes and notes on the card (v1.1 fields).
  await card.locator('[data-testid^="characters-result-like-"]').click();
  await card.locator('[data-testid^="characters-result-note-"]').fill('nota de prueba');
  // The note write is debounced (400 ms) — let it land before navigating.
  await page.waitForTimeout(700);

  // Opening the result mounts the review surface — grid, then player + editor.
  await card.locator('[data-testid^="characters-result-open-"]').click();
  await expect(page.getByTestId('characters-grid')).toBeVisible();
  await page.getByTestId('characters-emotion-joy').click();
  await expect(page.getByTestId('characters-player')).toBeVisible();
  await expect(page.getByTestId('emotion-editor')).toBeVisible();

  // Reload: the result survives (IndexedDB) with its like and note.
  await page.goto(`${baseUrl}/characters`);
  await expect(results).toBeVisible({ timeout: T.long });
  const persisted = page.getByTestId('characters-results').locator('[data-testid^="characters-result-note-"]');
  await expect(persisted.first()).toHaveValue('nota de prueba');
  await expect(
    page.getByTestId('characters-results').locator('[data-testid^="characters-result-like-"]').first(),
  ).toHaveAttribute('aria-pressed', 'true');
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
