import { createSnappingResolver } from '../snapping/resolveSnapping.js';
import {
  createObjectFootprints,
  visibleInHierarchy,
} from '../snapping/objectFootprints.js';
import { prepareMagneticAnchors } from '../snapping/magnetic.js';
import { createSurfaceGeometry } from '../snapping/surfaceGeometry.js';
import {
  contactAt,
  supportsPosition,
  surfaceLimits,
} from '../snapping/surface.js';
import { supportKind } from '../catalog/placement.js';
import { createCameraMetric } from '../snapping/cameraMetric.js';

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
  const footprints = createObjectFootprints();
  const surfaces = createSurfaceGeometry();
  const measureCorrection = createCameraMetric(view.camera, canvas);
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
      signatures: new Map(),
      nearbyObjects: state.objects.filter((other) => other !== object),
    };
    if (controls.mode === 'translate') {
      magneticContext(object);
      surfaceContext(object);
    }
  }
  // Share one structural signature per root/update between magnetic and
  // surface preparation. Child visibility/transforms matter as much as roots.
  function geometrySignature(root) {
    if (gesture.signatures.has(root)) return gesture.signatures.get(root);
    root.updateWorldMatrix(true, true);
    const signature = [
      root,
      visibleInHierarchy(root),
      ...root.matrixWorld.elements.slice(0, root === gesture.object ? 12 : 16),
    ];
    root.traverse((node) => {
      signature.push(node, node.visible, node.userData.snappingIgnore);
      if (node !== root) signature.push(...node.matrix.elements);
      if (node.isMesh) {
        const g = node.geometry;
        signature.push(
          g,
          g.attributes.position,
          g.attributes.position?.version,
          g.attributes.position?.data?.version,
          g.index,
          g.index?.version,
          g.drawRange.start,
          g.drawRange.count,
          node.count,
          node.instanceMatrix?.version,
        );
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material])
          signature.push(material?.visible, material?.opacity);
      }
    });
    gesture.signatures.set(root, signature);
    return signature;
  }
  function magneticContext(object) {
    if (
      !snapping.configuration.enabled ||
      !snapping.configuration.objects.enabled ||
      bypass
    )
      return null;
    const signature = [object, ...gesture.nearbyObjects].flatMap(
      geometrySignature,
    );
    if (
      !gesture.signature ||
      signature.length !== gesture.signature.length ||
      signature.some((value, i) => value !== gesture.signature[i])
    ) {
      gesture.signature = signature;
      gesture.magnetic = prepareMagneticAnchors(
        footprints.prepare(object, gesture.nearbyObjects),
      );
    }
    return gesture.magnetic;
  }
  function surfaceContext(object) {
    if (
      !snapping.configuration.enabled ||
      !snapping.configuration.surface.enabled ||
      bypass
    )
      return null;
    const targets = gesture.nearbyObjects.filter((other) =>
      supportKind(other.userData.objectName),
    );
    const signature = [object, ...targets].flatMap(geometrySignature);
    if (
      !gesture.surfaceSignature ||
      signature.length !== gesture.surfaceSignature.length ||
      signature.some((value, i) => value !== gesture.surfaceSignature[i])
    ) {
      gesture.surfaceSignature = signature;
      gesture.surface = surfaces.prepare(object, targets);
    }
    return gesture.surface;
  }
  function update() {
    if (
      !gesture ||
      controls.object !== gesture.object ||
      !state.has(gesture.object)
    )
      return;
    gesture.signatures.clear();
    const object = gesture.object;
    const axes = ['x', 'y', 'z'].filter((axis) =>
      controls.axis?.includes(axis.toUpperCase()),
    );
    const position = object.getWorldPosition(object.position.clone());
    view.camera.updateMatrixWorld();
    const movement = measureCorrection(gesture.origin, {
      x: position.x - gesture.origin.x,
      y: position.y - gesture.origin.y,
      z: position.z - gesture.origin.z,
    });
    if (!gesture.magneticStarted && Number.isFinite(movement) && movement >= 2)
      gesture.magneticStarted = true;
    const magnetic =
      controls.mode === 'translate' ? magneticContext(object) : null;
    const surface =
      controls.mode === 'translate' ? surfaceContext(object) : null;
    const rawY = position.y;
    if (controls.mode === 'translate') position.y += gesture.surfaceOffset || 0;
    if (gesture.surfaceBlocked && surface?.moving) {
      const blocked = surface.targets.find(
        (target) => target.key === gesture.surfaceBlocked,
      );
      if (
        !blocked ||
        !supportsPosition(blocked, surface.moving, position) ||
        Math.abs(contactAt(surface.moving, position).y - blocked.height) >
          surfaceLimits.acquire
      )
        gesture.surfaceBlocked = null;
    }
    const result = resolve({
      object,
      proposed: {
        position,
        quaternion: object.getWorldQuaternion(object.quaternion.clone()),
        scale: object.getWorldScale(object.scale.clone()),
      },
      nearbyObjects: gesture.nearbyObjects,
      configuration: snapping.configuration,
      view: { camera: view.camera, canvas, measureCorrection },
      magnetic,
      surface,
      placement: { axes, origin: gesture.origin },
      gesture,
      mode: controls.mode,
      bypass,
    });
    if (controls.mode === 'translate') {
      const contact = result.guidance?.surface;
      if (gesture.surfaceLock && !contact) {
        if (
          axes.includes('y') &&
          snapping.configuration.enabled &&
          snapping.configuration.surface.enabled &&
          !bypass
        )
          gesture.surfaceBlocked = gesture.surfaceLock;
        // TransformControls always proposes from pointer-down. Rebase only the
        // derived free-height offset when releasing contact, including Alt or
        // preference changes, so the next native proposal cannot undo that lift.
        result.transform = {
          ...result.transform,
          position: {
            ...result.transform.position,
            y: gesture.surfaceLastY + (rawY - gesture.surfaceRawY),
          },
        };
        gesture.surfaceOffset = result.transform.position.y - rawY;
      } else if (contact && gesture.surfaceLock !== contact.key) {
        gesture.surfaceOffset = result.transform.position.y - rawY;
      }
      gesture.surfaceLock = contact?.key || null;
      if (contact) gesture.surfaceLevel = contact.height;
      gesture.surfaceRawY = rawY;
      gesture.surfaceLastY = result.transform.position.y;
      // Keep native local coordinates bit-for-bit when no correction applies.
      // A world/local round trip can otherwise introduce precision-only edits.
      if (
        result.transform.position.x !== position.x ||
        result.transform.position.y !== rawY ||
        result.transform.position.z !== position.z
      )
        transforms.moveWorldPosition(object, result.transform.position);
    }
    if (
      controls.mode === 'translate' &&
      snapping.configuration.enabled &&
      !bypass
    ) {
      const gridAxes =
        result.guidance?.kind === 'magnetic'
          ? result.guidance.gridAxes
          : result.guidance?.kind === 'grid'
            ? result.guidance.axes
            : [];
      for (const axis of gridAxes) {
        if (!gesture.acquiredAxes.includes(axis))
          gesture.acquiredAxes.push(axis);
      }
      gesture.magneticLock = result.guidance?.lock || null;
      if (gridAxes.length) {
        const spacing = snapping.configuration.grid.spacing;
        gesture.gridCell = {
          spacing,
          indices: Object.fromEntries(
            gridAxes.map((axis) => [
              axis,
              Math.round(result.transform.position[axis] / spacing),
            ]),
          ),
        };
      } else gesture.gridCell = null;
    } else {
      gesture.gridCell = null;
      gesture.magneticLock = null;
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
    if (gesture) gesture.magneticLock = null;
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
  listen(controls, 'object-changed', () => {
    if (gesture && controls.object !== gesture.object) {
      controls.pointerUp(null);
      end();
      view.controls.enabled = true;
    }
  });
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
      if (gesture) {
        gesture.magneticLock = null;
        gesture.gridCell = null;
      }
    }),
  );
  return () => {
    end();
    cleanup.forEach((remove) => remove());
  };
}
