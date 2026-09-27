// Personajes G-UX 8A — public trial route `/characters/try`: Gui and Tinta
// stay fully interactive without a session (changes 1–3 all live), the
// sign-up wall appears only after value («Dale vida»), and the one free
// export is a GIF watermarked «hecho con gruia». No model or imagegen
// calls — the surface is served from the same static export.

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

test('trial route: interactive stage and meta, wall after value, branded GIF only', async ({ page }) => {
  const apiCalls: string[] = [];
  const BOOTSTRAP_PROBES = new Set(['/api/health', '/api/version', '/api/analytics/config']);
  page.on('request', (request) => {
    const url = new URL(request.url());
    // The standalone mount + observability bootstrap probe a fixed trio;
    // anything beyond it (models, imagegen, persistence) must never fire
    // from this route.
    if (url.pathname.startsWith('/api/') && !BOOTSTRAP_PROBES.has(url.pathname)) {
      apiCalls.push(url.pathname);
    }
  });

  await page.goto(`${baseUrl}/characters/try`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });

  // Changes 1–3 stay alive: chips play emotions on stage…
  await expect(page.getByTestId('characters-emo-chips')).toBeVisible();
  await page.getByTestId('characters-emo-joy').click();

  // …and the meta question still fires when the first touched emotion ends.
  await expect(page.getByTestId('characters-goal-card')).toBeVisible({ timeout: T.long });
  await page.getByTestId('characters-goal-app').click();
  await expect(page.getByTestId('characters-goal-plan')).toBeVisible();

  // The composer is there, but «Generar»/«Dale vida» opens the wall —
  // it only shows after value, never on load.
  await expect(page.getByTestId('characters-trial-wall')).toHaveCount(0);
  await page.getByTestId('characters-generate-input').fill('una grulla que saluda');
  await page.getByTestId('characters-generate').click();
  const wall = page.getByTestId('characters-trial-wall');
  await expect(wall).toBeVisible();
  await expect(wall).toContainText('Tu personaje ya se mueve. ¿Lo guardamos?');
  await expect(wall).toContainText('exportarlo sin marca');
  await expect(page.getByTestId('characters-trial-save')).toBeVisible();

  // The wall's free path: a branded GIF made from the frames already in
  // the bundled pack — it downloads, and it is the only thing that does.
  const download = page.waitForEvent('download');
  await page.getByTestId('characters-trial-gif').click();
  const gif = await download;
  expect(gif.suggestedFilename()).toMatch(/\.gif$/);

  // No generation happened: no results, no model/imagegen traffic.
  await expect(page.getByTestId('characters-results')).toHaveCount(0);
  expect(apiCalls).toEqual([]);

  // «Seguir probando» dismisses the wall back to the interactive stage.
  await page.getByTestId('characters-trial-later').click();
  await expect(wall).toHaveCount(0);
  await expect(page.getByTestId('characters-emo-chips')).toBeVisible();
});

test('trial route at 390px: wall fits, no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/characters/try`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  await page.getByTestId('characters-cast-gruia-grulla').click();
  await page.getByTestId('characters-generate-input').fill('una grulla que saluda');
  await page.getByTestId('characters-generate').click();
  await expect(page.getByTestId('characters-trial-wall')).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
