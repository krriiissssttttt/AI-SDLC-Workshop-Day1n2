import { test, expect } from '@playwright/test';
import { registerUser, createTodo, addSubtask, uniqueUser } from './helpers';

test.describe('Feature 07: Template System', () => {
  test('templates section is visible', async ({ page }) => {
    await registerUser(page, uniqueUser('tpl0'));
    await expect(page.locator('h2:has-text("Templates")')).toBeVisible();
    await expect(page.locator('input[placeholder="Template name"]')).toBeVisible();
    await expect(page.locator('button:has-text("Save Current Edit as Template")')).toBeVisible();
  });

  test('save a todo as a template', async ({ page }) => {
    await registerUser(page, uniqueUser('tpl1'));
    const todoTitle = `Template Source ${Date.now()}`;
    await createTodo(page, todoTitle, { priority: 'high' });

    const todoItem = page.locator(`.todo-item:has-text("${todoTitle}")`).first();
    await todoItem.locator('button:has-text("Edit")').click();
    await expect(page.locator('h2:has-text("Edit Todo")')).toBeVisible();

    const templateName = `Tpl-${Date.now()}`;
    await page.fill('input[placeholder="Template name"]', templateName);
    await page.click('button:has-text("Save Current Edit as Template")');

    await expect(page.locator(`select option:has-text("${templateName}")`)).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('text=/Template saved/')).toBeVisible({ timeout: 5000 });
  });

  test('use template creates a new todo', async ({ page }) => {
    await registerUser(page, uniqueUser('tpl2'));
    const todoTitle = `Template Base ${Date.now()}`;
    await createTodo(page, todoTitle);

    const todoItem = page.locator(`.todo-item:has-text("${todoTitle}")`).first();
    await todoItem.locator('button:has-text("Edit")').click();

    const templateName = `UseMe-${Date.now()}`;
    await page.fill('input[placeholder="Template name"]', templateName);
    await page.click('button:has-text("Save Current Edit as Template")');
    await expect(page.locator('text=/Template saved/')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Cancel Edit")');

    await page.selectOption('select:near(button:has-text("Use Template"))', { label: templateName });
    await page.click('button:has-text("Use Template")');
    await expect(page.locator('text=/Todo created from template/')).toBeVisible({ timeout: 5000 });
  });

  test('template category input is available', async ({ page }) => {
    await registerUser(page, uniqueUser('tpl3'));
    await expect(page.locator('input[placeholder="Category"]')).toBeVisible();
  });

  test('template with subtasks can be saved', async ({ page }) => {
    await registerUser(page, uniqueUser('tpl4'));
    const todoTitle = `Template With Subtasks ${Date.now()}`;
    await createTodo(page, todoTitle);
    await addSubtask(page, todoTitle, 'Subtask from template');

    const todoItem = page.locator(`.todo-item:has-text("${todoTitle}")`).first();
    await todoItem.locator('button:has-text("Edit")').click();

    const templateName = `SubtaskTpl-${Date.now()}`;
    await page.fill('input[placeholder="Template name"]', templateName);
    await page.click('button:has-text("Save Current Edit as Template")');
    await expect(page.locator('text=/Template saved/')).toBeVisible({ timeout: 5000 });

    // Template should appear in dropdown
    await expect(page.locator(`select option:has-text("${templateName}")`)).toHaveCount(1, { timeout: 5000 });
  });
});
