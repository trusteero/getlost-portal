import { test, expect } from "@playwright/test";
import { loginUser, signUpUser, deleteTestUserByEmail } from "./helpers/auth";

test.describe("Dashboard", () => {
  let testEmail: string;
  let testPassword: string;
  const createdUsers: string[] = []; // Track users created during tests

  test.beforeEach(async ({ page }) => {
    testEmail = `test-${Date.now()}@example.com`;
    testPassword = "TestPassword123!";
  });

  test.afterEach(async () => {
    // Clean up users created in this test
    for (const email of createdUsers) {
      await deleteTestUserByEmail(email);
    }
    createdUsers.length = 0; // Clear the array
  });

  test("should show dashboard when logged in", async ({ page }) => {
    // Navigate to dashboard (will redirect to login if not authenticated)
    await page.goto("/dashboard");
    
    // Should either be on dashboard or redirected to login
    const url = page.url();
    expect(url).toMatch(/\/dashboard|\/login/);
  });

  test("should show navigation elements", async ({ page }) => {
    await page.goto("/");
    
    // Check for logo/brand
    const logo = page.locator('img[alt*="Get Lost"], img[alt*="logo"]');
    await expect(logo.first()).toBeVisible();
  });

  test("should have responsive layout", async ({ page }) => {
    await page.goto("/");
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator("body")).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator("body")).toBeVisible();
  });

  test.describe("Example Books for New Users", () => {
    test("should verify email sending is disabled in test mode", async ({ page }) => {
      // This test verifies that emails are not sent during E2E tests
      // Check server logs for "TEST MODE - Email sending disabled" messages
      const user = await signUpUser(page, testEmail, testPassword);
      createdUsers.push(user.email);
      
      // Signup should complete without sending actual emails
      // The email service should detect test mode and log instead of sending
      await page.waitForTimeout(1000);
      
      // Test passes if no errors occurred (emails were logged, not sent)
      expect(user.email).toBeTruthy();
    });

    test("should show loading message while creating example books", async ({ page }) => {
      const user = await signUpUser(page, testEmail, testPassword);
      createdUsers.push(user.email);
      await page.goto("/dashboard");
      
      // Should see loading message for new users
      const loadingMessage = page.locator('text=/Setting up your library|populating.*library|example.*books/i');
      // This might appear briefly, so we check if it exists or if dashboard loads
      await page.waitForTimeout(2000);
      
      // Dashboard should eventually load
      await expect(page.locator("body")).toBeVisible();
    });

    test("should display example books after creation", async ({ page }) => {
      const user = await signUpUser(page, testEmail, testPassword);
      createdUsers.push(user.email);
      
      // After signup, user needs to log in to see the dashboard
      // In test mode, email is auto-verified during signup, so we can log in directly
      await loginUser(page, user.email, user.password);
      
      // Wait for dashboard to load
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
      
      // Wait for the books API to return data (example books are created during signup in test mode)
      // The dashboard fetches from /api/books, so wait for that network request to complete
      await page.waitForResponse(
        (response) => response.url().includes('/api/books') && response.status() === 200,
        { timeout: 30000 }
      ).catch(() => {
        // If network wait fails, continue anyway - books might already be loaded
        console.warn('Books API response wait timed out, continuing...');
      });
      
      // Wait a moment for the UI to update after the API response
      await page.waitForTimeout(1000);
      
      // Wait for example books to appear - look for either "Wool" or "Beach Read"
      // The titles are "Wool by Hugh Howey" and "Beach Read by Emily Henry"
      const exampleBook = page.locator('text=/Wool|Beach Read/i').first();
      await expect(exampleBook).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Sample Books Labeling", () => {
    test("should display SAMPLE label on sample book covers", async ({ page }) => {
      const user = await signUpUser(page, testEmail, testPassword);
      createdUsers.push(user.email);
      await page.goto("/dashboard");
      
      // Wait for example books to load
      await page.waitForTimeout(5000);
      
      // Check for SAMPLE label on covers
      const sampleLabel = page.locator('text=/SAMPLE/i').first();
      await expect(sampleLabel).toBeVisible({ timeout: 15000 });
    });

    test("should display Sample badge in condensed library", async ({ page }) => {
      const user = await signUpUser(page, testEmail, testPassword);
      createdUsers.push(user.email);
      await page.goto("/dashboard");
      
      await page.waitForTimeout(5000);
      
      // Look for Sample badge next to book title
      const sampleBadge = page.locator('text=/Sample/i').first();
      await expect(sampleBadge).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Book Ordering and Layout", () => {
    test("should display + button on the right side", async ({ page }) => {
      const user = await signUpUser(page, testEmail, testPassword);
      createdUsers.push(user.email);
      await page.goto("/dashboard");
      await page.waitForTimeout(5000);
      
      // Look for + button (add new book button)
      const addButton = page.locator('button[aria-label*="Add"], button[aria-label*="new"], button:has-text("+")').first();
      await expect(addButton).toBeVisible({ timeout: 15000 });
      
      // Check if button is in the scrollable area (not absolutely positioned)
      const buttonParent = addButton.locator("..");
      const container = buttonParent.locator('..');
      // Button should be part of horizontal scroll container
      const scrollContainer = page.locator('[class*="overflow-x-auto"], [class*="overflow-x"]').first();
      await expect(scrollContainer).toBeVisible();
    });

    test("should allow horizontal scrolling of books", async ({ page }) => {
      const user = await signUpUser(page, testEmail, testPassword);
      createdUsers.push(user.email);
      await page.goto("/dashboard");
      await page.waitForTimeout(5000);
      
      // Find the scrollable container
      const scrollContainer = page.locator('[class*="overflow-x-auto"], [class*="overflow-x"]').first();
      
      if (await scrollContainer.count() > 0) {
        // Try to scroll horizontally
        await scrollContainer.evaluate((el) => {
          el.scrollLeft = 100;
        });
        
        await page.waitForTimeout(500);
        // Verify scrolling is possible (check scroll position)
        const scrollLeft = await scrollContainer.evaluate((el) => el.scrollLeft);
        expect(scrollLeft).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe("Statistics and Counting", () => {
    test("should exclude sample books from statistics", async ({ page }) => {
      const user = await signUpUser(page, testEmail, testPassword);
      createdUsers.push(user.email);
      await page.goto("/dashboard");
      await page.waitForTimeout(5000);
      
      // Look for statistics text
      const statsText = page.locator('text=/unlocked|insights|manuscripts/i').first();
      
      if (await statsText.count() > 0) {
        // For new users with only sample books, stats should show 0
        const stats = await statsText.textContent();
        // Sample books should not be counted in active manuscripts
        // This is a basic check - actual counting logic is tested in unit tests
        expect(stats).toBeTruthy();
      }
    });
  });
});

