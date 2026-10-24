// Coalesce changes into one frame, and keep ticking only while motion needs it.
export function createRenderScheduler({
  host,
  update,
  render,
  isAnimating = () => false,
}) {
  let frame = null;
  let dirty = false;
  let disposed = false;
  let suspended = false;
  function schedule() {
    if (!disposed && !suspended && frame === null)
      frame = host.requestAnimationFrame(tick);
  }
  function tick() {
    frame = null;
    const changed = update();
    if (dirty || changed) {
      dirty = false;
      render();
    }
    if (isAnimating()) schedule();
  }
  return {
    invalidate() {
      dirty = true;
      schedule();
    },
    setSuspended(value) {
      suspended = value;
      if (value && frame !== null) {
        host.cancelAnimationFrame(frame);
        frame = null;
      }
      if (!value) {
        dirty = true;
        schedule();
      }
    },
    dispose() {
      disposed = true;
      if (frame !== null) host.cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
