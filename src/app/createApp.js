import { bindImportDialog } from '../ui/importDialog.js';
import { bindProjectsDialog } from '../ui/projectsDialog.js';
import { createImportRegistry } from '../models/importRegistry.js';
import { createModelImports } from '../models/modelImports.js';
import { createLocalProjects } from '../projects/localProjects.js';
import { createMeasurementPreference } from '../measurements/preference.js';
import { bindMeasurementUI } from '../ui/measurementUI.js';
import { bindDimensionAnnotations } from '../scene/dimensionAnnotations.js';
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
import { renderCatalog } from '../ui/catalogRenderer.js';
import { bindEditorShell } from '../ui/editorShell.js';
import { bindSelectionPanel } from '../ui/selectionPanel.js';
import { bindNumericalTransformPanel } from '../ui/numericalTransformPanel.js';
import { bindPreciseSpacingPanel } from '../ui/preciseSpacingPanel.js';
import { bindWorkspaceTheme } from '../theme/workspaceTheme.js';
import { createSnappingPreference } from '../snapping/preference.js';
import { bindSnapping } from '../interactions/snapping.js';
import { bindSnappingUI } from '../ui/snappingUI.js';
import { bindSnappingGuides } from '../scene/snappingGuides.js';
import { bindHistoryUI } from '../ui/historyUI.js';

export function createApp({ THREE, host, document }) {
  const cleanup = [];
  let disposed = false;
  try {
    host.performance.mark('planner:init-start');
    renderCatalog(document);
    const measurements = createMeasurementPreference(host);
    cleanup.push(() => measurements.dispose());
    const measurementUI = bindMeasurementUI({ document, measurements });
    cleanup.push(() => measurementUI.dispose());
    const canvas = document.getElementById('threeCanvas');
    const failure = document.getElementById('graphicsFailure');
    const failureMessage = document.getElementById('graphicsFailureMessage');
    const shellNode = document.querySelector('.editor-shell');
    let contextLost = false;
    function showGraphicsFailure(message) {
      failureMessage.textContent = message;
      failure.hidden = false;
      shellNode.inert = true;
      failure.focus();
    }
    const view = createScene({
      THREE,
      canvas,
      container: document.getElementById('rightSideContainer'),
      host,
      onContextLost() {
        contextLost = true;
        showGraphicsFailure(
          'The graphics connection was lost. The workspace is paused. Wait for recovery or reload the editor.',
        );
      },
      onContextRecovered() {
        if (!contextLost || disposed) return;
        contextLost = false;
        failure.hidden = true;
        if (!document.querySelector('.modal.show')) shellNode.inert = false;
        canvas.focus();
      },
    });
    cleanup.push(() => view.dispose());
    host.performance.mark('planner:scene-ready');
    host.performance.measure(
      'planner:scene-init',
      'planner:init-start',
      'planner:scene-ready',
    );
    const feedback = createFeedback(document);
    cleanup.push(() => feedback.dispose());
    feedback.loading(true);
    const factory = createObjectFactory({
      THREE,
      imports: createImportRegistry(),
    });
    cleanup.push(() => factory.disposeAll());
    const state = createObjectStore({
      scene: view.scene,
      disposeObject: factory.dispose,
      onChange: () => {
        view.invalidateScene();
        feedback.empty(state.objects.length === 0);
      },
    });
    const selection = createSelection({
      THREE,
      camera: view.camera,
      transformControls: view.transformControls,
      getObjects: () => state.objects,
      removeObject: (object) => actions.remove(object),
    });
    const actions = createActions({
      state,
      selection,
      factory,
      invalidateScene: view.invalidateScene,
    });
    cleanup.push(() => actions.dispose());
    // URL/default loading establishes the baseline, not a user editing action.
    actions.history.setEnabled(false);
    const snapping = createSnappingPreference(host);
    cleanup.push(() => snapping.dispose());
    const snappingUI = bindSnappingUI({
      document,
      measurements,
      snapping,
    });
    cleanup.push(() => snappingUI.dispose());
    const snappingGuides = bindSnappingGuides({ document, view });
    cleanup.push(() => snappingGuides.dispose());
    const sharing = createSharing({
      state,
      actions,
      getLocation: () => host.location.href,
    });
    canvas.setAttribute('aria-busy', 'true');
    const shell = bindEditorShell({
      document,
      host,
      transformControls: view.transformControls,
    });
    cleanup.push(() => shell.dispose());
    cleanup.push(
      bindSnapping({
        host,
        canvas,
        view,
        state,
        snapping,
        transforms: actions.transforms,
        onGuidance(guidance, bypass) {
          snappingUI.guidance(guidance, bypass);
          snappingGuides.show(guidance);
        },
      }),
    );
    cleanup.push(
      bindHistoryUI({
        document,
        history: actions.history,
        onError: feedback.error,
      }),
    );
    cleanup.push(
      bindDimensionAnnotations({
        document,
        view,
        selection,
        measurements,
        state,
      }),
    );
    cleanup.push(bindWorkspaceTheme({ host, document, view }));
    cleanup.push(
      bindSelectionPanel({
        document,
        measurements,
        selection,
        actions,
        transformControls: view.transformControls,
        shell,
      }),
    );
    cleanup.push(
      bindNumericalTransformPanel({
        document,
        selection,
        transforms: actions.transforms,
        measurements,
        view,
      }),
    );
    cleanup.push(
      bindPreciseSpacingPanel({
        document,
        selection,
        state,
        transforms: actions.transforms,
        spacing: actions.spacing,
        measurements,
        view,
      }),
    );
    cleanup.push(
      bindPointer({
        canvas,
        selection,
        controls: view.controls,
        transformControls: view.transformControls,
      }),
    );
    cleanup.push(
      bindKeyboard({
        host,
        selection,
        transformControls: view.transformControls,
        transforms: actions.transforms,
        history: actions.history,
        onError: feedback.error,
      }),
    );
    cleanup.push(
      bindPlannerUI({
        document,
        measurements,
        measurementUI,
        actions,
        selection,
        resetCamera: view.resetCamera,
        sharing,
        feedback,
        shell,
      }),
    );
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
          feedback.error(
            new Error(
              `${error.message} The shared setup could not be restored; showing the default setup.`,
            ),
          );
          await actions.initialize().catch((failure) => {
            if (!disposed) feedback.error(failure);
          });
        }
      })
      .finally(() => {
        if (disposed) return;
        feedback.empty(state.objects.length === 0);
        feedback.loading(false);
        actions.history.setEnabled(true);
        canvas.setAttribute('aria-busy', 'false');
        host.performance.mark('planner:assets-ready');
      });
    const modelImports = createModelImports({ state, actions, factory, ready });
    cleanup.push(() => modelImports.dispose());
    cleanup.push(
      bindImportDialog({
        document,
        modelImports,
        feedback,
        close: (modal) => host.bootstrap.Modal.getInstance(modal).hide(),
      }),
    );
    const projects = createLocalProjects({
      state,
      actions,
      factory,
      modelImports,
      ready,
      onMissingAssets: (missing) =>
        feedback.error(
          new Error(
            `Project opened with ${missing.length} missing model${missing.length === 1 ? '' : 's'}. ${missing[0].message}`,
          ),
        ),
    });
    cleanup.push(() => projects.dispose());
    cleanup.push(bindProjectsDialog({ document, projects, state }));
    function dispose() {
      if (disposed) return;
      disposed = true;
      cleanup.reverse().forEach((remove) => remove());
    }
    return {
      state,
      actions,
      selection,
      sharing,
      modelImports,
      projects,
      view,
      ready,
      dispose,
    };
  } catch (error) {
    disposed = true;
    cleanup.reverse().forEach((remove) => {
      try {
        remove();
      } catch {
        // Continue releasing independently owned services.
      }
    });
    throw error;
  }
}
