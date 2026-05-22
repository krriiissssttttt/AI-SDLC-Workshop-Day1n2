import { test, expect } from '@playwright/test';
import { registerUser, createTodo, createTag, uniqueUser } from './helpers';

test.describe('Feature 06: Tag System', () => {
  test('tag management section is visible', async ({ page }) => {
    await registerUser(page, uniqueUser('tag0'));
    await expect(page.locator('h2:has-text("Tag Management")')).toBeVisible();
    await expect(page.locator('input[placeholder="Tag name"]')).toBeVisible();
    await expect(page.locator('button:has-text("Create Tag")')).toBeVisible();
  });

  test('create a tag', async ({ page }) => {
    await registerUser(page, uniqueUser('tag1'));
    const tagName = `work-${Date.now()}`;
    await createTag(page, tagName, '#3B82F6');
    await expect(page.locator(`.tag-pill:has-text("${tagName}")`)).toBeVisible({ timeout: 5000 });
  });

  test('create multiple tags', async ({ page }) => {
    await registerUser(page, uniqueUser('tag2'));
    const tag1 = `urgent-${Date.now()}`;
    const tag2 = `personal-${Date.now()}`;
    await createTag(page, tag1);
    await createTag(page, tag2);
    await expect(page.locator(`.tag-pill:has-text("${tag1}")`)).toBeVisible();
    await expect(page.locator(`.tag-pill:has-text("${tag2}")`)).toBeVisible();
  });

  test('delete a tag', async ({ page }) => {
    await registerUser(page, uniqueUser('tag3'));
    const tagName = `delete-tag-${Date.now()}`;
    await createTag(page, tagName);

    const tagRow = page.locator(`.tag-row:has-text("${tagName}")`);
    await tagRow.locator('button:has-text("Delete")').click();
    await expect(page.locator(`.tag-pill:has-text("${tagName}")`)).not.toBeVisible({ timeout: 5000 });
  });

  test('assign tag to todo shows tag pill on item', async ({ page }) => {
    await registerUser(page, uniqueUser('tag4'));
    const tagName = `assign-tag-${Date.now()}`;
    await createTag(page, tagName);

    const todoTitle = `Tagged Todo ${Date.now()}`;
    await page.fill('label:has-text("Title") input', todoTitle);
    const tagsSelect = page.locator('label:has-text("Tags") select');
    await tagsSelect.selectOption({ label: tagName });
    await page.click('button:has-text("Create Todo")');
    await page.waitForSelector(`.todo-item:has-text("${todoTitle}")`, { timeout: 8000 });

    const todoItem = page.locator(`.todo-item:has-text("${todoTitle}")`).first();
    await expect(todoItem.locator(`.tag-pill:has-text("${tagName}")`)).toBeVisible({ timeout: 5000 });
  });

  test('clicking tag pill filters todos', async ({ page }) => {
    await registerUser(page, uniqueUser('tag5'));
    const tagName = `filter-tag-${Date.now()}`;
    await createTag(page, tagName);

    const taggedTitle = `Tagged ${Date.now()}`;
    await page.fill('label:has-text("Title") input', taggedTitle);
    await page.locator('label:has-text("Tags") select').selectOption({ label: tagName });
    await page.click('button:has-text("Create Todo")');
    await page.waitForSelector(`.todo-item:has-text("${taggedTitle}")`);

    // Create an untagged todo too
    await createTodo(page, `Untagged ${Date.now()}`);

    // Click the tag pill to filter
    const todoItem = page.locator(`.todo-item:has-text("${taggedTitle}")`).first();
    await todoItem.locator(`.tag-pill:has-text("${tagName}")`).click();

    // Filter indicator should appear
    await expect(page.locator(`strong:has-text("${tagName}")`)).toBeVisible({ timeout: 5000 });
  });
});
