// Personajes on the static export: serves `apps/web/out` through a plain
// static file server — the same artifact Vercel publishes — and opens
// /characters with NO session, NO mocks and NO daemon. The page must render
// the read-only pack reviewer standalone instead of the sign-in gate.
//
// Deliberately imports @playwright/test directly instead of
// '@/playwright/suite': the suite's auto fixtures boot a tools-dev
// daemon+web runtime per worker, which is precisely what this spec exists
// to exclude.

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

test('renders the read-only player on a daemon-less static host', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/')) apiCalls.push(path);
  });

  await page.goto(`${baseUrl}/characters`);
  const view = page.getByTestId('characters-view');
  await expect(view).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('characters-gallery')).toBeVisible();
  await expect(page.getByText('Sign in to OpenDesign')).toHaveCount(0);

  // Open a pack for review through the header picker.
  await page.getByTestId('characters-pack-select').selectOption('gruia-grulla');
  await expect(page.getByTestId('characters-grid')).toBeVisible();

  for (const key of ['idle', 'smile', 'joy', 'surprise', 'sad', 'annoyed', 'thinking', 'wave', 'nudge', 'triumph']) {
    await expect(page.getByTestId(`characters-emotion-${key}`)).toBeVisible();
  }

  await page.getByTestId('characters-emotion-sad').click();
  await expect(page.getByTestId('characters-player')).toBeVisible();
  await expect(page.getByTestId('characters-canvas')).toBeVisible();
  await expect(page.getByTestId('characters-play-pause')).toBeVisible();

  // Allowed: the standalone entry probes /api/health once to detect the
  // daemon, and the layout-level analytics provider asks /api/version and
  // /api/analytics/config. Anything beyond that means App boot leaked in.
  const ALLOWED_API = new Set(['/api/health', '/api/version', '/api/analytics/config']);
  expect(apiCalls.every((path) => ALLOWED_API.has(path)), apiCalls.join(', ')).toBe(true);
});

test('deep link /characters/:emotion opens the player directly', async ({ page }) => {
  await page.goto(`${baseUrl}/characters/sad`);
  await expect(page.getByTestId('characters-player')).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('characters-canvas')).toBeVisible();
  await expect(page.getByTestId('characters-frame-indicator')).toBeVisible();
  await expect(page.getByText('Sign in to OpenDesign')).toHaveCount(0);
});

test('root / lands on the Personajes gallery instead of the sign-in gate', async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('characters-gallery')).toBeVisible();
  await expect(page.getByText('Sign in to OpenDesign')).toHaveCount(0);
  // The standalone entry replaces the URL so the address bar reads /characters.
  expect(new URL(page.url()).pathname).toBe('/characters');
});

test('any non-characters route lands on /characters too', async ({ page }) => {
  await page.goto(`${baseUrl}/settings`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  expect(new URL(page.url()).pathname).toBe('/characters');
});

test('standalone mode carries no OpenDesign branding', async ({ page }) => {
  await page.goto(`${baseUrl}/characters`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  await expect(page).not.toHaveTitle(/OpenDesign/i);
  await expect(page.getByText(/OpenDesign/i)).toHaveCount(0);
});

test('deep link /characters/nudge plays the synced nudge frames', async ({ page }) => {
  await page.goto(`${baseUrl}/characters/nudge`);
  await expect(page.getByTestId('characters-player')).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('characters-frame-indicator')).toHaveText(/\/8/);
});

test('triumph ships in the grid with its Spanish label and plays once', async ({ page }) => {
  await page.goto(`${baseUrl}/characters`);
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  await page.getByTestId('characters-pack-select').selectOption('gruia-grulla');
  const card = page.getByTestId('characters-emotion-triumph');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Triunfo');
  await card.click();
  await expect(page.getByTestId('characters-player')).toBeVisible();
  await expect(page.getByTestId('characters-frame-indicator')).toHaveText(/\/8/);
  // oneShot: the playback segmented control ships «once» pressed.
  await expect(page.getByTestId('characters-mode-once')).toHaveAttribute('aria-pressed', 'true');
});
