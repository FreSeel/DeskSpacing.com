import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createObjectFactory } from '../../src/models/objectFactory.js';
import { createRecord } from '../../src/catalog/configuration.js';

it('retains the authored root and releases resources from both rendered and unused roots', async () => {
  const gltf = new THREE.Group();
  const first = new THREE.Group();
  const second = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshLambertMaterial({ map: texture });
  first.add(new THREE.Mesh(geometry, material));
  second.add(new THREE.Mesh(geometry, material));
  gltf.add(first, second);
  const load = vi.fn((_path, complete) => complete({ scene: gltf }));
  const factory = createObjectFactory({
    THREE,
    modelOptions: { loader: { load }, maxIdleBytes: 0 },
  });
  const object = await factory.create(createRecord('defaultMouse'));
  expect(object).not.toBe(first);
  expect(object.position.toArray()).toEqual(first.position.toArray());
  expect(object.children[0].castShadow).toBe(true);
  expect(load.mock.calls[0][0]).toBe('optimized-models/defaultMouse.glb');
  const scene = new THREE.Scene();
  scene.add(object);
  expect(gltf.children).toEqual([first, second]);
  scene.remove(object);
  for (const resource of [geometry, texture, material])
    vi.spyOn(resource, 'dispose');
  factory.dispose(object);
  for (const resource of [geometry, texture, material])
    expect(resource.dispose).toHaveBeenCalledOnce();
});

it('creates independent primitives so deleting one leaves the other resources intact', async () => {
  const factory = createObjectFactory({
    THREE: { ...THREE, GLTFLoader: class {} },
  });
  const record = createRecord('referenceBox', { dimensions: [5, 10, 20] });
  const first = await factory.create(record);
  const second = await factory.create(record);
  const geometry = second.children[0].geometry;
  vi.spyOn(geometry, 'dispose');
  expect(first.children[0].geometry).not.toBe(geometry);
  factory.dispose(first);
  expect(geometry.dispose).not.toHaveBeenCalled();
  expect(geometry.parameters).toMatchObject({
    width: 5,
    height: 10,
    depth: 20,
  });
  factory.dispose(second);
  expect(geometry.dispose).toHaveBeenCalledOnce();
});

it('keeps legacy sphere tessellation and dimensions instead of silently changing detail semantics', async () => {
  const legacy = await import('three-legacy');
  const factory = createObjectFactory({ THREE });
  const sphere = await factory.create(
    createRecord('referenceSphere', { dimensions: [7, -1, -1] }),
  );
  const old = new legacy.OctahedronBufferGeometry(7, 5);
  expect(sphere.children[0].geometry.attributes.position.array).toEqual(
    old.attributes.position.array,
  );
  expect(sphere.children[0].geometry.attributes.normal.array).toEqual(
    old.attributes.normal.array,
  );
  expect(sphere.children[0].geometry.parameters.radius).toBe(7);
  factory.dispose(sphere);
  old.dispose();
});
