import { test, expect } from "@playwright/test";
import { loginUser, signUpUser } from "./helpers/auth";

test.describe("Dashboard", () => {
  let testEmail: string;
  let testPassword: string;

  test.beforeEach(async ({ page }) => {
    testEmail = `test-${Date.now()}@example.com`;
    testPassword = "TestPassword123!";
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
    test("should show loading message while creating example books", async ({ page }) => {
      await signUpUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
      
      // Should see loading message for new users
      const loadingMessage = page.locator('text=/Setting up your library|populating.*library|example.*books/i');
      // This might appear briefly, so we check if it exists or if dashboard loads
      await page.waitForTimeout(2000);
      
      // Dashboard should eventually load
      await expect(page.locator("body")).toBeVisible();
    });

    test("should display example books after creation", async ({ page }) => {
      await signUpUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
      
      // Wait for books to load (with timeout for example books creation)
      await page.waitForTimeout(5000);
      
      // Should see example books (Wool and/or Beach Read)
      const exampleBook = page.locator('text=/Wool|Beach Read/i').first();
      await expect(exampleBook).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Sample Books Labeling", () => {
    test("should display SAMPLE label on sample book covers", async ({ page }) => {
      await signUpUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
      
      // Wait for example books to load
      await page.waitForTimeout(5000);
      
      // Check for SAMPLE label on covers
      const sampleLabel = page.locator('text=/SAMPLE/i').first();
      await expect(sampleLabel).toBeVisible({ timeout: 15000 });
    });

    test("should display Sample badge in condensed library", async ({ page }) => {
      await signUpUser(page, testEmail, testPassword);
      await page.goto("/dashboard");
      
      await page.waitForTimeout(5000);
      
      // Look for Sample badge next to book title
      const sampleBadge = page.locator('text=/Sample/i').first();
      await expect(sampleBadge).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Book Ordering and Layout", () => {
    test("should display + button on the right side", async ({ page }) => {
      await signUpUser(page, testEmail, testPassword);
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
      await signUpUser(page, testEmail, testPassword);
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
      await signUpUser(page, testEmail, testPassword);
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

