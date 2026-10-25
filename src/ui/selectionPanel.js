import { describeProduct } from '../catalog/presentation.js';
import { createTransformCommands } from '../interactions/commands.js';
import { thumbnail } from './dom.js';

export function bindSelectionPanel({
  document,
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
      if (['translate', 'rotate'].includes(action))
        button.setAttribute(
          'aria-pressed',
          String(transformControls.getMode() === action),
        );
      else if (['x', 'y', 'z'].includes(action))
        button.setAttribute(
          'aria-pressed',
          String(transformControls[`show${action.toUpperCase()}`]),
        );
    }
  }
  function update(object) {
    shell.setSelectionVisible(Boolean(object));
    if (!object) {
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
    document.getElementById('selectionVariation').textContent = info.variation;
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
      description || '';
    remove.setAttribute('aria-label', `Remove ${info.name}`);
    document.getElementById('selectionStatus').textContent =
      `Selected ${info.name}${info.variation ? `, ${info.variation}` : ''}.`;
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
  const deselect = () => selection.unselectPickedObject();
  const removeSelected = () => {
    if (selection.pickedObject) actions.remove(selection.pickedObject);
  };
  panel.addEventListener('click', click);
  document.getElementById('deselectObject').addEventListener('click', deselect);
  remove.addEventListener('click', removeSelected);
  transformControls.addEventListener('change', updateControls);
  const unsubscribe = selection.subscribe(update);
  return () => {
    unsubscribe();
    panel.removeEventListener('click', click);
    document
      .getElementById('deselectObject')
      .removeEventListener('click', deselect);
    remove.removeEventListener('click', removeSelected);
    transformControls.removeEventListener('change', updateControls);
  };
}
