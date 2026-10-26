import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createObjectDimensions } from '../../src/measurements/objectDimensions.js';
import {
  fromInches,
  toInches,
  formatMeasurement,
} from '../../src/measurements/units.js';
import { layoutDimensions } from '../../src/scene/dimensionLayout.js';

function box(width = 30, height = 20, depth = 10) {
  const root = new THREE.Group();
  root.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(
        ...[width, height, depth].map((cm) => toInches(cm, 'cm')),
      ),
    ),
  );
  return root;
}

it('measures real 30 × 20 × 10 cm geometry; placement/rotation and formatting never change its dimensions', () => {
  const object = box();
  const reader = createObjectDimensions();
  const first = reader.read(object).dimensions;
  expect(formatMeasurement(first.x, 'cm')).toBe('30');
  expect(formatMeasurement(first.y, 'cm')).toBe('20');
  expect(formatMeasurement(first.z, 'cm')).toBe('10');
  const position = object.children[0].geometry.attributes.position;
  const vertices = position.array.slice();
  const readVertex = vi.spyOn(object.children[0], 'getVertexPosition');
  for (let i = 0; i < 100; i++) {
    object.position.set(i, i / 2, -i);
    object.rotation.set(i / 7, i / 3, i / 11);
    const measurement = reader.read(object);
    for (const axis of ['x', 'y', 'z']) {
      expect(measurement.dimensions[axis]).toBeCloseTo(first[axis], 10);
      expect(formatMeasurement(measurement.dimensions[axis], 'cm')).toBe(
        formatMeasurement(first[axis], 'cm'),
      );
    }
  }
  expect(readVertex).not.toHaveBeenCalled();
  expect(position.array).toEqual(vertices);
  expect(object.children[0].geometry.boundingBox).toBeNull();
});

it('accounts for root scale, descendant transforms, geometry replacement and edited vertices', () => {
  const object = box();
  const reader = createObjectDimensions();
  reader.read(object);
  object.scale.set(2, 3, 4);
  let result = reader.read(object);
  expect(formatMeasurement(result.dimensions.x, 'cm')).toBe('60');
  expect(formatMeasurement(result.dimensions.y, 'cm')).toBe('60');
  expect(formatMeasurement(result.dimensions.z, 'cm')).toBe('40');
  object.children[0].scale.x = 0.5;
  result = reader.read(object);
  expect(formatMeasurement(result.dimensions.x, 'cm')).toBe('30');
  object.children[0].geometry = new THREE.BoxGeometry(100 / 2.54, 1, 2);
  result = reader.read(object);
  expect(formatMeasurement(result.dimensions.x, 'cm')).toBe('100');
  expect(formatMeasurement(result.dimensions.x, 'in')).toBe('39.37');
  object.children[0].geometry.scale(2, 1, 1);
  expect(formatMeasurement(reader.read(object).dimensions.x, 'cm')).toBe('200');
});

it('keeps W/D in the catalog authored orientation, including meter-to-inch import wrappers', () => {
  const root = new THREE.Group();
  root.userData.objectName = 'modernDesk'; // Authored quarter-turn from its export frame.
  root.rotation.y = Math.PI / 2;
  const imported = new THREE.Group();
  imported.scale.setScalar(100 / 2.54);
  imported.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 1.4)));
  root.add(imported);
  const reader = createObjectDimensions();
  let result = reader.read(root);
  expect(formatMeasurement(result.dimensions.x, 'cm')).toBe('140');
  expect(formatMeasurement(result.dimensions.z, 'cm')).toBe('70');
  expect(formatMeasurement(result.dimensions.y, 'cm')).toBe('75');
  root.rotation.y += 0.7;
  result = reader.read(root);
  expect(formatMeasurement(result.dimensions.x, 'cm')).toBe('140');
  expect(formatMeasurement(result.dimensions.z, 'cm')).toBe('70');
});

it('bounds actual transformed vertices rather than overestimating rotated mesh bounding boxes', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 2, 0], 3),
  );
  const mesh = new THREE.Mesh(geometry);
  mesh.rotation.z = Math.PI / 4;
  root.add(mesh);
  const result = createObjectDimensions().read(root);
  expect(result.dimensions.x).toBeCloseTo(2 * Math.sqrt(2));
  expect(result.dimensions.y).toBeCloseTo(Math.sqrt(2));
});

it('uses sphere diameter, excludes hidden descendants, and returns no invented dimensions for empty geometry', () => {
  const reader = createObjectDimensions();
  const root = new THREE.Group();
  expect(reader.read(root)).toBeNull();
  const sphere = new THREE.Mesh(new THREE.OctahedronGeometry(10 / 2.54, 3));
  root.add(sphere);
  for (const value of Object.values(reader.read(root).dimensions))
    expect(fromInches(value, 'cm')).toBeCloseTo(20, 4);
  sphere.visible = false;
  expect(reader.read(root)).toBeNull();
  sphere.visible = true;
  expect(reader.read(root)).not.toBeNull();
  reader.clear();
  expect(reader.read(new THREE.Group())).toBeNull();
});

it('projects separated dimension labels for both small and large objects and hides behind-camera annotations', () => {
  const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 5000);
  camera.position.set(40, 30, 60);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const reader = createObjectDimensions();
  for (const scale of [0.1, 1]) {
    const root = box();
    root.scale.setScalar(scale);
    const measured = reader.read(root);
    const layout = layoutDimensions({
      ...measured,
      camera,
      width: 800,
      height: 600,
      labelSizes: {
        x: { width: 80, height: 25 },
        y: { width: 80, height: 25 },
        z: { width: 80, height: 25 },
      },
    });
    expect(layout).toHaveLength(3);
    for (let i = 0; i < layout.length; i++) {
      const a = layout[i].label;
      for (const item of layout.slice(i + 1)) {
        const b = item.label;
        expect(Math.abs(a.x - b.x) >= 88 || Math.abs(a.y - b.y) >= 33).toBe(
          true,
        );
      }
    }
  }
  camera.lookAt(80, 60, 120);
  camera.updateMatrixWorld();
  expect(
    layoutDimensions({
      ...reader.read(box()),
      camera,
      width: 800,
      height: 600,
      labelSizes: {},
    }),
  ).toEqual([]);
});

it('retains all three measurements when a dimension is viewed edge-on', () => {
  const camera = new THREE.OrthographicCamera(-30, 30, 25, -25, 0.1, 200);
  camera.position.set(0, 0, 50);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const measured = createObjectDimensions().read(box());
  const layout = layoutDimensions({
    ...measured,
    camera,
    width: 800,
    height: 600,
    labelSizes: {
      x: { width: 80, height: 25 },
      y: { width: 80, height: 25 },
      z: { width: 80, height: 25 },
    },
  });
  expect(layout).toHaveLength(3);
  expect(layout.map((item) => item.axis).sort()).toEqual(['x', 'y', 'z']);
});
