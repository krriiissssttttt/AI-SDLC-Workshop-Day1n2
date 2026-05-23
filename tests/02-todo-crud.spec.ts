import { test, expect } from '@playwright/test';
import { registerUser, createTodo, uniqueUser } from './helpers';

test.describe('Feature 01: Todo CRUD Operations', () => {
  test('create todo with title only', async ({ page }) => {
    await registerUser(page, uniqueUser('crud1'));
    const title = `Simple Todo ${Date.now()}`;
    await createTodo(page, title);
    await expect(page.locator(`.todo-item:has-text("${title}")`)).toBeVisible();
  });

  test('create todo with priority high', async ({ page }) => {
    await registerUser(page, uniqueUser('crud2'));
    const title = `High Priority ${Date.now()}`;
    await createTodo(page, title, { priority: 'high' });
    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem).toBeVisible();
    await expect(todoItem.locator('.badge-high')).toBeVisible();
  });

  test('create todo with priority low', async ({ page }) => {
    await registerUser(page, uniqueUser('crud3'));
    const title = `Low Priority ${Date.now()}`;
    await createTodo(page, title, { priority: 'low' });
    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await expect(todoItem.locator('.badge-low')).toBeVisible();
  });

  test('toggle todo completion', async ({ page }) => {
    await registerUser(page, uniqueUser('crud4'));
    const title = `Toggle Test ${Date.now()}`;
    await createTodo(page, title);

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    const checkbox = todoItem.locator('input[type="checkbox"]').first();
    await checkbox.click();
    await expect(page.locator('section:has-text("Completed")').locator(`text="${title}"`)).toBeVisible({ timeout: 5000 });
  });

  test('edit todo title', async ({ page }) => {
    await registerUser(page, uniqueUser('crud5'));
    const title = `Edit Test ${Date.now()}`;
    const newTitle = `Edited: ${title}`;
    await createTodo(page, title);

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await todoItem.locator('button:has-text("Edit")').click();
    await expect(page.locator('h2:has-text("Edit Todo")')).toBeVisible();

    await page.fill('label:has-text("Title") input', newTitle);
    await page.click('button:has-text("Update Todo")');
    await expect(page.locator(`.todo-item:has-text("${newTitle}")`)).toBeVisible({ timeout: 5000 });
  });

  test('delete todo', async ({ page }) => {
    await registerUser(page, uniqueUser('crud6'));
    const title = `Delete Test ${Date.now()}`;
    await createTodo(page, title);

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await todoItem.locator('button:has-text("Delete")').last().click();
    await expect(page.locator(`text="${title}"`)).not.toBeVisible({ timeout: 5000 });
  });

  test('todos section headings are visible', async ({ page }) => {
    await registerUser(page, uniqueUser('crud7'));
    await expect(page.locator('h2:has-text("Overdue")')).toBeVisible();
    await expect(page.locator('h2:has-text("Active")')).toBeVisible();
    await expect(page.locator('h2:has-text("Completed")')).toBeVisible();
  });

  test('cancel edit restores form', async ({ page }) => {
    await registerUser(page, uniqueUser('crud8'));
    const title = `Cancel Edit ${Date.now()}`;
    await createTodo(page, title);

    const todoItem = page.locator(`.todo-item:has-text("${title}")`);
    await todoItem.locator('button:has-text("Edit")').click();
    await expect(page.locator('h2:has-text("Edit Todo")')).toBeVisible();

    await page.click('button:has-text("Cancel Edit")');
    await expect(page.locator('h2:has-text("Create Todo")')).toBeVisible();
  });
});

