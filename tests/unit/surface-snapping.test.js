import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createSurfaceGeometry } from '../../src/snapping/surfaceGeometry.js';
import { createSnappingResolver } from '../../src/snapping/resolveSnapping.js';
import { createObjectFootprints } from '../../src/snapping/objectFootprints.js';
import { prepareMagneticAnchors } from '../../src/snapping/magnetic.js';
import { createTransformActions } from '../../src/state/transformActions.js';
import { supportKind } from '../../src/catalog/placement.js';

const resolve = createSnappingResolver();
function box(size, position, product = 'referenceBox') {
  const object = new THREE.Group();
  object.userData.objectName = product;
  object.userData.type =
    product === 'customDesk' ? 'FurnitureDeskNoSelect' : 'PrimitiveBox';
  object.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshBasicMaterial(),
    ),
  );
  object.position.set(...position);
  return object;
}
function setup(height = 4, offset = 0) {
  const source = box([2, height, 2], [0, 10 + height / 2 - offset + 0.4, 0]);
  source.children[0].position.y = offset;
  const desk = box([12, 2, 8], [0, 9, 0], 'customDesk');
  return { source, desk };
}
function context(source, targets, extra = {}) {
  const surface = createSurfaceGeometry().prepare(source, targets);
  return {
    proposed: {
      position: source.getWorldPosition(new THREE.Vector3()),
      quaternion: source.quaternion.clone(),
      scale: source.scale.clone(),
    },
    configuration: {
      enabled: true,
      grid: { enabled: false, spacing: 1 },
      objects: { enabled: false },
      surface: { enabled: true },
    },
    placement: { axes: ['x', 'z'] },
    mode: 'translate',
    surface,
    ...extra,
  };
}
function apply(source, result) {
  const actions = createTransformActions({
    state: { has: () => true, subscribe: () => () => {} },
    invalidateScene: vi.fn(),
  });
  actions.moveWorldPosition(source, result.transform.position);
  actions.dispose();
}
function bottom(source) {
  source.updateWorldMatrix(true, true);
  let y = Infinity;
  source.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
      y = Math.min(
        y,
        mesh
          .getVertexPosition(i, new THREE.Vector3())
          .applyMatrix4(mesh.matrixWorld).y,
      );
  });
  return y;
}

it.each([
  [2, 0],
  [20 / 2.54, 0],
  [7, -4],
  [9, 12],
])(
  'places height %s with pivot offset %s on the actual upper boundary',
  (height, offset) => {
    const { source, desk } = setup(height, offset);
    const input = context(source, [desk]);
    const result = resolve(input);
    expect(result.guidance.surface.height).toBe(10);
    expect(result.transform.position.x).toBe(input.proposed.position.x);
    expect(result.transform.position.z).toBe(input.proposed.position.z);
    expect(result.transform.quaternion).toBe(input.proposed.quaternion);
    apply(source, result);
    expect(bottom(source)).toBeCloseTo(10, 10);
  },
);

it('uses actual vertices for a tilted, scaled, offset accessory under mirrored nested transforms', () => {
  const { source, desk } = setup();
  const parent = new THREE.Group();
  parent.position.set(2, 7, -1);
  parent.rotation.set(0.15, 0.3, 0.1);
  parent.scale.set(-1.2, 1.3, 0.8);
  parent.add(source);
  source.rotation.set(0.2, 0.5, -0.25);
  source.scale.set(1.5, 0.7, 1.1);
  source.children[0].position.set(1, 3, 0.5);
  const beforeRotation = source.rotation.toArray(),
    beforeScale = source.scale.toArray();
  const initial = createSurfaceGeometry().prepare(source, [desk]).moving;
  const position = source.getWorldPosition(new THREE.Vector3());
  position.x -= initial.center.x;
  position.z -= initial.center.z;
  position.y += 10.4 - bottom(source);
  apply(source, { transform: { position } });
  const result = resolve(context(source, [desk]));
  apply(source, result);
  expect(bottom(source)).toBeCloseTo(10, 9);
  expect(source.rotation.toArray()).toEqual(beforeRotation);
  expect(source.scale.toArray()).toEqual(beforeScale);
});

it('recognizes only catalog desks/floors, excluding hidden meshes, helpers, self and moving sets', () => {
  const { source, desk } = setup();
  const floor = box([20, 2, 20], [0, 0, 0], 'floor');
  const arbitrary = box([12, 2, 8], [0, 9, 0]);
  arbitrary.userData.type = 'DeskShelfSurface';
  const hidden = box([12, 2, 8], [0, 9, 0], 'modernDesk');
  hidden.children[0].visible = false;
  const helper = box([12, 2, 8], [0, 9, 0], 'standingDesk');
  helper.children[0].userData.snappingIgnore = true;
  const transparent = box([12, 2, 8], [0, 9, 0], 'alexDesk61');
  transparent.children[0].material.opacity = 0;
  const reader = createSurfaceGeometry();
  const prepared = reader.prepare(source, [
    source,
    desk,
    floor,
    arbitrary,
    hidden,
    helper,
    transparent,
  ]);
  expect(prepared.targets.map((t) => t.kind).sort()).toEqual(['desk', 'floor']);
  expect(
    reader.prepare(source, [desk], new Set([source, desk])).targets,
  ).toEqual([]);
  expect(supportKind('shelf')).toBeNull();
  const parent = new THREE.Group();
  parent.add(desk);
  parent.visible = false;
  expect(reader.prepare(source, [desk]).targets).toEqual([]);
});

it('places on a floor near ground without attracting a desktop object down to it', () => {
  const { source } = setup();
  const floor = box([40, 2, 40], [0, 0, 0], 'floor');
  expect(resolve(context(source, [floor])).guidance).toBeNull();
  source.position.y = 3.4;
  apply(source, resolve(context(source, [floor])));
  expect(bottom(source)).toBeCloseTo(1, 10);
});

it('retains concave tabletop boundaries and allows partial overhang while the contact center is supported', () => {
  const source = box([4, 2, 4], [1, 11.4, 1]);
  const desk = new THREE.Group();
  desk.userData.objectName = 'customDesk';
  const horizontal = box([12, 2, 4], [0, 9, 0]);
  const vertical = box([4, 2, 8], [-4, 9, 6]);
  desk.add(horizontal, vertical);
  let result = resolve(context(source, [desk]));
  expect(result.guidance.surface).toBeDefined(); // base overhangs z=2 edge
  source.position.set(3, 11.4, 6); // inside overall bounding box, in the L cutout
  expect(resolve(context(source, [desk])).guidance).toBeNull();
  source.position.set(-4, 11.4, 6);
  expect(resolve(context(source, [desk])).guidance.surface).toBeDefined();
});

it('uses transformed tabletop triangles and rejects tilted supports and small decorative caps', () => {
  const { source, desk } = setup();
  const cap = box([0.5, 1, 0.5], [0, 5, 0]);
  desk.add(cap);
  desk.rotation.y = 0.5;
  desk.scale.set(-1.5, 2, 0.8);
  source.position.y = 13.3; // new top=11, bottom=11.3
  expect(resolve(context(source, [desk])).guidance.surface.height).toBeCloseTo(
    11,
    10,
  );
  desk.rotation.x = 0.1;
  expect(resolve(context(source, [desk])).guidance).toBeNull();
});

it('holds the current level, uses distinct acquisition/release bands and avoids switching levels horizontally', () => {
  const { source, desk } = setup();
  const upper = box([12, 2, 8], [0, 9.6, 0], 'standingDesk');
  const input = context(source, [desk, upper]);
  input.gesture = {
    magneticStarted: true,
    origin: source.position.clone(),
    acquiredAxes: [],
    surfaceLock: desk.uuid,
    surfaceLevel: 10,
  };
  expect(resolve(input).guidance.surface.key).toBe(desk.uuid);
  input.proposed.position.y = 13.8;
  expect(resolve(input).guidance.surface.key).toBe(desk.uuid); // release at >2 inches
  input.proposed.position.y = 14.1;
  expect(resolve(input).guidance).toBeNull();
  input.gesture.surfaceLock = null;
  input.proposed.position.y = 12.5;
  input.surface.targets = input.surface.targets.filter(
    (t) => t.key === upper.uuid,
  );
  expect(resolve(input).guidance).toBeNull();
  input.placement.axes = ['y'];
  expect(resolve(input).guidance.surface.key).toBe(upper.uuid);
});

it('uses a small inset for acquisition and retains contact to the exact edge without trapping movement', () => {
  const { source, desk } = setup();
  const input = context(source, [desk]);
  input.proposed.position.x = 5.98;
  expect(resolve(input).guidance).toBeNull();
  input.gesture = {
    magneticStarted: true,
    origin: source.position.clone(),
    acquiredAxes: [],
    surfaceLock: desk.uuid,
  };
  expect(resolve(input).guidance.surface.key).toBe(desk.uuid);
  input.proposed.position.x = 6.001;
  expect(resolve(input).guidance).toBeNull();
});

it('combines surface height, magnetic X and grid Z without snapping the contact height', () => {
  const { source, desk } = setup();
  const peer = box([2, 4, 2], [2.25, 12, 5]);
  const input = context(source, [desk, peer]);
  input.proposed.position = { x: 2.35, y: 12.4, z: 0.7 };
  input.placement.axes = ['x', 'y', 'z'];
  input.configuration.grid.enabled = true;
  input.configuration.objects.enabled = true;
  input.view = {
    measureCorrection: (_point, delta) => Math.hypot(delta.x, delta.z) * 20,
  };
  input.magnetic = prepareMagneticAnchors(
    createObjectFootprints().prepare(source, [peer]),
  );
  const result = resolve(input);
  expect(result.transform.position).toEqual({ x: 2.25, y: 12, z: 1 });
  expect(result.guidance.kind).toBe('magnetic');
  expect(result.guidance.surface.height).toBe(10);
});

it('rejects a grid or magnetic correction that would push valid contact off the support', () => {
  const { source, desk } = setup();
  desk.children[0].scale.x = 0.3; // edge at 1.8
  const input = context(source, [desk]);
  input.proposed.position.x = 1.7;
  input.configuration.grid.enabled = true;
  expect(resolve(input).transform.position).toEqual({ x: 1.7, y: 12, z: 0 });
  const peer = box([2, 4, 2], [2, 12, 5]);
  input.configuration.objects.enabled = true;
  input.view = {
    measureCorrection: (_point, delta) => Math.hypot(delta.x, delta.z) * 20,
  };
  input.magnetic = prepareMagneticAnchors(
    createObjectFootprints().prepare(source, [peer]),
  );
  const result = resolve(input);
  expect(result.transform.position).toEqual({ x: 1.7, y: 12, z: 0 });
  expect(result.guidance.kind).toBe('surface');
});

it('leaves disabled, bypassed, stationary and non-translation proposals untouched', () => {
  const { source, desk } = setup();
  for (const mode of ['disabled', 'master', 'bypass', 'rotate', 'stationary']) {
    const input = context(source, [desk]);
    if (mode === 'disabled') input.configuration.surface.enabled = false;
    if (mode === 'master') input.configuration.enabled = false;
    if (mode === 'bypass') input.bypass = true;
    if (mode === 'rotate') input.mode = 'rotate';
    if (mode === 'stationary') input.gesture = {};
    expect(resolve(input)).toEqual({
      transform: input.proposed,
      guidance: null,
    });
  }
});

it('caches immutable vertex data across gestures and performs no geometry queries per resolver update', () => {
  const { source, desk } = setup();
  const reader = createSurfaceGeometry();
  const spy = vi.spyOn(desk.children[0], 'getVertexPosition');
  const input = context(source, [desk]);
  input.surface = reader.prepare(source, [desk]);
  expect(spy).toHaveBeenCalled();
  spy.mockClear();
  for (let i = 0; i < 120; i++) {
    input.proposed.position.x = i / 100;
    resolve(input);
  }
  reader.prepare(source, [desk]);
  expect(spy).not.toHaveBeenCalled();
  desk.children[0].geometry.attributes.position.needsUpdate = true;
  reader.prepare(source, [desk]);
  expect(spy).toHaveBeenCalled();
});

it('ignores unused vertices outside the drawn physical geometry', () => {
  const { source, desk } = setup();
  const geometry = source.children[0].geometry.toNonIndexed();
  const array = [
    ...geometry.attributes.position.array,
    0,
    -100,
    0,
    1,
    -100,
    0,
    0,
    -100,
    1,
  ];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(array, 3));
  geometry.setDrawRange(0, array.length / 3 - 3);
  source.children[0].geometry = geometry;
  const result = resolve(context(source, [desk]));
  expect(result.transform.position.y).toBe(12);
});

it('delays reacquisition of overlapping surfaces while deliberately leaving vertical contact', () => {
  const { source, desk } = setup();
  const upper = box([12, 2, 8], [0, 9.6, 0], 'standingDesk');
  const input = context(source, [desk, upper]);
  input.placement.axes = ['y'];
  input.gesture = { magneticStarted: true, surfaceBlocked: desk.uuid };
  expect(resolve(input).guidance).toBeNull();
});

it('acquires contact after grid enters a support and reports the final physical position', () => {
  const { source, desk } = setup();
  desk.position.x = 0.2; // edge at x=6.2
  const input = context(source, [desk]);
  input.proposed.position.x = 6.3;
  input.configuration.grid.enabled = true;
  const result = resolve(input);
  expect(result.transform.position).toEqual({ x: 6, y: 12, z: 0 });
  expect(result.guidance.position).toEqual(result.transform.position);
  expect(result.guidance.surface.height).toBe(10);
});

it.each(
  Array.from({ length: 8 }, (_, mask) => [
    Boolean(mask & 1),
    Boolean(mask & 2),
    Boolean(mask & 4),
  ]),
)(
  'integrates Grid=%s Objects=%s Surface=%s with master and bypass overrides',
  (grid, objects, surface) => {
    const { source, desk } = setup();
    const peer = box([2, 4, 2], [2.25, 12, 5]);
    const input = context(source, [desk, peer]);
    input.proposed.position = { x: 2.35, y: 12.4, z: 0.7 };
    input.configuration.grid.enabled = grid;
    input.configuration.objects.enabled = objects;
    input.configuration.surface.enabled = surface;
    input.magnetic = prepareMagneticAnchors(
      createObjectFootprints().prepare(source, [peer]),
    );
    input.view = {
      measureCorrection: (_point, delta) => Math.hypot(delta.x, delta.z) * 20,
    };
    expect(resolve(input).transform.position).toEqual({
      x: objects ? 2.25 : grid ? 2 : 2.35,
      y: surface ? 12 : 12.4,
      z: grid ? 1 : 0.7,
    });
    input.bypass = true;
    expect(resolve(input)).toEqual({
      transform: input.proposed,
      guidance: null,
    });
    input.bypass = false;
    input.configuration.enabled = false;
    expect(resolve(input)).toEqual({
      transform: input.proposed,
      guidance: null,
    });
  },
);

it('keeps lightly uneven authored tabletop triangles in one support region', () => {
  const { source, desk } = setup();
  const positions = desk.children[0].geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) > 0 && positions.getX(i) > 0)
      positions.setY(i, positions.getY(i) - 0.004);
  }
  positions.needsUpdate = true;
  source.position.x = 3;
  const result = resolve(context(source, [desk]));
  expect(result.guidance.surface).toBeTruthy();
  expect(Math.abs(result.guidance.surface.height - 10)).toBeLessThan(0.01);
});
