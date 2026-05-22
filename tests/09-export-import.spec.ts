import { test, expect } from '@playwright/test';
import { registerUser, createTodo, uniqueUser } from './helpers';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

test.describe('Feature 09: Export & Import', () => {
  test('export/import section is visible', async ({ page }) => {
    await registerUser(page, uniqueUser('exp0'));
    await expect(page.locator('h2:has-text("Export / Import")')).toBeVisible();
    await expect(page.locator('button:has-text("Export Todos")')).toBeVisible();
    await expect(page.locator('text="Import JSON"')).toBeVisible();
  });

  test('export button triggers file download', async ({ page }) => {
    await registerUser(page, uniqueUser('exp1'));
    await createTodo(page, `Export Todo ${Date.now()}`);

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Todos")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^todo-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });

  test('exported file contains valid JSON with version field', async ({ page }) => {
    await registerUser(page, uniqueUser('exp2'));
    await createTodo(page, `Export Content Test ${Date.now()}`);

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Todos")');
    const download = await downloadPromise;

    const tmpPath = path.join(os.tmpdir(), `test-export-${Date.now()}.json`);
    await download.saveAs(tmpPath);

    const content = await fs.readFile(tmpPath, 'utf-8');
    const data = JSON.parse(content) as { version: string; data: { todos: unknown[] } };
    expect(data).toHaveProperty('version', '1.0');
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data.todos)).toBe(true);

    await fs.unlink(tmpPath).catch(() => {});
  });

  test('import valid JSON file shows success message', async ({ page }) => {
    await registerUser(page, uniqueUser('exp3'));
    await createTodo(page, `Import Test ${Date.now()}`);

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Todos")');
    const download = await downloadPromise;

    const tmpPath = path.join(os.tmpdir(), `test-import-${Date.now()}.json`);
    await download.saveAs(tmpPath);

    await page.selectOption('select:has(option[value="merge"])', 'replace');
    await page.locator('input[type="file"]').setInputFiles(tmpPath);
    await expect(page.locator('text=/Imported .* todos/')).toBeVisible({ timeout: 8000 });

    await fs.unlink(tmpPath).catch(() => {});
  });

  test('import invalid JSON shows error', async ({ page }) => {
    await registerUser(page, uniqueUser('exp4'));

    const tmpPath = path.join(os.tmpdir(), `test-bad-${Date.now()}.json`);
    await fs.writeFile(tmpPath, 'not valid json');

    await page.locator('input[type="file"]').setInputFiles(tmpPath);
    await expect(page.locator('text=/Invalid JSON file/')).toBeVisible({ timeout: 5000 });

    await fs.unlink(tmpPath).catch(() => {});
  });

  test('merge/replace mode selector is available', async ({ page }) => {
    await registerUser(page, uniqueUser('exp5'));
    await expect(page.locator('select:has(option[value="merge"])')).toBeVisible();
    const opts = await page.evaluate(() => Array.from(document.querySelectorAll('select option')).map(o => o.getAttribute('value')));
    expect(opts).toContain('replace');
    expect(opts).toContain('merge');
  });
});
