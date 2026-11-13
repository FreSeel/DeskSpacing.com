import { describeObject } from './objectPresentation.js';
import { element } from './dom.js';
import { parseTransformInput } from './numericalTransformPanel.js';
import { fromInches, toInches } from '../measurements/units.js';

const directions = [
  { value: 'x+', axis: 'x', direction: 1, label: '+X' },
  { value: 'x-', axis: 'x', direction: -1, label: '−X' },
  { value: 'y+', axis: 'y', direction: 1, label: '+Y (up)' },
  { value: 'y-', axis: 'y', direction: -1, label: '−Y (down)' },
  { value: 'z+', axis: 'z', direction: 1, label: '+Z' },
  { value: 'z-', axis: 'z', direction: -1, label: '−Z' },
];
const help =
  'Apply moves only this world axis, once. Other coordinates stay unchanged.';
const setText = (node, text) => {
  if (node.textContent !== text) node.textContent = text;
};

function displayClearance(value) {
  const rounded = Number(value.toFixed(6));
  return String(rounded === 0 && value !== 0 ? value : rounded);
}

export function bindPreciseSpacingPanel({
  document,
  selection,
  state,
  transforms,
  spacing,
  measurements,
  view,
}) {
  const panel = document.getElementById('selectionPreciseSpacing');
  const cleanup = [];
  const options = new Map();
  let selected = null;
  let reference = null;
  let feedback = null;
  let acceptedInches = toInches(10, 'cm');
  let acceptedClearance = String(fromInches(acceptedInches, measurements.unit));
  let disposed = false;
  const listen = (node, type, listener) => {
    node.addEventListener(type, listener);
    cleanup.push(() => node.removeEventListener(type, listener));
  };
  const heading = element(document, 'h3', 'eyebrow', 'Precise Spacing');
  const hint = element(
    document,
    'p',
    'muted numerical-transform-hint',
    'Place this object on the chosen side of the reference. Measures projected bounding boxes, not the shortest mesh-surface distance.',
  );
  hint.id = 'selectionSpacingHint';
  function field(label, id, tag, container) {
    const wrapper = element(document, 'div', 'precise-spacing-field');
    const caption = element(document, 'label', '', label);
    caption.htmlFor = id;
    const control = element(document, tag);
    control.id = id;
    control.setAttribute('aria-describedby', hint.id);
    wrapper.append(caption, control);
    container.append(wrapper);
    return control;
  }
  panel.append(heading, hint);
  const references = field(
    'Reference object',
    'selectionSpacingReference',
    'select',
    panel,
  );
  const placeholder = element(document, 'option', '', 'Choose an object');
  placeholder.value = '';
  references.append(placeholder);
  const row = element(document, 'div', 'precise-spacing-grid');
  panel.append(row);
  const direction = field(
    'World direction',
    'selectionSpacingDirection',
    'select',
    row,
  );
  for (const item of directions) {
    const option = element(document, 'option', '', item.label);
    option.value = item.value;
    direction.append(option);
  }
  const clearance = field(
    'Clearance',
    'selectionSpacingClearance',
    'input',
    row,
  );
  clearance.type = 'text';
  clearance.inputMode = 'decimal';
  clearance.autocomplete = 'off';
  clearance.spellcheck = false;
  clearance.value = acceptedClearance;
  const apply = element(document, 'button', '', 'Apply spacing');
  apply.id = 'selectionSpacingApply';
  apply.type = 'button';
  const measurement = element(document, 'p', 'precise-spacing-measurement');
  const measured = element(document, 'output', '', '—');
  measured.id = 'selectionSpacingMeasured';
  measured.setAttribute('aria-live', 'off');
  measured.setAttribute('aria-label', 'Measured bounds clearance');
  measured.setAttribute('aria-describedby', hint.id);
  measurement.append('Measured: ', measured);
  const status = element(document, 'p', 'numerical-transform-status');
  status.id = 'selectionSpacingStatus';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  clearance.setAttribute('aria-describedby', `${hint.id} ${status.id}`);
  panel.append(apply, measurement, status);

  const settings = () => ({
    ...directions.find((item) => item.value === direction.value),
    unit: measurements.unit,
  });

  function refreshReferences() {
    const objects = state.objects.filter((object) => object !== selected);
    if (reference && !objects.includes(reference)) {
      reference = null;
      feedback = {
        text: 'The reference object is unavailable. Choose another object.',
        error: true,
      };
    }
    for (const [object, option] of options) {
      if (!objects.includes(object)) {
        option.remove();
        options.delete(object);
      }
    }
    for (const object of objects) {
      if (options.has(object)) continue;
      const info = describeObject(object);
      const option = element(
        document,
        'option',
        '',
        `${info.name} · ${object.name}`,
      );
      // Instance names can be reused after deletion/restore; identity cannot.
      option.value = object.uuid;
      options.set(object, option);
      references.append(option);
    }
    references.value = reference?.uuid || '';
    setText(
      placeholder,
      objects.length ? 'Choose an object' : 'No other objects',
    );
  }

  function render() {
    if (disposed) return;
    const values = transforms.read(selected);
    panel.hidden = !values;
    if (!values) return;
    const config = settings();
    let unavailable = '';
    let measurementError = false;
    let value = null;
    if (reference) {
      try {
        value = spacing.measure(selected, reference, config).clearance;
      } catch (error) {
        unavailable = error.message;
        measurementError = true;
      }
    } else {
      unavailable = options.size
        ? 'Choose a reference object to measure and place.'
        : 'Add another object to measure spacing.';
    }
    if (!unavailable && !values.capabilities.position.includes(config.axis))
      unavailable =
        'This object is locked. Its clearance can be measured, but it cannot be moved.';
    if (!unavailable && transforms.isTransforming)
      unavailable =
        'Finish the active transform gesture before applying spacing.';
    apply.disabled = Boolean(unavailable);
    clearance.readOnly = transforms.isTransforming;
    const unit = measurements.unit;
    panel.querySelector('label[for="selectionSpacingClearance"]').textContent =
      `Clearance (${unit})`;
    measured.setAttribute(
      'aria-label',
      `Measured bounds clearance in ${unit === 'cm' ? 'centimeters' : 'inches'}`,
    );
    setText(
      measured,
      value === null ? '—' : `${displayClearance(value)} ${unit}`,
    );
    const title =
      value === null ? 'Measurement unavailable' : `${value} ${unit}`;
    if (measured.title !== title) measured.title = title;
    const negative =
      value !== null && value < 0
        ? ' Negative means the bounds are not separated in this direction.'
        : '';
    const notice = feedback?.error
      ? feedback.text
      : unavailable || feedback?.text || help;
    setText(status, notice + negative);
    status.classList.toggle(
      'has-error',
      measurementError || Boolean(feedback?.error),
    );
  }

  function applySpacing() {
    if (!selected || selected !== selection.pickedObject) return;
    const number = parseTransformInput(clearance.value);
    if (number === null || number < 0) {
      clearance.setAttribute('aria-invalid', 'true');
      feedback = {
        text: `Enter a complete clearance of zero or more ${measurements.unit}. Placement not applied.`,
        error: true,
      };
      render();
      return;
    }
    clearance.removeAttribute('aria-invalid');
    try {
      const unchangedDraft = clearance.value === acceptedClearance;
      const changed = spacing.place(selected, reference, {
        ...settings(),
        unit: unchangedDraft ? 'in' : measurements.unit,
        clearance: unchangedDraft ? acceptedInches : number,
      });
      if (!unchangedDraft) acceptedInches = toInches(number, measurements.unit);
      acceptedClearance = clearance.value;
      feedback = {
        text: changed
          ? 'Spacing applied once. Use Undo to restore the previous position.'
          : 'The object is already at this clearance.',
        error: false,
      };
    } catch (error) {
      const reason = error.message.startsWith('Invalid setup:')
        ? 'The resulting position is outside the supported range.'
        : error.message;
      feedback = { text: `${reason} Placement not applied.`, error: true };
    }
    render();
  }

  listen(references, 'change', () => {
    reference =
      [...options.keys()].find((object) => object.uuid === references.value) ||
      null;
    feedback = null;
    render();
  });
  listen(direction, 'change', () => {
    feedback = null;
    render();
  });
  listen(clearance, 'input', () => {
    clearance.removeAttribute('aria-invalid');
    feedback = null;
    render();
  });
  listen(clearance, 'keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      applySpacing();
    } else if (
      event.key === 'Escape' &&
      clearance.value !== acceptedClearance
    ) {
      event.preventDefault();
      event.stopPropagation();
      clearance.value = acceptedClearance;
      clearance.removeAttribute('aria-invalid');
      feedback = null;
      render();
    }
  });
  listen(apply, 'click', applySpacing);
  cleanup.push(
    selection.subscribe((object) => {
      if (selected !== object) {
        selected = object;
        reference = null;
        feedback = null;
        acceptedInches = toInches(10, 'cm');
        acceptedClearance = String(
          fromInches(acceptedInches, measurements.unit),
        );
        clearance.value = acceptedClearance;
        clearance.removeAttribute('aria-invalid');
        direction.value = 'x+';
        refreshReferences();
      }
      render();
    }),
    state.subscribe(() => {
      refreshReferences();
      render();
    }),
    transforms.subscribe(render),
    view.subscribeRender(render),
  );
  cleanup.push(
    measurements.subscribe((unit) => {
      const dirty = clearance.value !== acceptedClearance;
      acceptedClearance = String(fromInches(acceptedInches, unit));
      clearance.value = acceptedClearance;
      clearance.removeAttribute('aria-invalid');
      if (dirty)
        feedback = {
          text: 'Unfinished clearance cancelled when changing units.',
          error: false,
        };
      render();
    }),
  );
  return () => {
    disposed = true;
    cleanup.forEach((remove) => remove());
    options.clear();
    selected = reference = null;
    panel.replaceChildren();
    panel.hidden = true;
  };
}
