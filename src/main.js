import { createApp } from './app/createApp.js';
import { initializePage } from './app/pageSetup.js';

// The only engine-global boundary: retain the pinned engine and customized addons.
const disposePage = initializePage(window);
export const app = createApp({ THREE: window.THREE, host: window, document });
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    app.dispose();
    disposePage();
  });
