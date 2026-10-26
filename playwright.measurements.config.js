import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Focused feature checks against source, with no full production build required.
export default defineConfig({
  ...base,
  testMatch: ['measurements.spec.js', 'dimensions.spec.js'],
  webServer: {
    ...base.webServer,
    command: 'npm run dev -- --port 4173 --base=/DeskSpacing.com/',
  },
});
