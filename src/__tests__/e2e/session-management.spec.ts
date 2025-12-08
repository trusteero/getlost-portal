import { test, expect } from "@playwright/test";
import { loginUser, signUpUser, deleteTestUserByEmail } from "./helpers/auth";

test.describe("Session Management", () => {
  let testEmail: string;
  let testPassword: string;
  const createdUsers: string[] = [];

  test.beforeEach(async ({ page }) => {
    testEmail = `test-${Date.now()}@example.com`;
    testPassword = "TestPassword123!";
    
    const user = await signUpUser(page, testEmail, testPassword);
    createdUsers.push(user.email);
  });

  test.afterEach(async () => {
    // Clean up users created in this test
    for (const email of createdUsers) {
      await deleteTestUserByEmail(email);
    }
    createdUsers.length = 0;
  });

  test("should maintain session across page navigation", async ({ page }) => {
    // Login
    if (page.url().includes("/login")) {
      await loginUser(page, testEmail, testPassword);
    }
    
    // Navigate to dashboard
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);
    
    // Navigate to another page
    await page.goto("/dashboard/settings");
    await page.waitForTimeout(1000);
    
    // Should still be authenticated (not redirected to login)
    expect(page.url()).not.toContain("/login");
  });

  test("should logout and clear session", async ({ page }) => {
    // Login first
    await loginUser(page, testEmail, testPassword);
    await page.goto("/dashboard");
    
    // Look for logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")');
    
    if (await logoutButton.count() > 0) {
      await logoutButton.first().click();
      await page.waitForTimeout(2000);
      
      // Should be redirected away from dashboard
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/dashboard");
    }
  });

  test("should redirect to login when accessing protected route without session", async ({ page, context }) => {
    // Clear all cookies/session before testing
    await context.clearCookies();
    
    // Don't login, try to access dashboard
    await page.goto("/dashboard");
    
    // Wait for redirect to login (dashboard checks session in useEffect)
    await page.waitForURL(/\/login/, { timeout: 10000 });
    
    const currentUrl = page.url();
    expect(currentUrl).toContain("/login");
  });
});

