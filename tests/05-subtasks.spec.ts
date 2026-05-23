import { test, expect } from '@playwright/test';
import { registerUser, createTodo, addSubtask, uniqueUser } from './helpers';

test.describe('Feature 05: Subtasks & Progress Tracking', () => {
  test('add subtask to a todo', async ({ page }) => {
    await registerUser(page, uniqueUser('sub1'));
    const title = `Subtask Parent ${Date.now()}`;
    await createTodo(page, title);
    await addSubtask(page, title, 'First subtask');
    const todoItem = page.locator(`.todo-item:has-text("${title}")`).first();
    await expect(todoItem.locator('text="First subtask"')).toBeVisible();
  });

  test('add multiple subtasks and see progress text', async ({ page }) => {
    await registerUser(page, uniqueUser('sub2'));
    const title = `Multi Subtask ${Date.now()}`;
    await createTodo(page, title);
    await addSubtask(page, title, 'Subtask A');
    await addSubtask(page, title, 'Subtask B');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`).first();
    await expect(todoItem.locator('text=/Progress: 0\\/2/')).toBeVisible({ timeout: 5000 });
  });

  test('toggle subtask updates progress', async ({ page }) => {
    await registerUser(page, uniqueUser('sub3'));
    const title = `Progress Test ${Date.now()}`;
    await createTodo(page, title);
    await addSubtask(page, title, 'Task 1');
    await addSubtask(page, title, 'Task 2');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`).first();
    await todoItem.locator('text="Task 1"').locator('..').locator('input[type="checkbox"]').click();
    await expect(todoItem.locator('text=/Progress: 1\\/2/')).toBeVisible({ timeout: 5000 });
  });

  test('delete subtask removes it', async ({ page }) => {
    await registerUser(page, uniqueUser('sub4'));
    const title = `Delete Subtask ${Date.now()}`;
    await createTodo(page, title);
    await addSubtask(page, title, 'To Delete');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`).first();
    const subtaskRow = todoItem.locator('text="To Delete"').locator('../../..');
    await subtaskRow.locator('button:has-text("Delete")').click();
    await expect(todoItem.locator('text="To Delete"')).not.toBeVisible({ timeout: 5000 });
  });

  test('progress bar renders when subtasks exist', async ({ page }) => {
    await registerUser(page, uniqueUser('sub5'));
    const title = `Progress Bar ${Date.now()}`;
    await createTodo(page, title);
    await addSubtask(page, title, 'A task');

    const todoItem = page.locator(`.todo-item:has-text("${title}")`).first();
    await expect(todoItem.locator('progress')).toBeVisible({ timeout: 5000 });
  });

  test('subtask input and button are visible on todo', async ({ page }) => {
    await registerUser(page, uniqueUser('sub6'));
    const title = `Subtask Input ${Date.now()}`;
    await createTodo(page, title);

    const todoItem = page.locator(`.todo-item:has-text("${title}")`).first();
    await expect(todoItem.locator('input[placeholder="New subtask"]')).toBeVisible();
    await expect(todoItem.locator('button:has-text("Add Subtask")')).toBeVisible();
  });
});
