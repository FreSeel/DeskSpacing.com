import {
  formatMeasurement,
  fromInches,
  toInches,
} from '../measurements/units.js';
import { spacingLimits } from '../snapping/configuration.js';

export function bindSnappingUI({
  document,
  measurements,
  snapping,
  transforms,
}) {
  const menu = document.getElementById('snapMenu');
  const summary = menu.querySelector('summary');
  const enabled = document.getElementById('snapEnabled');
  const grid = document.getElementById('snapGridEnabled');
  const objects = document.getElementById('snapObjectsEnabled');
  const surface = document.getElementById('snapSurfaceEnabled');
  const spacing = document.getElementById('snapSpacing');
  const label = document.querySelector('label[for="snapSpacing"]');
  const error = document.getElementById('snapSpacingError');
  const status = document.getElementById('snapStatus');
  const undo = document.getElementById('undoTransform');
  const redo = document.getElementById('redoTransform');
  const cleanup = [];
  const listen = (target, name, callback) => {
    target.addEventListener(name, callback);
    cleanup.push(() => target.removeEventListener(name, callback));
  };
  let displayed = '';
  function render() {
    const { configuration } = snapping;
    enabled.checked = configuration.enabled;
    grid.checked = configuration.grid.enabled;
    objects.checked = configuration.objects.enabled;
    surface.checked = configuration.surface.enabled;
    menu.dataset.enabled = String(configuration.enabled);
    summary.textContent = configuration.enabled ? 'Snap on' : 'Snap off';
    label.textContent = `Grid spacing (${measurements.unit})`;
    displayed = formatMeasurement(
      configuration.grid.spacing,
      measurements.unit,
    );
    spacing.value = displayed;
    spacing.min = String(fromInches(spacingLimits.min, measurements.unit));
    spacing.max = String(fromInches(spacingLimits.max, measurements.unit));
    spacing.removeAttribute('aria-invalid');
    error.hidden = true;
  }
  listen(enabled, 'change', () => snapping.setEnabled(enabled.checked));
  listen(grid, 'change', () => snapping.setGridEnabled(grid.checked));
  listen(objects, 'change', () => snapping.setObjectsEnabled(objects.checked));
  listen(surface, 'change', () => snapping.setSurfaceEnabled(surface.checked));
  listen(spacing, 'input', () => {
    spacing.removeAttribute('aria-invalid');
    error.hidden = true;
  });
  listen(spacing, 'change', () => {
    // A focus/blur or unit switch must not re-import a rounded display value.
    if (spacing.value === displayed) return;
    const value =
      spacing.value === ''
        ? NaN
        : toInches(Number(spacing.value), measurements.unit);
    if (!snapping.setSpacing(value)) {
      spacing.setAttribute('aria-invalid', 'true');
      error.textContent = `Enter a spacing from ${formatMeasurement(spacingLimits.min, measurements.unit)} to ${formatMeasurement(spacingLimits.max, measurements.unit)} ${measurements.unit}.`;
      error.hidden = false;
    }
  });
  listen(undo, 'click', () => transforms.undo());
  listen(redo, 'click', () => transforms.redo());
  cleanup.push(
    transforms.subscribe(() => {
      undo.disabled = !transforms.canUndo;
      redo.disabled = !transforms.canRedo;
    }),
  );
  cleanup.push(snapping.subscribe(render), measurements.subscribe(render));
  return {
    guidance(guidance, bypass) {
      status.hidden = !guidance && !bypass;
      const labels = {
        edge: 'Edges aligned',
        center: 'Centers aligned',
        corner: 'Corners aligned',
        'edge-center': 'Edge and center aligned',
      };
      const alignment =
        guidance?.kind === 'magnetic'
          ? labels[guidance.alignment]
          : guidance?.kind === 'grid'
            ? 'Grid snapped'
            : '';
      const text = bypass
        ? 'Free move · Alt / Option'
        : [guidance?.surface ? 'Surface contact' : '', alignment]
            .filter(Boolean)
            .join(' · ');
      if (status.textContent !== text) status.textContent = text;
    },
    dispose() {
      cleanup.forEach((remove) => remove());
    },
  };
}
