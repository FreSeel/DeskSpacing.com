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
    reportCompressedSize: true,
    minify: true,
    lib: {
      entry: { planner: 'src/main.js', 'share-url': 'js/share-url.js' },
      formats: ['es'],
      fileName: (_format, name) =>
        name === 'planner' ? 'src/main.js' : 'js/share-url.js',
    },
  },
});
