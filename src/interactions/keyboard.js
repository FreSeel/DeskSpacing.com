import { createTransformCommands } from './commands.js';

export function isEditable(target) {
  return Boolean(
    target?.closest?.(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    ),
  );
}

export function bindKeyboard({
  host,
  selection,
  transformControls,
  transforms,
}) {
  const command = createTransformCommands(transformControls);
  function onKeyDown(event) {
    if (
      isEditable(event.target) ||
      event.altKey ||
      host.document?.querySelector('.modal.show, [aria-modal="true"]') ||
      !event.target?.closest?.('[data-workspace-shortcuts]')
    )
      return;
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey) {
      if (transforms && key === 'z') {
        if (!transformControls.dragging)
          transforms[event.shiftKey ? 'redo' : 'undo']();
        event.preventDefault();
      }
      return;
    }
    // Changing axes/mode or deleting an object mid-gesture invalidates the
    // control's captured pointer offset and the single history transaction.
    if (transformControls.dragging) return;
    if (['backspace', 'delete', 'd'].includes(key)) selection.deletePicked();
    else if (key === 'c') selection.unselectPickedObject();
    else if (key === 'r') command('toggle-mode');
    else if (key === '+' || key === '=') command('larger');
    else if (key === '-' || key === '_') command('smaller');
    else if (['x', 'y', 'z'].includes(key)) command(key);
    else return;
    event.preventDefault();
  }
  host.addEventListener('keydown', onKeyDown);
  return () => host.removeEventListener('keydown', onKeyDown);
}
