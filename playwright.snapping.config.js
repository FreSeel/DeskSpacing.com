import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Focused source verification without copying assets or running a production build.
export default defineConfig({
  ...base,
  testMatch: 'snapping.spec.js',
  webServer: {
    ...base.webServer,
    command: 'npm run dev -- --port 4173 --base=/DeskSpacing.com/',
  },
});
