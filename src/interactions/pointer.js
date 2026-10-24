export function bindPointer({
  host,
  document,
  canvas,
  selection,
  controls,
  transformControls,
}) {
  let pickedTransform = false;
  let rightMouseMove = false;
  const enablePicking = () => {
    selection.pickEnabled = true;
  };
  const onTransformDown = () => {
    pickedTransform = true;
    controls.enabled = false;
  };
  const onTransformUp = () => {
    controls.enabled = true;
  };
  function onMouseDown(event) {
    rightMouseMove = event.button === 2;
    if (!pickedTransform) {
      const rect = canvas.getBoundingClientRect();
      selection.mouseSelect({
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * -2 + 1,
      });
    }
    pickedTransform = false;
  }
  function onMouseMove(event) {
    if (rightMouseMove) event.stopImmediatePropagation();
  }
  canvas.addEventListener('click', enablePicking);
  transformControls.addEventListener('mouseDown', onTransformDown);
  transformControls.addEventListener('mouseUp', onTransformUp);
  host.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  return () => {
    canvas.removeEventListener('click', enablePicking);
    transformControls.removeEventListener('mouseDown', onTransformDown);
    transformControls.removeEventListener('mouseUp', onTransformUp);
    host.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
  };
}
