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
  history = transforms,
  onError = () => {},
}) {
  const command = createTransformCommands(transformControls);
  function onKeyDown(event) {
    if (
      isEditable(event.target) ||
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      host.document?.querySelector('.modal.show, [aria-modal="true"]')
    )
      return;
    const key = event.key.toLowerCase();
    const workspace = event.target?.closest?.('[data-workspace-shortcuts]');
    if (event.ctrlKey || event.metaKey) {
      // Add/delete buttons may retain focus outside the canvas. History is an
      // editor-wide command, while gizmo shortcuts remain workspace-scoped.
      if (
        !workspace &&
        !event.target?.closest?.('.editor-shell') &&
        !(host.document?.body && event.target === host.document.body)
      )
        return;
      const action =
        key === 'z'
          ? event.shiftKey
            ? 'redo'
            : 'undo'
          : key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey
            ? 'redo'
            : null;
      if (history && action && !transformControls.dragging) {
        try {
          if (history[action]()) event.preventDefault();
        } catch (error) {
          onError(error);
        }
      }
      return;
    }
    if (!workspace) return;
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
