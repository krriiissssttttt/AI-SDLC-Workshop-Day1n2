import { test, expect } from '@playwright/test';
import { registerUser, loginUser, setupVirtualAuthenticator, uniqueUser } from './helpers';

test.describe('Feature 11: Authentication (WebAuthn)', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user is redirected to /login from /calendar', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL('/login');
  });

  test('login page loads with Register and Login buttons', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button:has-text("Register")')).toBeVisible();
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
  });

  test('register a new user and land on home page', async ({ page }) => {
    const username = uniqueUser('auth-reg');
    await registerUser(page, username);
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1:has-text("Todo App")')).toBeVisible();
  });

  test('registered user can log out and login again', async ({ page }) => {
    const username = uniqueUser('auth-login');
    await registerUser(page, username);

    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL('/login');

    // Login again
    await loginUser(page, username);
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1:has-text("Todo App")')).toBeVisible();
  });

  test('authenticated user visiting /login is redirected to home', async ({ page }) => {
    const username = uniqueUser('auth-already');
    await registerUser(page, username);

    // Now try to navigate to /login while already authenticated
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });

  test('logout clears session - protected route needs re-auth', async ({ page }) => {
    const username = uniqueUser('auth-logout');
    await registerUser(page, username);

    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL('/login');

    // Try to access protected route
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('register fails when username is empty', async ({ page }) => {
    await page.goto('/login');
    await setupVirtualAuthenticator(page);
    await page.click('button:has-text("Register")');
    // Should show an error message, not redirect
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[aria-live="polite"]')).toContainText('username');
  });
});
