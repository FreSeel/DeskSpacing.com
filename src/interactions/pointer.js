export function bindPointer({
  canvas,
  selection,
  controls,
  transformControls,
}) {
  let pickedTransform = false;
  const position = { x: 0, y: 0 };
  const onTransformDown = () => {
    pickedTransform = true;
    controls.enabled = false;
  };
  const onTransformUp = () => {
    controls.enabled = true;
  };
  const cancelDrag = () => {
    pickedTransform = false;
    transformControls.pointerUp(null);
    controls.enabled = true;
  };
  function onPointerDown(event) {
    if (event.button !== 0) return;
    selection.pickEnabled = true;
    if (!pickedTransform) {
      const rect = canvas.getBoundingClientRect();
      position.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      position.y = ((event.clientY - rect.top) / rect.height) * -2 + 1;
      selection.mouseSelect(position);
    }
    pickedTransform = false;
  }
  // Registered after the controls, so a gizmo press can suppress object picking.
  transformControls.addEventListener('mouseDown', onTransformDown);
  transformControls.addEventListener('mouseUp', onTransformUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointercancel', cancelDrag);
  return () => {
    transformControls.removeEventListener('mouseDown', onTransformDown);
    transformControls.removeEventListener('mouseUp', onTransformUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointercancel', cancelDrag);
  };
}
