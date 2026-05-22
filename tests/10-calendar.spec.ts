import { test, expect } from '@playwright/test';
import { registerUser, uniqueUser } from './helpers';

test.describe('Feature 10: Calendar View', () => {
  test('calendar page loads from navigation link', async ({ page }) => {
    await registerUser(page, uniqueUser('cal0'));
    await page.click('a:has-text("Calendar")');
    await expect(page).toHaveURL(/\/calendar/);
  });

  test('calendar shows month string (YYYY-MM format)', async ({ page }) => {
    await registerUser(page, uniqueUser('cal1'));
    await page.goto('/calendar');
    // Month is shown as YYYY-MM string e.g. "2026-05"
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await expect(page.locator(`strong:has-text("${monthStr}")`)).toBeVisible({ timeout: 5000 });
  });

  test('calendar shows day headers', async ({ page }) => {
    await registerUser(page, uniqueUser('cal2'));
    await page.goto('/calendar');
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(page.locator(`text="${day}"`)).toBeVisible({ timeout: 5000 });
    }
  });

  test('calendar renders a grid of cells', async ({ page }) => {
    await registerUser(page, uniqueUser('cal3'));
    await page.goto('/calendar');
    const cells = page.locator('.calendar-cell:not(.calendar-head-cell)');
    const count = await cells.count();
    expect(count).toBeGreaterThanOrEqual(28);
  });

  test('today cell is highlighted', async ({ page }) => {
    await registerUser(page, uniqueUser('cal4'));
    await page.goto('/calendar');
    await expect(page.locator('.calendar-today')).toBeVisible({ timeout: 5000 });
  });

  test('Next button advances to next month', async ({ page }) => {
    await registerUser(page, uniqueUser('cal5'));
    await page.goto('/calendar');

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await expect(page.locator(`strong:has-text("${currentMonthStr}")`)).toBeVisible();

    await page.click('button:has-text("Next")');

    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    await expect(page.locator(`strong:has-text("${nextMonthStr}")`)).toBeVisible({ timeout: 5000 });
  });

  test('Previous button goes back one month', async ({ page }) => {
    await registerUser(page, uniqueUser('cal6'));
    await page.goto('/calendar');

    await page.click('button:has-text("Previous")');

    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    await expect(page.locator(`strong:has-text("${prevMonthStr}")`)).toBeVisible({ timeout: 5000 });
  });

  test('Today button navigates back to current month', async ({ page }) => {
    await registerUser(page, uniqueUser('cal7'));
    await page.goto('/calendar');

    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Today")');

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await expect(page.locator(`strong:has-text("${currentMonthStr}")`)).toBeVisible({ timeout: 5000 });
  });

  test('unauthenticated access to /calendar redirects to /login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const freshPage = await ctx.newPage();
    await freshPage.goto('/calendar');
    await expect(freshPage).toHaveURL('/login');
    await ctx.close();
  });
});
