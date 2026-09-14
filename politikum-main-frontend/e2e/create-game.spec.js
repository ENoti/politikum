import { test, expect } from '@playwright/test';

test('create, join, start and restore the game board without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/move\/tick(Bot)?(?:\?|$)/.test(request.url())) errors.push('Browser attempted to drive the server clock');
  });
  page.on('response', response => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('Browser smoke test');
    else {
      errors.push(dialog.message());
      await dialog.dismiss();
    }
  });
  await page.goto('/');
  const createResponse = page.waitForResponse(response => response.url().endsWith('/games/politikum/create'));
  await page.getByRole('button', { name: 'Начать игру', exact: true }).click();
  const created = await createResponse;
  expect(created.status()).toBe(200);
  expect((await created.json()).matchID).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Добавить бота', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Старт', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Добавить бота', exact: true })).toBeVisible();
  const botResponse = page.waitForResponse(response => response.url().endsWith('/move/addBot'));
  await page.getByRole('button', { name: 'Добавить бота', exact: true }).click();
  expect((await (await botResponse).json()).ok).toBe(true);
  const startResponse = page.waitForResponse(response => response.url().endsWith('/move/startGame'));
  await page.getByRole('button', { name: 'Старт', exact: true }).click();
  expect((await (await startResponse).json()).ok).toBe(true);
  await expect(page.getByRole('button', { name: 'Закончить ход', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Закончить ход', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a failed create request keeps the welcome page usable', async ({ page }) => {
  const errors = [];
  const alerts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('Failed create test');
    else { alerts.push(dialog.message()); await dialog.dismiss(); }
  });
  await page.route('**/games/politikum/create', route => route.fulfill({
    status: 502, contentType: 'text/html', body: 'Bad Gateway',
  }));
  await page.goto('/');
  const create = page.getByRole('button', { name: 'Начать игру', exact: true });
  await create.click();
  await expect.poll(() => alerts).toEqual(['createMatch failed: HTTP 502']);
  await expect(create).toBeVisible();
  await expect(create).toBeEnabled();
  expect(errors).toEqual([]);
});
