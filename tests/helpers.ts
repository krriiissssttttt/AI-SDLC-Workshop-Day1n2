import { type Page, type BrowserContext } from '@playwright/test';

// Track contexts where WebAuthn has already been enabled to avoid double-setup errors.
const webAuthnEnabledContexts = new WeakSet<BrowserContext>();

/**
 * Set up a virtual WebAuthn authenticator for the given page via Chrome DevTools Protocol.
 * Safe to call multiple times on the same browser context — sets up only once.
 */
export async function setupVirtualAuthenticator(page: Page) {
  const context = page.context();
  if (webAuthnEnabledContexts.has(context)) {
    return; // Already configured for this context
  }

  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });

  webAuthnEnabledContexts.add(context);
  return client;
}

/**
 * Register a new user and land on the home page.
 */
export async function registerUser(page: Page, username: string) {
  await page.goto('/login');
  await setupVirtualAuthenticator(page);
  await page.fill('#username', username);
  await page.click('button:has-text("Register")');
  await page.waitForURL('/', { timeout: 15_000 });
}

/**
 * Log in an existing user and land on the home page.
 */
export async function loginUser(page: Page, username: string) {
  await page.goto('/login');
  await setupVirtualAuthenticator(page);
  await page.fill('#username', username);
  await page.click('button:has-text("Login")');
  await page.waitForURL('/', { timeout: 15_000 });
}

/**
 * Generate a unique test username so concurrent / repeated test runs don't collide.
 */
export function uniqueUser(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

/**
 * Create a todo via the main page form and wait for it to appear in the list.
 */
export async function createTodo(
  page: Page,
  title: string,
  options?: {
    priority?: 'high' | 'medium' | 'low';
    recurrence?: string;
    dueDate?: string;
  }
) {
  await page.fill('label:has-text("Title") input', title);

  if (options?.priority) {
    await page.selectOption('label:has-text("Priority") select', options.priority);
  }

  if (options?.dueDate) {
    await page.fill('input[type="datetime-local"]', options.dueDate);
  }

  if (options?.recurrence) {
    await page.selectOption('label:has-text("Recurrence") select', options.recurrence);
  }

  await page.click('button:has-text("Create Todo")');
  await page.waitForSelector(`.todo-item:has-text("${title}")`, { timeout: 8_000 });
}

/**
 * Add a subtask to an existing todo item.
 */
export async function addSubtask(page: Page, todoTitle: string, subtaskTitle: string) {
  const todoItem = page.locator(`.todo-item:has-text("${todoTitle}")`).first();
  await todoItem.locator('input[placeholder="New subtask"]').fill(subtaskTitle);
  await todoItem.locator('button:has-text("Add Subtask")').click();
  await page.waitForSelector(`text="${subtaskTitle}"`, { timeout: 5_000 });
}

/**
 * Create a tag via the Tag Management section.
 */
export async function createTag(page: Page, name: string, color?: string) {
  await page.fill('input[placeholder="Tag name"]', name);
  if (color) {
    await page.locator('input[type="color"]').fill(color);
  }
  await page.click('button:has-text("Create Tag")');
  await page.waitForSelector(`text="${name}"`, { timeout: 5_000 });
}

/**
 * Get a future datetime-local string (N minutes from now) formatted for input[type=datetime-local].
 */
export function futureDatetimeLocal(minutesFromNow = 30): string {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
