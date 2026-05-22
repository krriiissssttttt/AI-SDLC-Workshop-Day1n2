import { test, expect } from '@playwright/test';
import { registerUser, uniqueUser, futureDatetimeLocal } from './helpers';

test.describe('Feature 04: Reminders & Notifications', () => {
  test('reminder dropdown shows 7 timing options + none', async ({ page }) => {
    await registerUser(page, uniqueUser('rem0'));
    await expect(page.locator('label:has-text("Reminder") select option')).toHaveCount(8);
  });

  test('reminder dropdown is disabled without due date', async ({ page }) => {
    await registerUser(page, uniqueUser('rem1'));
    await expect(page.locator('label:has-text("Reminder") select')).toBeDisabled();
  });

  test('reminder dropdown is enabled after setting due date', async ({ page }) => {
    await registerUser(page, uniqueUser('rem2'));
    const dueDate = futureDatetimeLocal(120);
    await page.fill('input[type="datetime-local"]', dueDate);
    await expect(page.locator('label:has-text("Reminder") select')).toBeEnabled();
  });

  test('set reminder on todo and verify badge', async ({ page }) => {
    await registerUser(page, uniqueUser('rem3'));
    const title = `Reminder Test ${Date.now()}`;
    const dueDate = futureDatetimeLocal(120);

    await page.fill('label:has-text("Title") input', title);
    await page.fill('input[type="datetime-local"]', dueDate);
    await page.selectOption('label:has-text("Reminder") select', '60');
    await page.click('button:has-text("Create Todo")');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem).toBeVisible({ timeout: 8000 });
    await expect(todoItem.locator('text="🔔 60m"')).toBeVisible();
  });

  test('"Enable Notifications" button is visible', async ({ page }) => {
    await registerUser(page, uniqueUser('rem4'));
    await expect(page.locator('button:has-text("Enable Notifications")')).toBeVisible();
  });

  test('all 7 reminder timing options are available', async ({ page }) => {
    await registerUser(page, uniqueUser('rem5'));
    const options = ['15', '30', '60', '120', '1440', '2880', '10080'];
    for (const value of options) {
      await expect(page.locator(`label:has-text("Reminder") select option[value="${value}"]`)).toHaveCount(1);
    }
  });
});
