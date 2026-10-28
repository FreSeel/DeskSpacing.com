import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createObjectFootprints } from '../../src/snapping/objectFootprints.js';
import { createSnappingResolver } from '../../src/snapping/resolveSnapping.js';
import { prepareMagneticAnchors } from '../../src/snapping/magnetic.js';
import { createCameraMetric } from '../../src/snapping/cameraMetric.js';
import { createSnappingPreference } from '../../src/snapping/preference.js';
import { createTransformActions } from '../../src/state/transformActions.js';

function box(name, x = 0, z = 0, w = 4, d = 2, h = 2) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.type = 'Model';
  root.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial(),
    ),
  );
  root.position.set(x, h / 2, z);
  return root;
}
const resolve = createSnappingResolver();
function setup() {
  const source = box('source');
  const target = box('target', 10, 8, 8, 4);
  const footprints = createObjectFootprints();
  return { source, target, footprints };
}
function context(
  source,
  targets,
  position,
  axes = ['x', 'z'],
  footprints = createObjectFootprints(),
) {
  return {
    object: source,
    proposed: {
      position: { x: position[0], y: source.position.y, z: position[1] },
      quaternion: source.quaternion.toArray(),
      scale: source.scale.toArray(),
    },
    configuration: {
      enabled: true,
      grid: { enabled: false, spacing: 1 },
      objects: { enabled: true },
    },
    placement: { axes },
    mode: 'translate',
    magnetic: prepareMagneticAnchors(footprints.prepare(source, targets)),
    view: {
      measureCorrection: (_position, delta) =>
        Math.hypot(delta.x, delta.z) * 20,
    },
  };
}

it.each([
  ['left edges', [8.2, 3.33], ['x'], [8, 3.33]],
  ['right edges', [12.2, 3.33], ['x'], [12, 3.33]],
  ['adjacent edges', [16.2, 3.33], ['x'], [16, 3.33]],
  ['back edges', [3.33, 7.2], ['z'], [3.33, 7]],
  ['front edges', [3.33, 9.2], ['z'], [3.33, 9]],
  ['depth adjacency', [3.33, 5.2], ['z'], [3.33, 5]],
  ['horizontal center', [10.2, 0.33], ['x'], [10, 0.33]],
  ['depth center', [0.33, 8.2], ['z'], [0.33, 8]],
  ['corners', [8.2, 7.2], ['x', 'z'], [8, 7]],
  ['coincident centers', [10.2, 8.2], ['x', 'z'], [10, 8]],
])(
  'aligns %s with different footprint sizes',
  (_name, proposal, axes, expected) => {
    const { source, target } = setup();
    const input = context(source, [target], proposal, axes);
    const { transform, guidance } = resolve(input);
    expect(transform.position.x).toBeCloseTo(expected[0], 10);
    expect(transform.position.z).toBeCloseTo(expected[1], 10);
    expect(transform.position.y).toBe(1);
    expect(transform.quaternion).toBe(input.proposed.quaternion);
    expect(transform.scale).toBe(input.proposed.scale);
    expect(guidance.kind).toBe('magnetic');
    expect(guidance.lines.length).toBeLessThanOrEqual(6);
  },
);

it('aligns a diagonal edge in its oriented frame and reserves both world axes from the grid', () => {
  const { source, target } = setup();
  source.rotation.y = target.rotation.y = Math.PI / 6;
  const offset = new THREE.Vector3(-2, 0, -8).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 6,
  );
  const normal = new THREE.Vector3(1, 0, 0).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 6,
  );
  const desired = target.position.clone().add(offset);
  const raw = desired.clone().addScaledVector(normal, 0.2);
  const input = context(source, [target], [raw.x, raw.z]);
  input.configuration.grid = { enabled: true, spacing: 5 };
  const result = resolve(input);
  expect(result.transform.position.x).toBeCloseTo(desired.x, 10);
  expect(result.transform.position.z).toBeCloseTo(desired.z, 10);
  expect(result.guidance.axes).toEqual(['x', 'z']);
  expect(result.guidance.gridAxes).toEqual([]);
  expect(source.rotation.y).toBe(Math.PI / 6);
});

it('matches corners for objects with nonparallel edges without changing rotation', () => {
  const { source, target, footprints } = setup();
  source.rotation.y = 0.47;
  target.rotation.y = -0.22;
  const m = footprints.read(source),
    t = footprints.read(target);
  const desired = {
    x: t.points[0].x - (m.points[0].x - m.origin.x),
    z: t.points[0].z - (m.points[0].z - m.origin.z),
  };
  const input = context(source, [target], [desired.x + 0.1, desired.z + 0.1]);
  const result = resolve(input);
  expect(result.transform.position.x).toBeCloseTo(desired.x, 10);
  expect(result.transform.position.z).toBeCloseTo(desired.z, 10);
  expect(result.guidance.alignment).toBe('corner');
  expect(result.transform.quaternion).toBe(input.proposed.quaternion);
});

it('honors parent rotation, nonuniform scale, mirrored transforms and fresh geometry bounds', () => {
  const source = box('source', 0, 0, 4, 2);
  const parent = new THREE.Group();
  parent.rotation.y = 0.6;
  parent.scale.set(-2, 1.5, 0.75);
  parent.position.set(11, 4, -3);
  parent.add(source);
  const reader = createObjectFootprints();
  const proxy = reader.read(source);
  expect(proxy.points).toHaveLength(4);
  const lengths = proxy.points
    .map((p, i) =>
      Math.hypot(
        p.x - proxy.points[(i + 1) % 4].x,
        p.z - proxy.points[(i + 1) % 4].z,
      ),
    )
    .sort((a, b) => a - b);
  expect(lengths[0]).toBeCloseTo(1.5, 10);
  expect(lengths[3]).toBeCloseTo(8, 10);
  expect(proxy.minY).toBe(4);
  expect(proxy.maxY).toBe(7);
  parent.position.x += 7;
  expect(reader.read(source).center.x).toBeCloseTo(proxy.center.x + 7, 10);
  source.children[0].geometry = new THREE.BoxGeometry(8, 2, 2);
  const changed = reader.read(source);
  expect(
    Math.max(...changed.points.map((p) => p.x)) -
      Math.min(...changed.points.map((p) => p.x)),
  ).toBeGreaterThan(12);
});

it('uses grid on the unclaimed axis and adjusts only the moving guides to the final grid position', () => {
  const { source, target } = setup();
  target.position.x = 10.25;
  const input = context(source, [target], [8.4, 0.68]);
  input.configuration.grid.enabled = true;
  const result = resolve(input);
  expect(result.transform.position).toEqual({ x: 8.25, y: 1, z: 1 });
  expect(result.guidance.axes).toEqual(['x']);
  expect(result.guidance.gridAxes).toEqual(['z']);
  expect(
    result.guidance.lines[0].map((p) => p.z).sort((a, b) => a - b),
  ).toEqual([0, 2]);
  expect(
    result.guidance.lines[1].map((p) => p.z).sort((a, b) => a - b),
  ).toEqual([6, 10]);
  for (const overrides of [
    { bypass: true },
    { mode: 'rotate' },
    { configuration: { ...input.configuration, enabled: false } },
  ]) {
    const request = { ...input, ...overrides };
    expect(resolve(request)).toEqual({
      transform: request.proposed,
      guidance: null,
    });
  }
  input.configuration.objects.enabled = false;
  expect(resolve(input).transform.position).toEqual({ x: 8, y: 1, z: 1 });
  input.configuration.grid.enabled = false;
  expect(resolve(input).transform).toBe(input.proposed);
});

it('keeps one target through competing candidates, releases predictably, and rejects far/other-level targets', () => {
  const { source, target } = setup();
  const other = box('other', 10.3, 8, 8, 4);
  const input = context(source, [target, other], [8.05, 3.33], ['x']);
  const first = resolve(input);
  input.gesture = { magneticStarted: true, magneticLock: first.guidance.lock };
  for (const x of [8.25, 8.28, 8.31, 8.65]) {
    input.proposed.position.x = x;
    expect(resolve(input).transform.position.x).toBe(8);
  }
  input.proposed.position.x = 8.95;
  expect(resolve(input).guidance).toBeNull();
  const reversed = context(source, [other, target], [8.05, 3.33], ['x']);
  expect(resolve(reversed).guidance.target).toBe(first.guidance.target);
  expect(
    resolve(context(source, [target], [8.1, -40], ['x'])).guidance,
  ).toBeNull();
  target.position.y = 12;
  expect(
    resolve(context(source, [target], [8.1, 3.33], ['x'])).guidance,
  ).toBeNull();
});

it('allows overlap and filters self, moving groups, invisible geometry and locked floors while accepting desks', () => {
  const { source, target, footprints } = setup();
  const floor = box('floor');
  floor.userData.type = 'FurnitureNoSelect';
  const desk = box('desk', 0, 0, 60, 30, 1);
  desk.position.y = -0.5;
  desk.userData.type = 'DeskNoSelect';
  const invisible = box('hidden');
  invisible.children[0].material.visible = false;
  const group = new THREE.Group();
  const hiddenChild = box('hiddenAncestor');
  group.add(hiddenChild);
  group.visible = false;
  const prepared = footprints.prepare(
    source,
    [source, target, floor, desk, invisible, hiddenChild],
    new Set([source, target]),
  );
  expect(prepared.targets.map((p) => p.key.split(':')[0])).toEqual(['desk']);
  const result = resolve(context(source, [target], [10.1, 8.1]));
  expect(result.transform.position).toEqual({ x: 10, y: 1, z: 8 });
  expect(resolve(context(source, [desk], [0.1, 0.1])).guidance.kind).toBe(
    'magnetic',
  );
});

it('uses camera zoom/depth for CSS-pixel acquisition and caps world-space attraction', () => {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const canvas = { clientWidth: 800, clientHeight: 800 };
  camera.position.set(0, 50, 60);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const metric = createCameraMetric(camera, canvas);
  const near = metric({ x: 0, y: 0, z: 0 }, { x: 1, z: 0 });
  camera.position.multiplyScalar(2);
  camera.updateMatrixWorld();
  expect(metric({ x: 0, y: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(near / 2, 6);
  camera.zoom = 2;
  camera.updateProjectionMatrix();
  expect(metric({ x: 0, y: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(near, 6);
  const { source, target } = setup();
  const input = context(source, [target], [1, 3.33], ['x']);
  input.view.measureCorrection = () => 0; // A nearly edge-on/far-away view.
  expect(resolve(input).guidance).toBeNull();
});

it('reuses vertex bounds across 50-object drag updates and refreshes changed geometry on the next preparation', () => {
  const source = box('source');
  const targets = Array.from({ length: 50 }, (_, i) =>
    box(`target${i}`, i * 8, 8),
  );
  const spies = [source, ...targets].map((root) =>
    vi.spyOn(root.children[0], 'getVertexPosition'),
  );
  const footprints = createObjectFootprints();
  const input = context(source, targets, [0, 0], ['x', 'z'], footprints);
  expect(spies.every((spy) => spy.mock.calls.length > 0)).toBe(true);
  spies.forEach((spy) => spy.mockClear());
  for (let i = 0; i < 120; i++) {
    input.proposed.position.x = i / 10;
    resolve(input);
  }
  footprints.prepare(source, targets);
  expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  targets[0].children[0].geometry.attributes.position.needsUpdate = true;
  footprints.prepare(source, targets);
  expect(spies[1]).toHaveBeenCalled();
  expect(spies[2]).not.toHaveBeenCalled();
});

it('migrates existing grid preferences and persists independent strategy toggles', () => {
  let saved = JSON.stringify({ enabled: true, grid: { spacing: 2.5 / 2.54 } });
  const host = {
    localStorage: {
      getItem: () => saved,
      setItem: (_key, value) => {
        saved = value;
      },
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const preference = createSnappingPreference(host);
  expect(preference.configuration).toEqual({
    enabled: true,
    grid: { enabled: true, spacing: 2.5 / 2.54 },
    objects: { enabled: false },
    surface: { enabled: false },
  });
  preference.setObjectsEnabled(true);
  preference.setGridEnabled(false);
  preference.setEnabled(false);
  const reloaded = createSnappingPreference(host);
  reloaded.setEnabled(true);
  expect(reloaded.configuration).toEqual({
    enabled: true,
    grid: { enabled: false, spacing: 2.5 / 2.54 },
    objects: { enabled: true },
    surface: { enabled: false },
  });
});

it('aligns actual centers for authored mesh offsets without changing the authored origin or geometry', () => {
  const { source, target } = setup();
  source.children[0].position.set(10, 0, -3);
  const before = source.children[0].position.clone();
  const result = resolve(context(source, [target], [0.2, 3.33], ['x']));
  expect(result.transform.position.x).toBeCloseTo(0, 10);
  expect(result.guidance.alignment).toBe('center');
  expect(source.children[0].position).toEqual(before);
});

it('applies a magnetic world-space corner through the existing action under a mirrored, scaled parent', () => {
  const { source, target, footprints } = setup();
  const parent = new THREE.Group();
  parent.position.set(11, 4, -3);
  parent.rotation.y = 0.6;
  parent.scale.set(-2, 1.5, 0.75);
  parent.add(source, target);
  const moving = footprints.read(source),
    fixed = footprints.read(target);
  const desired = {
    x: fixed.points[0].x - moving.points[0].x + moving.origin.x,
    z: fixed.points[0].z - moving.points[0].z + moving.origin.z,
  };
  const input = context(source, [target], [desired.x + 0.1, desired.z + 0.1]);
  input.proposed.position.y = moving.origin.y;
  const result = resolve(input);
  const originalRotation = source.rotation.toArray();
  const originalScale = source.scale.toArray();
  const transforms = createTransformActions({
    state: { has: (o) => o === source, subscribe: () => () => {} },
    invalidateScene: vi.fn(),
  });
  transforms.moveWorldPosition(source, result.transform.position);
  const placed = footprints.read(source);
  expect(placed.points[0].x).toBeCloseTo(fixed.points[0].x, 10);
  expect(placed.points[0].z).toBeCloseTo(fixed.points[0].z, 10);
  expect(placed.minY).toBeCloseTo(fixed.minY, 10);
  expect(source.rotation.toArray()).toEqual(originalRotation);
  expect(source.scale.toArray()).toEqual(originalScale);
  transforms.dispose();
});
