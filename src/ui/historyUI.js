export function bindHistoryUI({ document, history, onError }) {
  const undo = document.getElementById('undoTransform');
  const redo = document.getElementById('redoTransform');
  function invoke(action) {
    try {
      history[action]();
    } catch (error) {
      onError(error);
    }
  }
  const onUndo = () => invoke('undo');
  const onRedo = () => invoke('redo');
  undo.addEventListener('click', onUndo);
  redo.addEventListener('click', onRedo);
  const unsubscribe = history.subscribe(() => {
    undo.disabled = !history.canUndo;
    redo.disabled = !history.canRedo;
  });
  return () => {
    unsubscribe();
    undo.removeEventListener('click', onUndo);
    redo.removeEventListener('click', onRedo);
  };
}
