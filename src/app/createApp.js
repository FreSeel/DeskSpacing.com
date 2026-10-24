import { createScene } from '../scene/createScene.js';
import { createObjectFactory } from '../models/objectFactory.js';
import { createObjectStore } from '../state/objectStore.js';
import { createActions } from '../state/actions.js';
import { createSelection } from '../interactions/selection.js';
import { bindPointer } from '../interactions/pointer.js';
import { bindKeyboard } from '../interactions/keyboard.js';
import { createSharing } from '../sharing/createSharing.js';
import { readSetupParameter } from '../sharing/shareUrl.js';
import { createFeedback } from '../ui/feedback.js';
import { bindPlannerUI } from '../ui/bindPlannerUI.js';

export function createApp({ THREE, host, document }) {
  host.performance.mark('planner:init-start');
  const canvas = document.getElementById('threeCanvas');
  const view = createScene({
    THREE,
    canvas,
    container: document.getElementById('rightSideContainer'),
    host,
  });
  host.performance.mark('planner:scene-ready');
  host.performance.measure(
    'planner:scene-init',
    'planner:init-start',
    'planner:scene-ready',
  );
  const factory = createObjectFactory({ THREE });
  const state = createObjectStore({
    scene: view.scene,
    disposeObject: factory.dispose,
    onChange: view.invalidateScene,
  });
  const selection = createSelection({
    THREE,
    camera: view.camera,
    transformControls: view.transformControls,
    getObjects: () => state.objects,
    removeObject: (object) => state.remove(object),
  });
  const actions = createActions({ state, selection, factory });
  const sharing = createSharing({
    state,
    actions,
    getLocation: () => host.location.href,
  });
  const feedback = createFeedback(document);
  feedback.loading(true);
  canvas.setAttribute('aria-busy', 'true');
  const cleanup = [
    bindPointer({
      host,
      document,
      canvas,
      selection,
      controls: view.controls,
      transformControls: view.transformControls,
    }),
    bindKeyboard({
      host,
      selection,
      transformControls: view.transformControls,
    }),
    bindPlannerUI({
      document,
      actions,
      selection,
      resetCamera: view.resetCamera,
      sharing,
      feedback,
    }),
  ];
  let disposed = false;
  const ready = sharing
    .loadFromUrl()
    .then(() => undefined)
    .catch(async (error) => {
      if (disposed) return;
      feedback.error(error);
      // Invalid initial links get the same usable defaults as a fresh visit.
      // A later failed restore preserves the current setup in actions.restore().
      if (
        readSetupParameter(host.location.href) !== null &&
        state.objects.length === 0
      ) {
        await actions.initialize().catch((failure) => {
          if (!disposed) feedback.error(failure);
        });
      }
    })
    .finally(() => {
      if (disposed) return;
      feedback.loading(false);
      canvas.setAttribute('aria-busy', 'false');
      host.performance.mark('planner:assets-ready');
    });
  function dispose() {
    if (disposed) return;
    disposed = true;
    cleanup.forEach((remove) => remove());
    actions.reset();
    factory.disposeAll();
    feedback.dispose();
    view.dispose();
  }
  return { state, actions, selection, sharing, view, ready, dispose };
}
