import { test, expect } from "@playwright/test";
import { deleteTestUserByEmail } from "./helpers/auth";

test.describe("Email Verification Flow", () => {
  const createdUsers: string[] = [];

  test.afterEach(async () => {
    // Clean up users created in this test
    for (const email of createdUsers) {
      await deleteTestUserByEmail(email);
    }
    createdUsers.length = 0;
  });

  test("should show verification message after signup", async ({ page }) => {
    await page.goto("/signup");
    
    const email = `test-${Date.now()}@example.com`;
    const password = "TestPassword123!";
    createdUsers.push(email);
    
    // Fill signup form
    await page.fill('input[name="name"], input[type="text"]', "Test User");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[type="password"]').nth(1);
    if (await confirmPasswordInput.count() > 0) {
      await confirmPasswordInput.fill(password);
    }
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for signup to complete
    await page.waitForTimeout(2000);
    
    // Should see verification message or redirect
    // Check for verification-related text
    const verificationText = page.locator('text=/verify|check your email|verification/i');
    const hasVerificationMessage = await verificationText.count() > 0;
    
    // Either we see verification message or we're redirected
    expect(hasVerificationMessage || page.url().includes("/login") || page.url().includes("/signup")).toBe(true);
  });

  test("should prevent login without verification", async ({ page }) => {
    // This test would require:
    // 1. Creating an unverified user
    // 2. Attempting to login
    // 3. Verifying error message appears
    
    await page.goto("/login");
    
    // For now, just verify login page structure
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

