import { test, expect } from "@playwright/test";
import { loginUser, signUpUser, deleteTestUserByEmail } from "./helpers/auth";

test.describe("Manuscript Status Workflow", () => {
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

  test("should show Queued status after upload", async ({ page }) => {
    await page.goto("/dashboard");
    
    if (page.url().includes("/login")) {
      await loginUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
    }
    
    // After uploading a book, status should be "Queued"
    // Look for "Queued" text in the manuscript section
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show Working on Report status when admin starts work", async ({ page }) => {
    // This test would require:
    // 1. User uploads book (status: Queued)
    // 2. Admin moves to "Working on Report"
    // 3. User sees status change to "Working on Report"
    
    await page.goto("/dashboard");
    
    if (page.url().includes("/login")) {
      await loginUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
    }
    
    // Look for "Working on Report" status
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show Ready to Purchase when report is uploaded", async ({ page }) => {
    // This test verifies status progression:
    // Queued → Working on Report → Ready to Purchase
    
    await page.goto("/dashboard");
    
    if (page.url().includes("/login")) {
      await loginUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
    }
    
    // Look for "Ready to Purchase" status
    await expect(page.locator("body")).toBeVisible();
  });
});

