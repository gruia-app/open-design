// Mobile entry navigation: below the rail's dock breakpoint (1080px) the
// rail can no longer dock, so it opens as an overlay drawer from a chrome
// menu button. Covers the R493 report — on a 390x844 phone the Personajes
// destination was unreachable because the open rail was clipped to 0px.

import { expect, test } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';
import type { Page } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe.configure({ timeout: T.xlong });

test.beforeEach(async ({ page }) => {
  await applyStandardMocks(page);
});

test('[P1] mobile menu opens the nav drawer and reaches Personajes', async ({ page }, testInfo) => {
  await gotoEntryHome(page);

  const menuToggle = page.getByTestId('entry-mobile-nav-toggle');
  await expect(menuToggle).toBeVisible();
  await expect(menuToggle).toHaveAttribute('aria-label', /menu|menú/i);
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menuToggle).toHaveAttribute('aria-controls', 'entry-nav-rail');
  const toggleBox = await menuToggle.boundingBox();
  expect(toggleBox?.width).toBeGreaterThanOrEqual(44);
  expect(toggleBox?.height).toBeGreaterThanOrEqual(44);

  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
  const rail = page.locator('#entry-nav-rail');
  await expect(rail).toBeVisible();
  // The drawer floats over the content — it must have real width (the R493
  // regression left it rendered but clipped to 0px).
  const railBox = await rail.boundingBox();
  expect(railBox?.width).toBeGreaterThanOrEqual(200);

  // The menu toggle keeps its own chrome strip above the drawer: with the
  // drawer open its box must not overlap the search field or any rail item.
  const openToggleBox = await menuToggle.boundingBox();
  expect(openToggleBox).not.toBeNull();
  const drawerTargets = [
    page.getByTestId('entry-nav-search'),
    ...(await rail.locator('button, a').all()),
  ];
  for (const target of drawerTargets) {
    if (!(await target.isVisible())) {
      continue;
    }
    const box = await target.boundingBox();
    expect(box, `no box for ${await target.getAttribute('data-testid')}`).not.toBeNull();
    expect(
      boxesOverlap(openToggleBox!, box!),
      `menu toggle overlaps ${await target.getAttribute('data-testid')}`,
    ).toBe(false);
  }
  await testInfo.attach('mobile-nav-drawer', { body: await page.screenshot(), contentType: 'image/png' });

  const characters = page.getByTestId('entry-nav-characters');
  await expect(characters).toBeVisible();
  const charactersBox = await characters.boundingBox();
  expect(charactersBox?.height).toBeGreaterThanOrEqual(44);
  await characters.click();

  await expect(page).toHaveURL(/\/characters$/, { timeout: T.long });
  await expect(page.getByTestId('characters-view')).toBeVisible({ timeout: T.long });
  await expect(page.getByTestId('characters-gallery')).toBeVisible();
  // The drawer dismisses on destination pick.
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(rail).toBeHidden();
  await testInfo.attach('mobile-nav-characters', { body: await page.screenshot(), contentType: 'image/png' });
});

test('[P1] mobile menu closes with Escape and restores focus', async ({ page }) => {
  await gotoEntryHome(page);

  const menuToggle = page.getByTestId('entry-mobile-nav-toggle');
  await menuToggle.click();
  const rail = page.locator('#entry-nav-rail');
  await expect(rail).toBeVisible();
  // Opening the drawer moves focus into it.
  await expect(rail.locator(':focus')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(rail).toBeHidden();
  // Closing returns focus to the control that opened the drawer.
  await expect(menuToggle).toBeFocused();
});

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function gotoEntryHome(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText('Loading OpenDesign…').waitFor({ state: 'hidden', timeout: T.long });
  const privacyDialog = page.getByRole('dialog').filter({ hasText: 'Help us improve OpenDesign' });
  if (await privacyDialog.isVisible()) {
    await privacyDialog.getByRole('button', { name: /I get it|not now|got it|don't share/i }).click();
    await expect(privacyDialog).toHaveCount(0);
  }
  // First-hit compile of the dev bundle can take tens of seconds.
  await expect(page.getByTestId('home-hero')).toBeVisible({ timeout: T.xlong });
  await expect(page.getByTestId('home-hero-input')).toBeVisible({ timeout: T.long });
}
