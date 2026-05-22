import { test, expect } from '@playwright/test';
import { registerUser, uniqueUser, futureDatetimeLocal } from './helpers';

test.describe('Feature 03: Recurring Todos', () => {
  test('recurrence dropdown shows all patterns', async ({ page }) => {
    await registerUser(page, uniqueUser('rec0'));
    await expect(page.locator('label:has-text("Recurrence") select option[value="none"]')).toHaveCount(1);
    await expect(page.locator('label:has-text("Recurrence") select option[value="daily"]')).toHaveCount(1);
    await expect(page.locator('label:has-text("Recurrence") select option[value="weekly"]')).toHaveCount(1);
    await expect(page.locator('label:has-text("Recurrence") select option[value="monthly"]')).toHaveCount(1);
    await expect(page.locator('label:has-text("Recurrence") select option[value="yearly"]')).toHaveCount(1);
  });

  test('create daily recurring todo shows badge', async ({ page }) => {
    await registerUser(page, uniqueUser('rec1'));
    const title = `Daily Recurring ${Date.now()}`;
    const dueDate = futureDatetimeLocal(60);

    await page.fill('label:has-text("Title") input', title);
    await page.fill('input[type="datetime-local"]', dueDate);
    await page.selectOption('label:has-text("Recurrence") select', 'daily');
    await page.click('button:has-text("Create Todo")');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem).toBeVisible({ timeout: 8000 });
    await expect(todoItem.locator('text="🔄 daily"')).toBeVisible();
  });

  test('create weekly recurring todo shows badge', async ({ page }) => {
    await registerUser(page, uniqueUser('rec2'));
    const title = `Weekly Recurring ${Date.now()}`;
    const dueDate = futureDatetimeLocal(60);

    await page.fill('label:has-text("Title") input', title);
    await page.fill('input[type="datetime-local"]', dueDate);
    await page.selectOption('label:has-text("Recurrence") select', 'weekly');
    await page.click('button:has-text("Create Todo")');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem.locator('text="🔄 weekly"')).toBeVisible({ timeout: 8000 });
  });

  test('completing a daily recurring todo creates next instance', async ({ page }) => {
    await registerUser(page, uniqueUser('rec3'));
    const title = `Recurring Complete ${Date.now()}`;
    const dueDate = futureDatetimeLocal(60);

    await page.fill('label:has-text("Title") input', title);
    await page.fill('input[type="datetime-local"]', dueDate);
    await page.selectOption('label:has-text("Recurrence") select', 'daily');
    await page.click('button:has-text("Create Todo")');
    await page.waitForSelector(`.todo-item:has-text("${title}")`);

    // Complete the todo
    const todoItem = page.locator(`.todo-item:has-text("${title}")`).first();
    await todoItem.locator('input[type="checkbox"]').first().click();

    // Wait for reload - the next instance should appear in Active
    await page.waitForTimeout(1500);
    const activeTodos = page.locator('section:has-text("Active")');
    await expect(activeTodos.locator(`text="${title}"`)).toBeVisible({ timeout: 8000 });
  });

  test('monthly recurring todo has correct badge', async ({ page }) => {
    await registerUser(page, uniqueUser('rec4'));
    const title = `Monthly Recurring ${Date.now()}`;
    const dueDate = futureDatetimeLocal(60);

    await page.fill('label:has-text("Title") input', title);
    await page.fill('input[type="datetime-local"]', dueDate);
    await page.selectOption('label:has-text("Recurrence") select', 'monthly');
    await page.click('button:has-text("Create Todo")');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem.locator('text="🔄 monthly"')).toBeVisible({ timeout: 8000 });
  });

  test('yearly recurring todo has correct badge', async ({ page }) => {
    await registerUser(page, uniqueUser('rec5'));
    const title = `Yearly Recurring ${Date.now()}`;
    const dueDate = futureDatetimeLocal(60);

    await page.fill('label:has-text("Title") input', title);
    await page.fill('input[type="datetime-local"]', dueDate);
    await page.selectOption('label:has-text("Recurrence") select', 'yearly');
    await page.click('button:has-text("Create Todo")');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem.locator('text="🔄 yearly"')).toBeVisible({ timeout: 8000 });
  });
});

