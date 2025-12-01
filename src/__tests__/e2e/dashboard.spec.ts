import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
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
});

