// Personajes F3 — frame editor on the static export. Same daemon-less setup
// as characters-static.test.ts: edits must work without a daemon, persist to
// IndexedDB, and every export format must produce a real file.

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { T } from '@/timeouts';
import { REPO_ROOT, serveCharactersStaticExport } from '@/playwright/static-export';
import type { Page } from '@playwright/test';

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

async function openEditor(page: Page, emotion = 'nudge') {
  await page.goto(`${baseUrl}/characters/${emotion}`);
  await expect(page.getByTestId('characters-player')).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('emotion-editor')).toBeVisible();
  await expect(page.getByTestId('editor-strip')).toBeVisible();
}

async function frameCount(page: Page): Promise<number> {
  return page.locator('[data-testid^="editor-frame-"]').count();
}

test('reorder, duplicate and remove frames through the editor', async ({ page }) => {
  await openEditor(page);
  const initial = await frameCount(page);
  expect(initial).toBeGreaterThan(1);

  // Select frame 0 and move it right — the selection follows the frame.
  await page.getByTestId('editor-frame-0').click();
  await expect(page.getByTestId('editor-frame-0')).toHaveAttribute('data-selected', 'true');
  await page.getByTestId('editor-move-right').click();
  await expect(page.getByTestId('editor-frame-1')).toHaveAttribute('data-selected', 'true');

  // Duplicate the selected frame → count grows.
  await page.getByTestId('editor-duplicate').click();
  await expect.poll(() => frameCount(page)).toBe(initial + 1);

  // Remove it → count returns.
  await page.getByTestId('editor-remove').click();
  await expect.poll(() => frameCount(page)).toBe(initial);

  // Undo restores the duplicate; redo drops it again.
  await expect(page.getByTestId('editor-undo')).toBeEnabled();
  await page.getByTestId('editor-undo').click();
  await expect.poll(() => frameCount(page)).toBe(initial + 1);
  await page.getByTestId('editor-redo').click();
  await expect.poll(() => frameCount(page)).toBe(initial);
});

test('per-frame duration, note and like flag are editable', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-frame-1').click();

  const ms = page.getByTestId('editor-ms');
  await ms.fill('250');
  await expect(ms).toHaveValue('250');
  await expect(page.getByTestId('editor-frame-1')).toContainText('250ms');

  const note = page.getByTestId('editor-note');
  await note.fill('revisar ala');
  await expect(note).toHaveValue('revisar ala');

  await page.getByTestId('editor-like').click();
  await expect(page.getByTestId('editor-like')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('editor-frame-1').locator('text=♥')).toBeVisible();

  // Emotion-level note + like.
  await page.getByTestId('editor-emotion-note').fill('emoción lista');
  await expect(page.getByTestId('editor-emotion-note')).toHaveValue('emoción lista');
  await page.getByTestId('editor-emotion-like').click();
  await expect(page.getByTestId('editor-emotion-like')).toHaveAttribute('aria-pressed', 'true');
});

test('edits persist in IndexedDB across reloads', async ({ page }) => {
  await openEditor(page);
  const initial = await frameCount(page);
  await page.getByTestId('editor-frame-0').click();
  await page.getByTestId('editor-remove').click();
  await expect.poll(() => frameCount(page)).toBe(initial - 1);

  // Saves are debounced (350ms) — let the write-behind land. The pagehide
  // flush covers real tab closes; headless reload may tear down IndexedDB
  // before the flush transaction commits.
  await page.waitForTimeout(500);

  // Reload the same pack+version: the edit comes back from IndexedDB.
  await page.reload();
  await expect(page.getByTestId('characters-player')).toBeVisible({ timeout: T.long });
  await expect.poll(() => frameCount(page)).toBe(initial - 1);
});

test('replace frame swaps in a local image and stays undoable', async ({ page }) => {
  await openEditor(page);
  const initial = await frameCount(page);
  await page.getByTestId('editor-frame-1').click();

  // A real pack PNG stands in for the user's corrected frame.
  const replacement = join(
    REPO_ROOT,
    'apps/web/public/character-packs/gruia-grulla/idle/002.png',
  );
  await page.getByTestId('editor-replace-input').setInputFiles(replacement);

  // Same frame count, the slot is marked dirty and the edit can be undone.
  expect(await frameCount(page)).toBe(initial);
  await expect(page.getByTestId('editor-undo')).toBeEnabled();
  await expect(page.getByTestId('editor-replace-error')).toHaveCount(0);

  // Re-uploading the same file works — the input resets between picks.
  await page.getByTestId('editor-replace-input').setInputFiles(replacement);
  await expect(page.getByTestId('editor-replace-error')).toHaveCount(0);
});

test('replace frame rejects a non-image file with an inline error', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-frame-0').click();

  await page.getByTestId('editor-replace-input').setInputFiles({
    name: 'notas.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('esto no es una imagen'),
  });

  await expect(page.getByTestId('editor-replace-error')).toBeVisible();
  // The failed pick never enters history — undo stays disabled.
  await expect(page.getByTestId('editor-undo')).toBeDisabled();
});

test('before/after compare toggle draws the baseline', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-compare').click();
  await expect(page.getByTestId('compare-badge')).toBeVisible();
  await page.getByTestId('editor-compare').click();
  await expect(page.getByTestId('compare-badge')).toHaveCount(0);
});

test('GIF export produces a real GIF89a file', async ({ page }) => {
  await openEditor(page);
  const downloadPromise = page.waitForEvent('download', { timeout: T.medium });
  await page.getByTestId('characters-export-gif').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.gif$/);
  const path = await download.path();
  const head = await readFile(path!);
  expect(head.subarray(0, 6).toString('ascii')).toBe('GIF89a');
  expect(head.length).toBeGreaterThan(1000);
});

test('APNG and animated WebP exports produce valid containers', async ({ page }) => {
  await openEditor(page);

  const apngDownload = page.waitForEvent('download', { timeout: T.medium });
  await page.getByTestId('characters-export-apng').click();
  const apngPath = await (await apngDownload).path();
  const apng = await readFile(apngPath!);
  expect(apng.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  // acTL chunk marks it as animated PNG.
  expect(apng.includes(Buffer.from('acTL'))).toBe(true);

  const webpDownload = page.waitForEvent('download', { timeout: T.medium });
  await page.getByTestId('characters-export-webp').click();
  const webpPath = await (await webpDownload).path();
  const webp = await readFile(webpPath!);
  expect(webp.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(webp.includes(Buffer.from('ANIM'))).toBe(true);
});

test('play-once mode exports files that do not loop', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('characters-mode-once').click();

  const gifDownload = page.waitForEvent('download', { timeout: T.medium });
  await page.getByTestId('characters-export-gif').click();
  const gif = await readFile((await (await gifDownload).path())!);
  // No NETSCAPE2.0 application extension → the GIF plays a single pass.
  expect(gif.includes(Buffer.from('NETSCAPE2.0'))).toBe(false);

  const apngDownload = page.waitForEvent('download', { timeout: T.medium });
  await page.getByTestId('characters-export-apng').click();
  const apng = await readFile((await (await apngDownload).path())!);
  const actl = apng.indexOf(Buffer.from('acTL'));
  expect(actl).toBeGreaterThan(0);
  // acTL payload: num_frames u32, then num_plays u32 — big-endian, 1 = once.
  expect(apng.readUInt32BE(actl + 8)).toBe(1);
});

test('regeneration requests stay exportable on a static host', async ({ page }) => {
  await openEditor(page);
  await expect(page.getByTestId('jobs-panel')).toBeVisible();
  await expect(page.getByTestId('jobs-static-notice')).toBeVisible();
  await expect(page.getByTestId('jobs-static-notice')).toContainText(/local/i);

  await page.getByTestId('jobs-instruction').fill('la mano izquierda va por detrás del cuerpo');
  await page.getByTestId('jobs-enqueue').click();
  await expect(page.getByTestId('jobs-list')).toContainText('la mano izquierda');
  await expect(page.locator('[data-testid^="job-"][data-testid$="-status"]').first())
    .toContainText(/queued|en cola/);

  // The request downloads as a JSON handoff for the local runner.
  const downloadPromise = page.waitForEvent('download', { timeout: T.medium });
  await page.locator('[data-testid^="job-"][data-testid$="-export"]').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});
