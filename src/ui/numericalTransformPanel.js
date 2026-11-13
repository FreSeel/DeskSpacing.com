import { element } from './dom.js';

const sections = [
  {
    key: 'position',
    name: 'Position',
    unit: 'cm',
    hint: 'Object origin in world space · Y up.',
    fields: [
      ['x', 'X'],
      ['y', 'Y'],
      ['z', 'Z'],
    ],
  },
  {
    key: 'rotationDegrees',
    name: 'Rotation',
    unit: '°',
    hint: 'Parent-local axes · XYZ order.',
    fields: [
      ['x', 'X'],
      ['y', 'Y'],
      ['z', 'Z'],
    ],
  },
  {
    key: 'dimensions',
    name: 'Dimensions',
    unit: 'cm',
    hint: 'Object axes · Width X, height Y, depth Z.',
    fields: [
      ['width', 'Width'],
      ['height', 'Height'],
      ['depth', 'Depth'],
    ],
  },
];
const help = 'Enter or leave to apply · Esc to cancel.';

// Text inputs preserve partial signs/decimals instead of number-input
// sanitization. Only a complete finite decimal reaches the transformation API.
export function parseTransformInput(text) {
  const value = text.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function displayValue(value, focused) {
  if (!Number.isFinite(value)) return '';
  if (focused) return String(value);
  const rounded = Number(value.toFixed(6));
  return String(rounded === 0 && value !== 0 ? value : rounded);
}

export function bindNumericalTransformPanel({
  document,
  selection,
  transforms,
  measurements,
  view,
}) {
  const panel = document.getElementById('selectionNumericalTransforms');
  const fields = [];
  const groups = [];
  const cleanup = [];
  let selected = null;
  let draft = null;
  let committing = false;
  let disposed = false;
  let composing = false;
  let switchingUnit = false;
  const listen = (node, type, listener, options) => {
    node.addEventListener(type, listener, options);
    cleanup.push(() => node.removeEventListener(type, listener, options));
  };
  const status = element(document, 'p', 'numerical-transform-status', help);
  status.id = 'selectionTransformStatus';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  function message(text = help, error = false) {
    if (status.textContent !== text) status.textContent = text;
    status.classList.toggle('has-error', error);
  }
  const read = () => transforms.read(selected, { unit: measurements.unit });
  const valueOf = (values, field) => values?.[field.section]?.[field.key];
  const editable = (values, field) =>
    Boolean(values?.capabilities[field.section].includes(field.key));
  function startDraft(field, value, text) {
    draft = {
      field,
      object: selected,
      base: value,
      initial: text,
      dirty: false,
      stale: false,
    };
  }

  function render() {
    if (disposed || committing) return;
    const values = read();
    if (panel.hidden !== !values) panel.hidden = !values;
    if (!values) {
      draft = null;
      return;
    }
    const busy = transforms.isTransforming;
    for (const field of fields) {
      const { input } = field;
      const unit =
        field.section === 'rotationDegrees' ? '°' : measurements.unit;
      input.setAttribute('aria-label', `${field.name} (${unit})`);
      field.unit = unit;
      const value = valueOf(values, field);
      const canEdit = editable(values, field) && Number.isFinite(value);
      const readOnly = !canEdit || busy;
      if (input.readOnly !== readOnly) input.readOnly = readOnly;
      const focused = document.activeElement === input;
      if (draft?.field === field) {
        if (!canEdit) {
          draft = null;
          input.removeAttribute('aria-invalid');
          message(
            'This value is now read-only. Unfinished edit discarded.',
            true,
          );
        } else if (focused || draft.dirty) {
          if (focused && input.value !== draft.initial) draft.dirty = true;
          if (draft.dirty && value !== draft.base) {
            draft.stale = true;
            message(
              'This value changed in the scene. Press Esc to use it.',
              true,
            );
          }
          // Preserve typed text and the caret through camera/scene updates.
          continue;
        } else {
          draft.base = value;
          draft.initial = displayValue(value, focused);
        }
      }
      const text = displayValue(value, focused);
      if (input.value !== text) input.value = text;
      // Selection can change while this same DOM input retains focus.
      if (!draft && focused && !readOnly) startDraft(field, value, text);
      const title = Number.isFinite(value)
        ? `${value} ${field.unit}`
        : 'Unavailable';
      if (input.title !== title) input.title = title;
    }
    for (const { section, legend, hint, diameter } of groups) {
      const unit = section.key === 'rotationDegrees' ? '°' : measurements.unit;
      const label = `${section.name} (${unit})`;
      if (legend.textContent !== label) legend.textContent = label;
      const allowed = values.capabilities[section.key];
      let text =
        section.key === 'rotationDegrees'
          ? `Parent-local axes · ${values.rotationOrder} order.`
          : section.hint;
      if (!allowed.length) text += ' Read-only.';
      if (section.key === 'dimensions') {
        if (!values.dimensions) text = 'Measurements unavailable.';
        else if (allowed.includes('diameter'))
          text += ' Edit diameter to resize.';
        else if (allowed.length === 2) text += ' Height is read-only.';
        const hidden = !Number.isFinite(values.dimensions?.diameter);
        if (diameter.hidden !== hidden) diameter.hidden = hidden;
      }
      if (hint.textContent !== text) hint.textContent = text;
    }
  }

  function beginEdit(field) {
    if (disposed) return;
    const values = read();
    if (!editable(values, field) || field.input.readOnly) return;
    const value = valueOf(values, field);
    const text = field.input.value;
    startDraft(field, value, text);
    composing = false;
  }

  function discard({ text = help, error = false, leaving = false } = {}) {
    const field = draft?.field;
    draft = null;
    composing = false;
    field?.input.removeAttribute('aria-invalid');
    message(text, error);
    render();
    if (field && !leaving && document.activeElement === field.input)
      beginEdit(field);
  }

  function commit(leaving = false) {
    if (!draft || composing) return;
    const edit = draft;
    if (edit.object !== selection.pickedObject || !read()) {
      discard({ leaving });
      return;
    }
    if (!edit.dirty) {
      discard({ leaving });
      return;
    }
    const values = read();
    if (edit.stale || valueOf(values, edit.field) !== edit.base) {
      discard({
        text: 'The scene value changed. Edit the current value to try again.',
        error: true,
        leaving,
      });
      return;
    }
    const { field } = edit;
    const number = parseTransformInput(field.input.value);
    try {
      if (number === null)
        throw new Error('Enter a complete number, such as -12.5.');
      if (field.section === 'dimensions' && number <= 0)
        throw new Error('Enter a size greater than zero.');
      committing = true;
      transforms.update(
        selected,
        { [field.section]: { [field.key]: number } },
        { unit: measurements.unit },
      );
    } catch (error) {
      committing = false;
      const reason = error.message.startsWith('Invalid setup:')
        ? 'This value is outside the supported range.'
        : error.message;
      const text = `${field.name}: ${reason} Edit not applied.`;
      if (leaving) discard({ text, error: true, leaving });
      else {
        field.input.setAttribute('aria-invalid', 'true');
        message(text, true);
      }
      return;
    }
    committing = false;
    discard({ text: `${field.name} applied. ${help}`, leaving });
  }

  function addField(section, key, label, container, hintId) {
    const wrapper = element(document, 'div', 'numerical-transform-field');
    const name = `${section.name} ${label}`;
    const suffix = key[0].toUpperCase() + key.slice(1);
    const id = `selection${section.name}${suffix}`;
    const caption = element(document, 'label', '', label);
    caption.htmlFor = id;
    const input = element(document, 'input');
    input.id = id;
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = '—';
    input.setAttribute('aria-label', `${name} (${section.unit})`);
    input.setAttribute('aria-describedby', `${hintId} ${status.id}`);
    const field = {
      input,
      section: section.key,
      key,
      name,
      unit: section.unit,
    };
    fields.push(field);
    wrapper.append(caption, input);
    container.append(wrapper);
    listen(input, 'focus', () => beginEdit(field));
    listen(input, 'input', () => {
      if (draft?.field !== field) {
        const value = valueOf(read(), field);
        startDraft(field, value, displayValue(value, true));
      }
      draft.dirty = input.value !== draft.initial;
      input.removeAttribute('aria-invalid');
      if (!draft.stale) message();
    });
    listen(input, 'blur', (event) => {
      if (draft?.field === field) {
        if (
          switchingUnit ||
          document
            .getElementById('measurementUnit')
            .contains(event.relatedTarget)
        )
          discard({
            text: 'Unfinished edit cancelled when changing units.',
            leaving: true,
          });
        else commit(true);
      }
      render();
    });
    listen(input, 'keydown', (event) => {
      if (event.isComposing || composing || draft?.field !== field) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        commit();
      } else if (event.key === 'Escape' && (draft.dirty || draft.stale)) {
        event.preventDefault();
        // Keep the responsive inspector sheet open while cancelling a draft.
        event.stopPropagation();
        discard();
      }
    });
    listen(input, 'compositionstart', () => {
      composing = true;
    });
    listen(input, 'compositionend', () => {
      composing = false;
      if (draft?.field !== field) return;
      draft.dirty = input.value !== draft.initial;
      if (document.activeElement !== input) commit(true);
    });
  }

  for (const section of sections) {
    const group = element(document, 'fieldset', 'numerical-transform-group');
    const legend = element(
      document,
      'legend',
      '',
      `${section.name} (${section.unit})`,
    );
    const hint = element(
      document,
      'p',
      'muted numerical-transform-hint',
      section.hint,
    );
    hint.id = `selection${section.name}Hint`;
    const grid = element(document, 'div', 'numerical-transform-grid');
    group.append(legend, grid, hint);
    for (const [key, label] of section.fields)
      addField(section, key, label, grid, hint.id);
    let diameter = null;
    if (section.key === 'dimensions') {
      diameter = element(document, 'div', 'numerical-transform-diameter');
      diameter.hidden = true;
      addField(section, 'diameter', 'Diameter', diameter, hint.id);
      group.append(diameter);
    }
    groups.push({ section, legend, hint, diameter });
    panel.append(group);
  }
  panel.append(status);
  const selector = document.getElementById('measurementUnit');
  listen(
    selector,
    'pointerdown',
    () => {
      switchingUnit = true;
    },
    true,
  );
  listen(
    selector,
    'pointerup',
    () => {
      switchingUnit = false;
    },
    true,
  );
  listen(
    selector,
    'pointercancel',
    () => {
      switchingUnit = false;
    },
    true,
  );

  // Canvas focus normally changes after TransformControls starts its gesture.
  // Finish a valid field draft first, without cancelling or synthesizing any
  // pointer/control events or changing the snapping pipeline.
  listen(
    document.getElementById('threeCanvas'),
    'pointerdown',
    (event) => {
      if (event.button === 0) commit(true);
    },
    true,
  );
  cleanup.push(
    selection.subscribe((object) => {
      if (selected !== object) {
        draft = null;
        composing = false;
        selected = object;
        fields.forEach(({ input }) => input.removeAttribute('aria-invalid'));
        message();
      }
      render();
    }),
  );
  cleanup.push(transforms.subscribe(render), view.subscribeRender(render));
  cleanup.push(
    measurements.subscribe(() => {
      if (draft?.dirty) {
        draft = null;
        message('Unfinished edit cancelled when changing units.');
      } else draft = null;
      render();
    }),
  );
  return () => {
    disposed = true;
    draft = null;
    cleanup.forEach((remove) => remove());
    panel.replaceChildren();
    panel.hidden = true;
  };
}
