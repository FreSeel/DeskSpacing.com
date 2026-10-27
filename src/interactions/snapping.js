import { createSnappingResolver } from '../snapping/resolveSnapping.js';

export function bindSnapping({
  host,
  canvas,
  view,
  state,
  snapping,
  transforms,
  onGuidance,
}) {
  const controls = view.transformControls;
  const resolve = createSnappingResolver();
  let gesture = null;
  let bypass = false;
  const cleanup = [];
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    cleanup.push(() => target.removeEventListener(name, handler, options));
  };
  function begin() {
    const object = controls.object;
    if (!object || !state.has(object)) return;
    transforms.begin(object);
    gesture = {
      object,
      origin: object.getWorldPosition(object.position.clone()),
      acquiredAxes: [],
      // No spatial index is needed for grid snapping. Future strategies can
      // filter these candidates once per gesture instead of on every move.
      nearbyObjects: state.objects.filter((other) => other !== object),
    };
  }
  function update() {
    if (
      !gesture ||
      controls.object !== gesture.object ||
      !state.has(gesture.object)
    )
      return;
    const object = gesture.object;
    const axes = ['x', 'y', 'z'].filter((axis) =>
      controls.axis?.includes(axis.toUpperCase()),
    );
    const result = resolve({
      object,
      proposed: {
        position: object.getWorldPosition(object.position.clone()),
        quaternion: object.getWorldQuaternion(object.quaternion.clone()),
        scale: object.getWorldScale(object.scale.clone()),
      },
      nearbyObjects: gesture.nearbyObjects,
      configuration: snapping.configuration,
      view: { camera: view.camera, canvas },
      placement: { axes, origin: gesture.origin },
      gesture,
      mode: controls.mode,
      bypass,
    });
    if (
      controls.mode === 'translate' &&
      snapping.configuration.enabled &&
      !bypass
    ) {
      transforms.moveWorldPosition(object, result.transform.position);
      for (const axis of result.guidance?.axes || []) {
        if (!gesture.acquiredAxes.includes(axis))
          gesture.acquiredAxes.push(axis);
      }
      if (result.guidance?.kind === 'grid') {
        const spacing = snapping.configuration.grid.spacing;
        gesture.gridCell = {
          spacing,
          indices: Object.fromEntries(
            result.guidance.axes.map((axis) => [
              axis,
              Math.round(result.transform.position[axis] / spacing),
            ]),
          ),
        };
      }
    } else {
      gesture.gridCell = null;
    }
    onGuidance(
      result.guidance,
      bypass && controls.mode === 'translate' && snapping.configuration.enabled,
    );
  }
  function end() {
    transforms.commit();
    gesture = null;
    onGuidance(null, false);
  }
  function modifier(event) {
    const next = Boolean(event.altKey);
    if (next === bypass) return;
    bypass = next;
    if (gesture)
      onGuidance(
        null,
        bypass &&
          controls.mode === 'translate' &&
          snapping.configuration.enabled,
      );
  }
  function blur() {
    bypass = false;
    controls.pointerUp(null);
    end();
    view.controls.enabled = true;
  }
  listen(controls, 'mouseDown', begin);
  listen(controls, 'objectChange', update);
  listen(controls, 'mouseUp', end);
  // Capture the modifier before TransformControls processes the proposal.
  // Do not cancel events: camera gestures and browser shortcuts keep working.
  listen(canvas, 'pointerdown', modifier, true);
  listen(canvas, 'pointermove', modifier, true);
  listen(host, 'keydown', modifier);
  listen(host, 'keyup', modifier);
  listen(host, 'blur', blur);
  cleanup.push(
    state.subscribe(() => {
      // An asynchronous add/replacement or desk-height shift invalidates the
      // captured control origin. End the gesture instead of continuing with
      // stale candidates, a discarded undo transaction or unsnapped movement.
      if (gesture) {
        controls.pointerUp(null);
        end();
        view.controls.enabled = true;
      }
    }),
  );
  cleanup.push(
    snapping.subscribe(() => {
      // Preference changes never move an idle object or rebase the pointer offset.
      onGuidance(null, false);
    }),
  );
  return () => {
    end();
    cleanup.forEach((remove) => remove());
  };
}
