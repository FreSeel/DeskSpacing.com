import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testMatch: 'model-imports.spec.js',
  webServer: {
    ...base.webServer,
    command: 'npm run dev -- --port 4173 --base=/DeskSpacing.com/',
  },
});
