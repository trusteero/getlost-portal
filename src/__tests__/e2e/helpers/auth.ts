import type { Page } from "@playwright/test";

/**
 * Helper to sign up a new user
 * Returns user info including email for cleanup
 */
export async function signUpUser(
  page: Page,
  email: string = `test-${Date.now()}@example.com`,
  password: string = "TestPassword123!",
  name: string = "Test User"
) {
  await page.goto("/signup");
  await page.waitForSelector('input[type="email"]');
  
  await page.fill('input[name="name"], input[type="text"]', name);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[type="password"]').nth(1);
  if (await confirmPasswordInput.count() > 0) {
    await confirmPasswordInput.fill(password);
  }
  
  await page.click('button[type="submit"]');
  
  // Wait for signup to complete (either redirect or success message)
  await page.waitForTimeout(2000);
  
  return { email, password, name };
}

/**
 * Helper to delete a test user by email
 * Uses the test cleanup API endpoint
 */
export async function deleteTestUserByEmail(email: string): Promise<void> {
  try {
    // Get base URL from environment or default to localhost
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
    
    const response = await fetch(`${baseURL}/api/test/cleanup/user`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      // Only log warning if it's not a 404 (user might already be deleted)
      if (response.status !== 404) {
        console.warn(`Failed to delete test user ${email}:`, error);
      }
    } else {
      console.log(`✅ Deleted test user: ${email}`);
    }
  } catch (error) {
    // Silently fail - cleanup is best effort
    console.warn(`Failed to delete test user ${email}:`, error);
  }
}

/**
 * Helper to login a user
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]');
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for login to complete
  await page.waitForURL(/\/dashboard/, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

/**
 * Helper to create a test user via API (for E2E tests that need existing users)
 */
export async function createTestUserViaAPI(email: string, password: string, name: string) {
  // This would call the signup API directly
  // For now, we'll use the UI flow
}

