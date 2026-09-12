import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:14173',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/backend.mjs',
      url: 'http://127.0.0.1:18081/games/politikum',
      timeout: 90000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 14173 --strictPort',
      env: { VITE_API_SERVER: 'http://127.0.0.1:18081' },
      url: 'http://127.0.0.1:14173',
      reuseExistingServer: false,
    },
  ],
});
