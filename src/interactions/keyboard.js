export function isEditable(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}

export function bindKeyboard({ host, selection, transformControls }) {
  let rotateActive = true;
  function onKeyDown(event) {
    if (isEditable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key.toLowerCase()) {
      case 'backspace':
      case 'delete':
      case 'd':
        selection.deletePicked();
        break;
      case 'c':
        selection.unselectPickedObject();
        break;
      case 'r':
        transformControls.showX = !rotateActive;
        transformControls.showZ = !rotateActive;
        transformControls.showY = rotateActive;
        transformControls.setMode(rotateActive ? 'rotate' : 'translate');
        rotateActive = !rotateActive;
        break;
      case '+':
      case '=':
        transformControls.setSize(transformControls.size + 0.1);
        break;
      case '-':
      case '_':
        transformControls.setSize(Math.max(transformControls.size - 0.1, 0.1));
        break;
      case 'x':
      case 'y':
      case 'z': {
        const axis = `show${event.key.toUpperCase()}`;
        transformControls[axis] = !transformControls[axis];
        break;
      }
    }
  }
  host.addEventListener('keydown', onKeyDown);
  return () => host.removeEventListener('keydown', onKeyDown);
}
