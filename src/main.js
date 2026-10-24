import { createApp } from './app/createApp.js';
import { initializePage } from './app/pageSetup.js';
import * as THREE from './engine.js';

const disposePage = initializePage(window);
export const app = createApp({ THREE, host: window, document });
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    app.dispose();
    disposePage();
  });
