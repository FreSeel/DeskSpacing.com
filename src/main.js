import { createApp } from './app/createApp.js';
import * as THREE from './engine.js';

let started = null;
try {
  started = createApp({ THREE, host: window, document });
} catch {
  document.querySelector('.editor-shell').inert = true;
  const failure = document.getElementById('graphicsFailure');
  failure.hidden = false;
  failure.focus();
}
export const app = started;
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    app?.dispose();
  });
