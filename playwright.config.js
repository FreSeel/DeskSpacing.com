import { defineConfig } from '@playwright/test';

// Exercise the actual production output under a GitHub Pages-style project path.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/DeskSpacing.com/',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --base=/DeskSpacing.com/',
    url: 'http://127.0.0.1:4173/DeskSpacing.com/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
