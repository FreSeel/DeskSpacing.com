import { formatMeasurementText } from '../measurements/units.js';
import { describeProduct } from '../catalog/presentation.js';
import { createTransformCommands } from '../interactions/commands.js';
import { thumbnail } from './dom.js';

export function bindSelectionPanel({
  document,
  measurements,
  selection,
  actions,
  transformControls,
  shell,
}) {
  const panel = document.getElementById('selectionPanel');
  const title = document.getElementById('selectionTitle');
  const preview = document.getElementById('selectionPreview');
  const remove = document.getElementById('removeObject');
  const command = createTransformCommands(transformControls);
  const buttons = [...panel.querySelectorAll('[data-command]')];
  function updateControls() {
    for (const button of buttons) {
      const action = button.dataset.command;
      let pressed;
      if (['translate', 'rotate'].includes(action))
        pressed = String(transformControls.getMode() === action);
      else if (['x', 'y', 'z'].includes(action))
        pressed = String(transformControls[`show${action.toUpperCase()}`]);
      if (
        pressed !== undefined &&
        button.getAttribute('aria-pressed') !== pressed
      )
        button.setAttribute('aria-pressed', pressed);
    }
  }
  function update(object) {
    shell.setSelectionVisible(Boolean(object));
    document.getElementById('selectionEmpty').hidden = Boolean(object);
    for (const id of [
      'selectionVariation',
      'selectionPreview',
      'selectionInstance',
      'removeObject',
    ])
      document.getElementById(id).hidden = !object;
    document
      .getElementById('deselectObject')
      .setAttribute(
        'aria-label',
        object ? 'Deselect object' : 'Close properties',
      );
    if (!object) {
      title.textContent = 'No object selected';
      preview.replaceChildren();
      for (const id of [
        'selectionVariation',
        'selectionInstance',
        'selectionDescription',
      ])
        document.getElementById(id).textContent = '';
      for (const id of [
        'selectionTransforms',
        'selectionLocked',
        'selectionDetails',
      ])
        document.getElementById(id).hidden = true;
      remove.setAttribute('aria-label', 'Remove object');
      document.getElementById('selectionStatus').textContent =
        'Selection cleared.';
      return;
    }
    const info = describeProduct(object.userData.objectName);
    if (info.id === 'customDesk') {
      const texture = object.children[0]?.material?.name;
      const material = info.select.options.find(
        (option) => option.value === texture,
      );
      if (material) {
        info.thumbnail = material.image;
        info.variation = material.label;
      }
    }
    title.textContent = info.name;
    document.getElementById('selectionVariation').textContent =
      formatMeasurementText(info.variation, measurements.unit);
    preview.replaceChildren(thumbnail(document, info.thumbnail, info.name));
    document.getElementById('selectionInstance').textContent = object.name;
    const locked = object.userData.type.includes('NoSelect');
    document.getElementById('selectionTransforms').hidden = locked;
    document.getElementById('selectionLocked').hidden = !locked;
    // Retain the historical MX Master copy in the catalog, but don't present
    // its known implausible width as an authoritative inspector measurement.
    const description = info.id === 'MXMaster3' ? '' : info.description;
    document.getElementById('selectionDetails').hidden = !description;
    document.getElementById('selectionDescription').textContent =
      formatMeasurementText(description, measurements.unit);
    remove.setAttribute('aria-label', `Remove ${info.name}`);
    document.getElementById('selectionStatus').textContent =
      `Selected ${info.name}${info.variation ? `, ${formatMeasurementText(info.variation, measurements.unit)}` : ''}.`;
    updateControls();
  }
  function click(event) {
    const button = event.target.closest('[data-command]');
    if (
      button &&
      selection.pickedObject &&
      !selection.pickedObject.userData.type.includes('NoSelect')
    )
      command(button.dataset.command);
  }
  const deselect = () => {
    selection.unselectPickedObject();
    shell.closeSelectionPanel();
  };
  const removeSelected = () => {
    if (selection.pickedObject) actions.remove(selection.pickedObject);
  };
  panel.addEventListener('click', click);
  document.getElementById('deselectObject').addEventListener('click', deselect);
  remove.addEventListener('click', removeSelected);
  transformControls.addEventListener('change', updateControls);
  const unsubscribe = selection.subscribe(update);
  const unsubscribeUnits = measurements.subscribe(() => {
    const object = selection.pickedObject;
    if (!object) return;
    const info = describeProduct(object.userData.objectName);
    if (info.id !== 'customDesk')
      document.getElementById('selectionVariation').textContent =
        formatMeasurementText(info.variation, measurements.unit);
    const variation = document.getElementById('selectionVariation').textContent;
    document.getElementById('selectionStatus').textContent =
      `Selected ${info.name}${variation ? `, ${variation}` : ''}.`;
    document.getElementById('selectionDescription').textContent =
      formatMeasurementText(
        info.id === 'MXMaster3' ? '' : info.description,
        measurements.unit,
      );
  });
  return () => {
    unsubscribe();
    unsubscribeUnits();
    panel.removeEventListener('click', click);
    document
      .getElementById('deselectObject')
      .removeEventListener('click', deselect);
    remove.removeEventListener('click', removeSelected);
    transformControls.removeEventListener('change', updateControls);
  };
}
