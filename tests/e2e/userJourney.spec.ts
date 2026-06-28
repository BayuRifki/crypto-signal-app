import { test, expect } from '@playwright/test';

/**
 * E2E user journey tests for the crypto signal app.
 * Requires dev server running on http://localhost:3000
 */

test.describe('Main user journey', () => {
  test('page loads with signal panel and chart', async ({ page }) => {
    await page.goto('/');

    // Verify main layout elements exist
    await expect(page.locator('text=Weight Lab')).toBeVisible();
    await expect(page.locator('text=Structure')).toBeVisible();
    await expect(page.locator('text=Backtest')).toBeVisible();
    await expect(page.locator('text=History')).toBeVisible();

    // Verify exchange selector buttons
    await expect(page.locator('button[role="radio"]:has-text("Binance")')).toBeVisible();
    await expect(page.locator('button[role="radio"]:has-text("OKX")')).toBeVisible();
    await expect(page.locator('button[role="radio"]:has-text("Bybit")')).toBeVisible();

    // Verify timeframe selector (now in chart toolbar)
    await expect(page.locator('button[aria-label="Set timeframe to 1h"]')).toBeVisible();
  });

  test('can switch exchange', async ({ page }) => {
    await page.goto('/');

    const okxBtn = page.locator('button[role="radio"]:has-text("OKX")');
    await okxBtn.click();
    await expect(okxBtn).toHaveAttribute('aria-checked', 'true');

    const binanceBtn = page.locator('button[role="radio"]:has-text("Binance")');
    await expect(binanceBtn).toHaveAttribute('aria-checked', 'false');
  });

  test('can switch timeframe', async ({ page }) => {
    await page.goto('/');

    const tf4h = page.locator('button[aria-label="Set timeframe to 4h"]');
    await tf4h.click();
    await expect(tf4h).toHaveClass(/bg-accent/);

    const tf1h = page.locator('button[aria-label="Set timeframe to 1h"]');
    await expect(tf1h).not.toHaveClass(/bg-accent/);
  });

  test('pair selector opens and shows options', async ({ page }) => {
    await page.goto('/');

    const pairBtn = page.locator('button[aria-haspopup="listbox"]');
    await pairBtn.click();

    // After click, listbox should be visible
    await expect(page.locator('[role="listbox"]')).toBeVisible();

    // Should show search input
    await expect(page.locator('input[aria-label="Search trading pair"]')).toBeVisible();
  });

  test('demo mode toggle opens settings dialog', async ({ page }) => {
    await page.goto('/');

    const demoBtn = page.locator('button[aria-haspopup="dialog"]');
    await demoBtn.click();

    // Dialog should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Data Source')).toBeVisible();
    await expect(page.locator('text=Live (exchange)')).toBeVisible();
    await expect(page.locator('text=Demo (synthetic)')).toBeVisible();
  });

  test('tabs can be navigated', async ({ page }) => {
    await page.goto('/');

    const backtestTab = page.locator('button[role="tab"]:has-text("Backtest")');
    await backtestTab.click();
    await expect(backtestTab).toHaveAttribute('aria-selected', 'true');

    const historyTab = page.locator('button[role="tab"]:has-text("History")');
    await historyTab.click();
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');
  });
});
