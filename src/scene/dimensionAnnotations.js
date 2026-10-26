import {
  createObjectDimensions,
  dimensionAxes,
} from '../measurements/objectDimensions.js';
import { formatMeasurement } from '../measurements/units.js';
import { layoutDimensions } from './dimensionLayout.js';

export function bindDimensionAnnotations({
  document,
  view,
  selection,
  measurements,
  state,
}) {
  const container = document.getElementById('rightSideContainer');
  const toggle = document.getElementById('dimensionToggle');
  let enabled = true;
  toggle.setAttribute('aria-pressed', 'true');
  toggle.title = 'Hide dimensions';
  const overlay = document.createElement('div');
  overlay.id = 'dimensionAnnotations';
  overlay.className = 'dimension-annotations';
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', 'Selected object dimensions');
  overlay.hidden = true;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  overlay.append(svg);
  const elements = {};
  for (const { axis, name } of dimensionAxes) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    svg.append(path);
    const label = document.createElement('span');
    label.className = 'dimension-label';
    label.dataset.dimension = axis;
    label.title = name;
    overlay.append(label);
    elements[axis] = { path, label, size: { width: 0, height: 0 } };
  }
  container.append(overlay);
  const geometry = createObjectDimensions();
  let selected = null;
  function update() {
    if (!enabled) {
      overlay.hidden = true;
      return;
    }
    if (!selected || !state.has(selected) || !selected.visible) {
      overlay.hidden = true;
      geometry.clear();
      return;
    }
    const measurement = geometry.read(selected);
    if (!measurement) {
      overlay.hidden = true;
      return;
    }
    overlay.hidden = false;
    const labelSizes = {};
    for (const { axis, label: abbreviation, name } of dimensionAxes) {
      const entry = elements[axis];
      const text = `${abbreviation}: ${formatMeasurement(measurement.dimensions[axis], measurements.unit)} ${measurements.unit}`;
      entry.label.hidden = false;
      if (entry.label.textContent !== text || !entry.size.width) {
        entry.label.textContent = text;
        entry.label.setAttribute(
          'aria-label',
          `${name}: ${formatMeasurement(measurement.dimensions[axis], measurements.unit)} ${measurements.unit}`,
        );
        entry.size = {
          width: entry.label.offsetWidth,
          height: entry.label.offsetHeight,
        };
      }
      labelSizes[axis] = entry.size;
    }
    view.camera.updateMatrixWorld();
    const layout = layoutDimensions({
      ...measurement,
      camera: view.camera,
      width: container.clientWidth,
      height: container.clientHeight,
      labelSizes,
    });
    for (const { axis } of dimensionAxes) {
      elements[axis].label.hidden = true;
      elements[axis].path.setAttribute('d', '');
    }
    for (const { axis, a, b, start, end, normal, label } of layout) {
      const entry = elements[axis];
      const move = (point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      const tick = (point, amount) =>
        move({
          x: point.x + normal.x * amount,
          y: point.y + normal.y * amount,
        });
      entry.path.setAttribute(
        'd',
        `M ${move(a)} L ${tick(start, 5)} M ${move(b)} L ${tick(end, 5)} M ${move(start)} L ${move(end)} M ${tick(start, -4)} L ${tick(start, 4)} M ${tick(end, -4)} L ${tick(end, 4)}`,
      );
      entry.label.style.left = `${label.x}px`;
      entry.label.style.top = `${label.y}px`;
      entry.label.hidden = false;
    }
    overlay.hidden = layout.length === 0;
  }
  function toggleDimensions() {
    enabled = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.title = enabled ? 'Hide dimensions' : 'Show dimensions';
    update();
  }
  toggle.addEventListener('click', toggleDimensions);
  const unsubscribeSelection = selection.subscribe((object) => {
    selected = object;
    geometry.clear();
    update();
    view.invalidate();
  });
  const unsubscribeUnits = measurements.subscribe(update);
  const unsubscribeRender = view.subscribeRender(update);
  return () => {
    toggle.removeEventListener('click', toggleDimensions);
    unsubscribeSelection();
    unsubscribeUnits();
    unsubscribeRender();
    geometry.clear();
    overlay.remove();
  };
}
