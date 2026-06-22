import type { Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

const remoteRoutePattern = /\/_app\/remote\//;

const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
] as const;

for (const viewport of viewports) {
  test(`shows per-environment skeletons while dashboard data is pending (${viewport.name})`, async ({
    page
  }, testInfo) => {
    const pendingRoutes: Route[] = [];

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.route(remoteRoutePattern, (route) => {
      pendingRoutes.push(route);
    });

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: 'Estado de servicios SIFEN' })).toBeVisible();
      const refreshButton = page.getByRole('button', { name: /Actualizar/ });
      await expect(refreshButton).toBeVisible();
      await refreshButton.click();
      await expect(page.getByRole('button', { name: /Actualizando/ })).toBeVisible();
      await expect(page.getByTestId('last-sample-skeleton')).toBeVisible();
      await expect(page.getByTestId('produccion-skeleton')).toBeVisible();
      await expect(page.getByTestId('test-skeleton')).toBeVisible();

      await expect(
        page.getByTestId('produccion-skeleton').locator('[data-slot="card"]')
      ).toHaveCount(6);
      await expect(page.getByTestId('test-skeleton').locator('[data-slot="card"]')).toHaveCount(6);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);

      await page.screenshot({
        path: testInfo.outputPath(`dashboard-skeleton-${viewport.name}.png`),
        fullPage: true
      });
    } finally {
      await Promise.allSettled(pendingRoutes.map((route) => route.abort('aborted')));
      await page.unroute(remoteRoutePattern);
    }
  });
}
