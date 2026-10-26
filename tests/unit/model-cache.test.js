import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createModelLoader } from '../../src/models/modelLoader.js';

function fixture() {
  const image = { width: 4, height: 4, close: vi.fn() };
  const texture = new THREE.Texture(image);
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const scene = new THREE.Group();
  const root = new THREE.Group();
  root.position.set(3, 4, 5);
  root.add(new THREE.Mesh(geometry, material));
  scene.add(root);
  for (const resource of [geometry, material, texture])
    vi.spyOn(resource, 'dispose');
  const load = vi.fn((_url, resolve) => resolve({ scene }));
  return { scene, image, texture, geometry, material, load };
}
it('deduplicates concurrent loads and isolates transforms/materials while sharing geometry and textures', async () => {
  const f = fixture();
  const cache = createModelLoader({
    loader: { load: f.load },
    maxIdleBytes: 0,
  });
  const [a, b] = await Promise.all([
    cache.load('defaultMouse'),
    cache.load('defaultMouse'),
  ]);
  expect(f.load).toHaveBeenCalledOnce();
  expect(a.object).not.toBe(b.object);
  expect(a.object.position.toArray()).toEqual([3, 4, 5]);
  expect(a.object.children[0].geometry).toBe(b.object.children[0].geometry);
  expect(a.object.children[0].material).not.toBe(b.object.children[0].material);
  a.object.children[0].material.color.setHex(0xff0000);
  expect(b.object.children[0].material.color.getHex()).toBe(0xffffff);
  a.release();
  expect(f.geometry.dispose).not.toHaveBeenCalled();
  expect(f.image.close).not.toHaveBeenCalled();
  b.release();
  b.release();
  for (const resource of [f.geometry, f.material, f.texture])
    expect(resource.dispose).toHaveBeenCalledOnce();
  expect(f.image.close).toHaveBeenCalledOnce();
});
it('reuses an idle template within budget and evicts it on shutdown', async () => {
  const f = fixture();
  const cache = createModelLoader({ loader: { load: f.load } });
  (await cache.load('defaultMouse')).release();
  (await cache.load('defaultMouse')).release();
  expect(f.load).toHaveBeenCalledOnce();
  expect(f.geometry.dispose).not.toHaveBeenCalled();
  cache.dispose();
  expect(f.geometry.dispose).toHaveBeenCalledOnce();
});
it('does not cache errors and releases a late completion after shutdown', async () => {
  const f = fixture();
  let complete;
  const load = vi.fn((_url, resolve, _progress, reject) => {
    if (load.mock.calls.length === 1) reject(new Error('offline'));
    else complete = resolve;
  });
  const cache = createModelLoader({ loader: { load } });
  await expect(cache.load('defaultMouse')).rejects.toThrow('Could not load');
  const late = cache.load('defaultMouse');
  cache.dispose();
  complete({ scene: f.scene });
  await expect(late).rejects.toThrow('Could not load');
  expect(f.image.close).toHaveBeenCalledOnce();
});

it('converts imported model instances without changing cached roots or shared geometry', async () => {
  const f = fixture();
  const cache = createModelLoader({
    loader: { load: f.load },
    maxIdleBytes: 0,
  });
  const a = await cache.load('appleStudioPro');
  const imported = a.object.children[0];
  expect(imported.scale.x).toBeCloseTo(39.37007874);
  expect(imported.children[0].position.toArray()).toEqual([3, 4, 5]);
  expect(f.scene.children[0].scale.toArray()).toEqual([1, 1, 1]);
  expect(imported.children[0].children[0].geometry).toBe(f.geometry);
  a.object.position.set(10, 20, 30);
  const b = await cache.load('appleStudioPro');
  expect(b.object.position.toArray()).toEqual([0, 0, 0]);
  a.release();
  expect(f.geometry.dispose).not.toHaveBeenCalled();
  b.release();
  b.release();
  expect(f.geometry.dispose).toHaveBeenCalledOnce();
  expect(f.image.close).toHaveBeenCalledOnce();
});
