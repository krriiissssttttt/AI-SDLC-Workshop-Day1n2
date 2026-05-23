import { test, expect } from '@playwright/test';
import { registerUser, createTodo, uniqueUser } from './helpers';

test.describe('Feature 02: Priority System', () => {
  test('priority dropdown has high, medium, low options', async ({ page }) => {
    await registerUser(page, uniqueUser('pri0'));
    await expect(page.locator('label:has-text("Priority") select option[value="high"]')).toHaveCount(1);
    await expect(page.locator('label:has-text("Priority") select option[value="medium"]')).toHaveCount(1);
    await expect(page.locator('label:has-text("Priority") select option[value="low"]')).toHaveCount(1);
  });

  test('high priority todo shows red badge', async ({ page }) => {
    await registerUser(page, uniqueUser('pri1'));
    const title = `High ${Date.now()}`;
    await createTodo(page, title, { priority: 'high' });
    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem.locator('.badge-high')).toBeVisible();
    await expect(todoItem.locator('.badge-high')).toContainText('high');
  });

  test('medium priority todo shows yellow badge', async ({ page }) => {
    await registerUser(page, uniqueUser('pri2'));
    const title = `Medium ${Date.now()}`;
    await createTodo(page, title, { priority: 'medium' });
    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem.locator('.badge-medium')).toContainText('medium');
  });

  test('low priority todo shows blue badge', async ({ page }) => {
    await registerUser(page, uniqueUser('pri3'));
    const title = `Low ${Date.now()}`;
    await createTodo(page, title, { priority: 'low' });
    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem.locator('.badge-low')).toContainText('low');
  });

  test('priority filter dropdown has all options', async ({ page }) => {
    await registerUser(page, uniqueUser('pri4'));
    await expect(page.locator('select:has(option[value="all"])')).toBeVisible();
    const opts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('select option')).map(o => o.getAttribute('value'))
    );
    expect(opts).toContain('all');
    expect(opts).toContain('high');
    expect(opts).toContain('medium');
    expect(opts).toContain('low');
  });

  test('default priority is medium', async ({ page }) => {
    await registerUser(page, uniqueUser('pri5'));
    await expect(page.locator('label:has-text("Priority") select')).toHaveValue('medium');
  });

  test('edit todo changes priority badge', async ({ page }) => {
    await registerUser(page, uniqueUser('pri6'));
    const title = `Priority Edit ${Date.now()}`;
    await createTodo(page, title, { priority: 'low' });

    const todoItem = page.locator(`.todo-item:has-text("${title}")`).first();
    await todoItem.locator('button:has-text("Edit")').click();
    await page.selectOption('label:has-text("Priority") select', 'high');
    await page.click('button:has-text("Update Todo")');

    const updatedItem = page.locator(`.todo-item:has-text("${title}")`).first();
    await expect(updatedItem.locator('.badge-high')).toBeVisible({ timeout: 5000 });
  });
});
