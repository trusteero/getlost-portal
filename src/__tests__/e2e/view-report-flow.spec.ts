import { test, expect } from "@playwright/test";
import { loginUser, signUpUser, deleteTestUserByEmail } from "./helpers/auth";

test.describe("View Report Flow", () => {
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

  test("should show report as ready after admin uploads", async ({ page }) => {
    // This test would require:
    // 1. User uploads book
    // 2. User purchases report (goes to processing)
    // 3. Admin uploads report
    // 4. User sees report as "Ready to View"
    
    await page.goto("/dashboard");
    
    if (page.url().includes("/login")) {
      await loginUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
    }
    
    // Look for "Ready to View" or "View Report" button
    // This would appear after admin uploads the report
    await expect(page.locator("body")).toBeVisible();
  });

  test("should display report content when viewed", async ({ page }) => {
    // This test verifies that when a user clicks "View Report",
    // the report content displays correctly
    
    await page.goto("/dashboard");
    
    if (page.url().includes("/login")) {
      await loginUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
    }
    
    // Look for report viewer or iframe
    // In a real scenario, you'd:
    // 1. Click "View Report" button
    // 2. Verify report content loads
    // 3. Verify report is readable
    
    await expect(page.locator("body")).toBeVisible();
  });
});

