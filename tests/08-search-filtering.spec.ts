import { test, expect } from '@playwright/test';
import { registerUser, createTodo, uniqueUser } from './helpers';

test.describe('Feature 08: Search & Filtering', () => {
  test('search section is visible', async ({ page }) => {
    await registerUser(page, uniqueUser('srch0'));
    await expect(page.locator('h2:has-text("Search & Filters")')).toBeVisible();
    await expect(page.locator('input[placeholder="Search by title or tag"]')).toBeVisible();
    await expect(page.locator('button:has-text("Clear Filters")')).toBeVisible();
  });

  test('search by title filters results', async ({ page }) => {
    await registerUser(page, uniqueUser('srch1'));
    await createTodo(page, 'Buy groceries');
    await createTodo(page, 'Write report');

    await page.fill('input[placeholder="Search by title or tag"]', 'groceries');
    await expect(page.locator('text="Buy groceries"')).toBeVisible();
    await expect(page.locator('text="Write report"')).not.toBeVisible();
  });

  test('search is case-insensitive', async ({ page }) => {
    await registerUser(page, uniqueUser('srch2'));
    await createTodo(page, 'Buy groceries');

    await page.fill('input[placeholder="Search by title or tag"]', 'GROCERIES');
    await expect(page.locator('text="Buy groceries"')).toBeVisible();
  });

  test('filter by priority high', async ({ page }) => {
    await registerUser(page, uniqueUser('srch3'));
    await createTodo(page, 'Important task', { priority: 'high' });
    await createTodo(page, 'Normal task', { priority: 'medium' });

    await page.selectOption('select:has(option[value="all"])', 'high');
    await expect(page.locator('text="Important task"')).toBeVisible();
    await expect(page.locator('text="Normal task"')).not.toBeVisible();
  });

  test('clear filters restores all todos', async ({ page }) => {
    await registerUser(page, uniqueUser('srch4'));
    await createTodo(page, 'Todo Alpha');
    await createTodo(page, 'Todo Beta');

    await page.fill('input[placeholder="Search by title or tag"]', 'Alpha');
    await expect(page.locator('text="Todo Beta"')).not.toBeVisible();

    await page.click('button:has-text("Clear Filters")');
    await expect(page.locator('text="Todo Alpha"')).toBeVisible();
    await expect(page.locator('text="Todo Beta"')).toBeVisible();
  });

  test('combine title search and priority filter', async ({ page }) => {
    await registerUser(page, uniqueUser('srch5'));
    await createTodo(page, 'High Alpha', { priority: 'high' });
    await createTodo(page, 'High Beta', { priority: 'high' });

    await page.selectOption('select:has(option[value="all"])', 'high');
    await page.fill('input[placeholder="Search by title or tag"]', 'Alpha');
    await expect(page.locator('text="High Alpha"')).toBeVisible();
    await expect(page.locator('text="High Beta"')).not.toBeVisible();
  });

  test('filter by priority low', async ({ page }) => {
    await registerUser(page, uniqueUser('srch6'));
    await createTodo(page, 'Low task', { priority: 'low' });
    await createTodo(page, 'High task', { priority: 'high' });

    await page.selectOption('select:has(option[value="all"])', 'low');
    await expect(page.locator('text="Low task"')).toBeVisible();
    await expect(page.locator('text="High task"')).not.toBeVisible();
  });
});
