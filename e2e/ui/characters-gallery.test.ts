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

  // G-UX 2: the character asks «¿Para qué quieres tu personaje?» in the
  // bubble only after the first user-touched emotion finishes — never
  // before. Tap joy and wait for its passes to run out.
  await page.getByTestId('characters-emo-joy').click();
  const goalCard = page.getByTestId('characters-goal-card');
  await expect(goalCard).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('characters-bubble-text')).toContainText(/para qué/i);
  await expect(page.getByTestId('characters-goal-title')).toContainText(/para qué/i);

  // Answering «app» turns the card into the plan: goal pill, per-emotion
  // uses, recommended format — and the stage chips reorder + highlight.
  await page.getByTestId('characters-goal-app').click();
  await expect(page.getByTestId('characters-goal-pill')).toContainText(/Para:/);
  await expect(page.getByTestId('characters-goal-plan')).toContainText('al abrir la app');
  await expect(page.getByTestId('characters-goal-format')).toContainText(/Formato:/);
  const chips = page.getByTestId('characters-emo-chips').locator('button');
  await expect(chips.nth(0)).toHaveAttribute('data-testid', 'characters-emo-wave');
  await expect(chips.nth(1)).toHaveAttribute('data-testid', 'characters-emo-joy');
  await expect(chips.nth(2)).toHaveAttribute('data-testid', 'characters-emo-nudge');

  // The composer placeholder switches to the goal's own prompt, and the
  // «Prueba con:» examples switch to the goal's set (app mascot ideas).
  await expect(page.getByTestId('characters-generate-input')).toHaveAttribute('placeholder', /mascota/);
  await expect(page.getByTestId('characters-try-1')).toContainText('búho');
  await expect(page.getByTestId('characters-composer-hint')).toContainText('lo verás moverse');

  // U7-delta1: the plan ends with «Crear el mío», which scrolls to the
  // composer, focuses its field (with the goal's placeholder) and
  // highlights it briefly.
  await expect(page.getByTestId('characters-goal-create')).toContainText('Crear el mío');
  await page.getByTestId('characters-goal-create').click();
  await expect(page.getByTestId('characters-generate-input')).toBeFocused({ timeout: T.medium });
  await page.getByTestId('characters-generate-input').blur();

  // Pick Tinta as the base and generate from a phrase.
  await page.getByTestId('characters-starter-contenido-tinta').click();
  await page.getByTestId('characters-generate-input').fill('una tinta que celebra');
  await page.getByTestId('characters-generate').click();

  const results = page.getByTestId('characters-results');
  await expect(results).toBeVisible();
  const card = results.locator('[data-testid^="characters-result-"]').first();
  await expect(card).toBeVisible();

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

  // Reload: the goal persists (plan card still up, no re-ask), and the
  // CTA + like + note persist too.
  await page.reload();
  await expect(page.getByTestId('characters-goal-pill')).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('characters-goal-title')).toHaveCount(0);
  await expect(page.getByTestId(`characters-meta-cta-app-${cardId}`)).toBeVisible();
  const persisted = page.getByTestId('characters-results').locator('[data-testid^="characters-result-note-"]');
  await expect(persisted.first()).toHaveValue('nota de prueba');
  await expect(
    page.getByTestId('characters-results').locator('[data-testid^="characters-result-like-"]').first(),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('living stage greets, reacts to chips and pokes, and speaks in the base voice', async ({ page }) => {
  // The meta question (G-UX 2) is covered by its own flow — settle the
  // flag here so the card + forced bubble line do not race the asserts.
  await page.addInitScript(() => localStorage.setItem('od-personajes.meta-asked.v1', '1'));
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

test('reactive personality: idle nudge, typing cue, generation steps and like', async ({ page }) => {
  // Settle the meta flag so the goal card does not gate the nudges.
  await page.addInitScript(() => localStorage.setItem('od-personajes.meta-asked.v1', '1'));
  await page.goto(`${baseUrl}/characters`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  const bubble = page.getByTestId('characters-bubble-text');

  // First inactivity nudge lands ~9s in, in the character's voice.
  await expect(bubble).toContainText('Psst', { timeout: T.long });
  await expect(page.getByTestId('characters-emo-nudge')).toHaveAttribute('aria-pressed', 'true');

  // Typing three or more characters, then a 0.7s pause, makes Gui think
  // along and comment on the draft.
  const input = page.getByTestId('characters-generate-input');
  await input.fill('un zorro con gafas');
  await expect(bubble).toContainText('Me gusta por dónde vas', { timeout: T.medium });

  // «Generar» runs the three origami steps in the bubble before the
  // result lands with a triumph reaction.
  await input.fill('un zorro con gafas curioso');
  await page.getByTestId('characters-generate').click();
  await expect(bubble).toContainText(/Manos a la obra|Doblando el papel|Marcando los pliegues|cuerda/i, {
    timeout: T.medium,
  });
  await expect(page.getByTestId('characters-results')).toBeVisible({ timeout: T.long });
  await expect(bubble).toContainText('Tachán', { timeout: T.medium });

  // Liking the fresh result gets a joy reaction back.
  await page.locator('[data-testid^="characters-result-like-"]').first().click();
  await expect(bubble).toContainText('me gusta a mí', { timeout: T.medium });
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

test('composer fits and invites: label, examples, Imagen attach, Dale vida and mobile CTA', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('od-personajes.meta-asked.v1', '1'));
  await page.goto(`${baseUrl}/characters`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });

  // G-UX 4: «Tu personaje» label, two-line growing field, examples and help.
  const input = page.getByTestId('characters-generate-input');
  await expect(page.getByTestId('characters-composer')).toContainText('Tu personaje');
  await expect(input).toHaveAttribute('rows', '2');
  await expect(page.getByTestId('characters-generate-attach')).toContainText('Imagen');
  await expect(page.getByTestId('characters-generate')).toContainText('Dale vida');
  await expect(page.getByTestId('characters-composer-hint')).toContainText('Tres palabras bastan');

  // «Prueba con:» fills the field; the CTA needs three characters.
  await expect(page.getByTestId('characters-generate')).toBeDisabled();
  await page.getByTestId('characters-try-1').click();
  await expect(input).toHaveValue('un zorro con gafas, curioso');
  await expect(page.getByTestId('characters-generate')).toBeEnabled();
  await input.fill('ab');
  await expect(page.getByTestId('characters-generate')).toBeDisabled();
});

test('mobile 390px: fixed «Crear el mío» CTA only shows off-viewport, then focuses the composer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('od-personajes.meta-asked.v1', '1'));
  await page.goto(`${baseUrl}/characters`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });

  // While the composer is in the viewport there is no fixed CTA — scrolling
  // to something already visible gains nothing (U7-delta1).
  const composer = page.getByTestId('characters-composer');
  await composer.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('characters-mobile-cta')).toHaveCount(0);

  // Two results make the page tall enough to scroll the composer fully out
  // of the viewport — then the fixed CTA appears.
  const input = page.getByTestId('characters-generate-input');
  const resultCards = page.getByTestId('characters-results').locator('[data-testid^="characters-result-"]');
  await input.fill('zorro de papel curioso');
  await page.getByTestId('characters-generate').click();
  await expect(resultCards.first()).toBeVisible({ timeout: T.long });
  await input.fill('buho de papel sabio');
  await page.getByTestId('characters-generate').click();
  await expect(resultCards.nth(1)).toBeVisible({ timeout: T.long });
  // Scroll to the bottom — repeatedly, since result art keeps growing the
  // page — until the composer leaves the viewport and the CTA mounts.
  const cta = page.getByTestId('characters-mobile-cta');
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        return cta.count();
      },
      { timeout: T.long },
    )
    .toBe(1);
  await expect(cta).toBeVisible();
  await expect(cta).toContainText('Crear el mío');
  const ctaBox = await cta.boundingBox();
  expect(ctaBox).not.toBeNull();
  expect(ctaBox!.height).toBeGreaterThanOrEqual(44);

  // …and it must not cover content: the gallery reserves enough bottom
  // padding for the fixed CTA.
  const padBottom = await page.evaluate(() => {
    const gallery = document.querySelector('[data-testid="characters-gallery"]');
    return gallery ? parseFloat(getComputedStyle(gallery).paddingBottom) : 0;
  });
  expect(padBottom).toBeGreaterThanOrEqual(ctaBox!.height);

  // Clicking it scrolls back to the composer and focuses the field.
  await cta.click();
  await page.waitForTimeout(600);
  const focused = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset?.testid,
  );
  expect(focused).toBe('characters-generate-input');
});
