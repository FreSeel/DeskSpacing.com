// The controls themselves own mode, axis visibility and size; UI only issues commands.
export function createTransformCommands(controls) {
  function mode(value) {
    const rotating = value === 'rotate';
    controls.showX = !rotating;
    controls.showZ = !rotating;
    controls.showY = rotating;
    controls.setMode(value);
  }
  return (command) => {
    if (command === 'translate' || command === 'rotate') mode(command);
    else if (command === 'toggle-mode')
      mode(controls.getMode() === 'rotate' ? 'translate' : 'rotate');
    else if (command === 'smaller' || command === 'larger')
      controls.setSize(
        Math.max(0.1, controls.size + (command === 'larger' ? 0.1 : -0.1)),
      );
    else if (['x', 'y', 'z'].includes(command)) {
      const axis = `show${command.toUpperCase()}`;
      controls[axis] = !controls[axis];
    }
  };
}
