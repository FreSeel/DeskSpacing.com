import { defineConfig } from 'vite';
import { legacySite } from './scripts/legacy-site.js';

export default defineConfig({
  base: './',
  publicDir: false,
  appType: 'mpa',
  plugins: [legacySite()],
  server: { strictPort: true },
  preview: { strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: false,
    lib: {
      entry: 'js/share-url.js',
      formats: ['iife'],
      name: 'DeskSpacingSharing',
      fileName: () => 'js/share-url.js',
    },
  },
});
