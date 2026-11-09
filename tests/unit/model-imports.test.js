import { describe, expect, it, vi } from 'vitest';
import * as THREE from '../../src/engine.js';
import { Vector3, Triangle } from 'three';
import { createImportLoader } from '../../src/models/importLoader.js';
import { createImportRegistry } from '../../src/models/importRegistry.js';
import { createModelImports } from '../../src/models/modelImports.js';
import {
  localModelSource,
  remoteModelSource,
} from '../../src/models/importSource.js';
import { createObjectFactory } from '../../src/models/objectFactory.js';
import { createObjectStore } from '../../src/state/objectStore.js';
import { createActions } from '../../src/state/actions.js';
import {
  createSelection,
  findObjectRoot,
} from '../../src/interactions/selection.js';
import { createSurfaceGeometry } from '../../src/snapping/surfaceGeometry.js';
import { createObjectFootprints } from '../../src/snapping/objectFootprints.js';
import { createLocalProjects } from '../../src/projects/localProjects.js';
import { createSharing } from '../../src/sharing/createSharing.js';
import {
  modelJson,
  selfContainedGltf,
  triangleBytes,
  triangleGlb,
  indexedGltf,
} from '../fixtures/importModel.js';
import { pixelPng } from '../fixtures/importTexture.js';
import { objectToRecord } from '../../src/sharing/sceneRecords.js';
import { createRecord } from '../../src/catalog/configuration.js';
import { limits } from '../../src/sharing/legacyCodec.js';

const file = (bytes, name = 'desk model.gltf') =>
  new globalThis.File([bytes], name);
const gltfFile = (json = selfContainedGltf()) => file(JSON.stringify(json));
const glbFile = () => file(triangleGlb(), 'desk model.glb');
const signal = () => new globalThis.AbortController().signal;

function harness({ load, storage } = {}) {
  const factory = createObjectFactory({
    THREE,
    imports: createImportRegistry({ load }),
  });
  const scene = new THREE.Scene();
  const invalidateScene = vi.fn();
  const state = createObjectStore({
    scene,
    disposeObject: factory.dispose,
    onChange: invalidateScene,
  });
  const transformControls = { attach: vi.fn(), detach: vi.fn() };
  const selection = createSelection({
    THREE,
    camera: new THREE.PerspectiveCamera(),
    transformControls,
    getObjects: () => state.objects,
    removeObject: (object) => actions.remove(object),
  });
  const actions = createActions({ state, factory, selection, invalidateScene });
  const imports = createModelImports({ state, actions, factory });
  const projects = createLocalProjects({
    state,
    actions,
    factory,
    modelImports: imports,
    storage,
  });
  const sharing = createSharing({
    state,
    actions,
    getLocation: () => 'https://test.example/mainApp.html',
  });
  return {
    factory,
    invalidateScene,
    state,
    actions,
    selection,
    transformControls,
    imports,
    projects,
    sharing,
    dispose() {
      projects.dispose();
      imports.dispose();
      actions.dispose();
      factory.disposeAll();
    },
  };
}

describe('custom glTF validation', () => {
  it('accepts a large index array within the production triangle budget', async () => {
    const model = gltfFile(indexedGltf(300_000));
    const asset = await createImportLoader()(
      localModelSource(model),
      model,
      signal(),
    );
    expect(
      asset.root.getObjectsByProperty('isMesh', true)[0].geometry.index.count,
    ).toBe(300_000);
    asset.dispose();
  });
  it('uses the triangle-index budget independently of the vertex budget', async () => {
    const model = gltfFile(indexedGltf());
    const load = createImportLoader({
      limits: { maxVertices: 3, maxIndices: 6 },
    });
    const asset = await load(localModelSource(model), model, signal());
    expect(
      asset.root.getObjectsByProperty('isMesh', true)[0].geometry.index.count,
    ).toBe(6);
    asset.dispose();
    const excessive = gltfFile(indexedGltf(9));
    await expect(
      load(localModelSource(excessive), excessive, signal()),
    ).rejects.toThrow(/accessor|budget/);
  });

  it('raycasts actual geometry even when authored accessor bounds are incorrect', async () => {
    const json = selfContainedGltf();
    json.accessors[0].min = json.accessors[0].max = [0, 0, 0];
    const model = gltfFile(json);
    const asset = await createImportLoader()(
      localModelSource(model),
      model,
      signal(),
    );
    asset.root.updateMatrixWorld(true);
    const mesh = asset.root.getObjectsByProperty('isMesh', true)[0];
    const vertices = [0, 1, 2].map((index) =>
      new Vector3()
        .fromBufferAttribute(mesh.geometry.attributes.position, index)
        .applyMatrix4(mesh.matrixWorld),
    );
    const triangle = new Triangle(...vertices);
    const normal = triangle.getNormal(new Vector3());
    const center = triangle.getMidpoint(new Vector3());
    const ray = new THREE.Raycaster(
      center.clone().add(normal),
      normal.negate(),
    );
    expect(ray.intersectObject(asset.root, true)).toHaveLength(1);
    asset.dispose();
  });

  it('loads direct remote GLB bytes without storing or requesting dependencies', async () => {
    const fetch = vi.fn(async () => new globalThis.Response(triangleGlb()));
    const asset = await createImportLoader({ fetch })(
      remoteModelSource('https://models.test/item.glb'),
      undefined,
      signal(),
    );
    expect(asset.root.children).toHaveLength(2);
    expect(fetch).toHaveBeenCalledOnce();
    asset.dispose();
  });

  it.each([
    [
      'HTML returned by a model URL',
      () => '<html>Model page</html>',
      /invalid glTF JSON/,
    ],
    [
      'unsupported format',
      () => JSON.stringify({ asset: { version: '1.0' } }),
      /glTF 2.0/,
    ],
    [
      'missing dependency',
      () => JSON.stringify(modelJson('missing.bin')),
      /HTTP 404/,
    ],
  ])('rejects %s', async (_name, content, message) => {
    const fetch = vi.fn(
      async () => new globalThis.Response(null, { status: 404 }),
    );
    fetch.mockResolvedValueOnce(new globalThis.Response(content()));
    await expect(
      createImportLoader({ fetch })(
        remoteModelSource('https://models.test/item.gltf'),
        undefined,
        signal(),
      ),
    ).rejects.toThrow(message);
  });

  it('cancels streaming downloads when the actual body exceeds the budget', async () => {
    const cancel = vi.fn();
    const fetch = vi.fn(
      async () =>
        new globalThis.Response(
          new globalThis.ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(17));
            },
            cancel,
          }),
        ),
    );
    await expect(
      createImportLoader({ fetch, limits: { maxBytes: 16 } })(
        remoteModelSource('https://models.test/item.glb'),
        undefined,
        signal(),
      ),
    ).rejects.toThrow(/size limit/);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('limits decoded textures before allocation and closes earlier bitmaps on failure', async () => {
    const json = selfContainedGltf();
    json.images = [1, 2].map((size) => ({
      uri: `data:image/png;base64,${pixelPng(size, size).toString('base64')}`,
    }));
    const image = { width: 1, height: 1, close: vi.fn() };
    const decodeImage = vi.fn(async () => image);
    const model = gltfFile(json);
    await expect(
      createImportLoader({ decodeImage, limits: { maxTexturePixels: 4 } })(
        localModelSource(model),
        model,
        signal(),
      ),
    ).rejects.toThrow(/texture size limit/);
    expect(decodeImage).toHaveBeenCalledOnce();
    expect(image.close).toHaveBeenCalledOnce();
  });

  it('closes bitmaps decoded after cancellation without publishing a model', async () => {
    const json = selfContainedGltf();
    json.images = [
      { uri: `data:image/png;base64,${pixelPng().toString('base64')}` },
    ];
    const deferred = Promise.withResolvers();
    const decodeImage = vi.fn(() => deferred.promise);
    const controller = new globalThis.AbortController();
    const model = gltfFile(json);
    const result = createImportLoader({ decodeImage })(
      localModelSource(model),
      model,
      controller.signal,
    );
    const rejected = expect(result).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => expect(decodeImage).toHaveBeenCalledOnce());
    controller.abort();
    const close = vi.fn();
    deferred.resolve({ width: 1, height: 1, close });
    await rejected;
    expect(close).toHaveBeenCalledOnce();
  });
  it.each([gltfFile(), glbFile()])(
    'loads local $name with all authored roots',
    async (model) => {
      const asset = await createImportLoader()(
        localModelSource(model),
        model,
        signal(),
      );
      expect(asset.root.children).toHaveLength(2);
      expect(asset.offset).toEqual(
        expect.arrayContaining([expect.any(Number)]),
      );
      expect(asset.scale).toBeCloseTo(39.37007874);
      asset.dispose();
    },
  );

  it('rejects companion-file uploads, invalid GLB and empty geometry', async () => {
    const load = createImportLoader();
    const external = gltfFile(modelJson('triangle.bin'));
    const corrupt = file('not a GLB', 'broken.glb');
    const empty = gltfFile({
      asset: { version: '2.0' },
      scenes: [{ nodes: [0] }],
      nodes: [{}],
    });
    await expect(
      load(localModelSource(external), external, signal()),
    ).rejects.toThrow(/self-contained/);
    await expect(
      load(localModelSource(corrupt), corrupt, signal()),
    ).rejects.toThrow(/GLB header/);
    await expect(
      load(localModelSource(empty), empty, signal()),
    ).rejects.toThrow(/no renderable meshes/);
    expect(() => remoteModelSource('https://example.test/model-page')).toThrow(
      /direct model URL/,
    );
    expect(() => remoteModelSource('file:///model.glb')).toThrow(/HTTP/);
  });

  it('rejects hostile graph references, unsupported compression and out-of-range budgets', async () => {
    const cycle = selfContainedGltf();
    cycle.nodes[1].children = [0];
    const compressed = {
      ...selfContainedGltf(),
      extensionsRequired: ['KHR_draco_mesh_compression'],
    };
    const load = createImportLoader();
    for (const [json, error] of [
      [cycle, /scene graph/],
      [compressed, /KHR_draco_mesh_compression/],
    ]) {
      const model = gltfFile(json);
      await expect(
        load(localModelSource(model), model, signal()),
      ).rejects.toThrow(error);
    }
    const model = glbFile();
    await expect(
      createImportLoader({ limits: { maxBytes: 12 } })(
        localModelSource(model),
        model,
        signal(),
      ),
    ).rejects.toThrow(/size limit/);
    await expect(
      createImportLoader({ limits: { maxIndices: 2 } })(
        localModelSource(model),
        model,
        signal(),
      ),
    ).rejects.toThrow(/geometry budget/);
  });

  it('resolves remote dependencies from the redirected model and reports resource failures', async () => {
    const source = remoteModelSource('https://models.test/item.gltf?version=1');
    const fetch = vi.fn(async (url) => {
      if (url === source.url) {
        const response = new globalThis.Response(
          JSON.stringify(modelJson('../data/triangle.bin')),
        );
        Object.defineProperty(response, 'url', {
          value: 'https://cdn.test/objects/item.gltf',
        });
        return response;
      }
      return new globalThis.Response(triangleBytes());
    });
    const asset = await createImportLoader({ fetch })(
      source,
      undefined,
      signal(),
    );
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      source.url,
      'https://cdn.test/data/triangle.bin',
    ]);
    expect(fetch.mock.calls[1][1]).toMatchObject({
      mode: 'cors',
      credentials: 'omit',
    });
    asset.dispose();
    fetch.mockImplementationOnce(
      async () => new globalThis.Response(null, { status: 404 }),
    );
    await expect(
      createImportLoader({ fetch })(source, undefined, signal()),
    ).rejects.toThrow(/HTTP 404/);
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(
      createImportLoader({ fetch })(source, undefined, signal()),
    ).rejects.toThrow(/CORS/);
  });

  it('times out and aborts pending remote requests', async () => {
    const fetch = vi.fn(
      (_url, { signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          }),
        ),
    );
    const load = createImportLoader({ fetch, limits: { timeoutMs: 10 } });
    const source = remoteModelSource('https://models.test/item.glb');
    await expect(load(source, undefined, signal())).rejects.toThrow(
      /timed out/,
    );
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe('scene and asset ownership', () => {
  it('applies the shared limit to imports and duplicates and releases rejected instances', async () => {
    const app = harness();
    for (let index = 0; index < limits.objects - 1; index++)
      app.state.add(new THREE.Group(), createRecord('defaultMouse'));
    const dispose = vi.spyOn(app.factory, 'dispose');
    const imported = await app.imports.importModelFromFile(glbFile()).result;
    expect(app.state.objects).toHaveLength(limits.objects);
    const before = app.state.objects;
    const selection = app.selection.pickedObject;
    const another = app.imports.importModelFromFile(glbFile());
    await expect(another.result).rejects.toThrow('supported 500-object limit');
    expect(app.imports.getImportStatus(another).state).toBe('failure');
    const duplicate = app.imports.duplicateImportedObject(
      imported.userData.objectId,
    );
    await expect(duplicate.result).rejects.toThrow(
      'supported 500-object limit',
    );
    expect(app.state.objects).toEqual(before);
    expect(app.selection.pickedObject).toBe(selection);
    expect(dispose).toHaveBeenCalledTimes(2);
    // Replacing an imported instance uses its existing membership slot.
    const replacement = await app.actions.addImported(
      objectToRecord(imported),
      {
        blob: app.factory.importedFile(imported),
        signal: signal(),
        target: imported,
      },
    );
    expect(app.state.objects).toHaveLength(limits.objects);
    expect(app.state.has(imported)).toBe(false);
    expect(app.state.has(replacement)).toBe(true);
    app.actions.remove(app.state.objects[0]);
    expect(app.state.objects).toHaveLength(limits.objects - 1);
    const copy = await app.imports.duplicateImportedObject(
      replacement.userData.objectId,
    ).result;
    expect(app.state.has(copy)).toBe(true);
    expect(app.state.objects).toHaveLength(limits.objects);
    app.actions.history.undo();
    expect(app.state.objects).toHaveLength(limits.objects - 1);
    app.actions.history.redo();
    expect(app.state.objects).toHaveLength(limits.objects);
    app.dispose();
  });

  it('treats import, transform and duplicate as independent undo steps without mutating shared geometry', async () => {
    const app = harness();
    const object = await app.imports.importModelFromFile(glbFile()).result;
    const original = objectToRecord(object);
    const geometry = object.getObjectsByProperty('isMesh', true)[0].geometry;
    const vertices = geometry.attributes.position.array.slice();
    app.actions.history.undo();
    expect(app.state.objects).toEqual([]);
    expect(app.actions.history.canUndo).toBe(false);
    app.actions.history.redo();
    expect(app.state.objects).toEqual([object]);
    app.actions.transforms.update(object, {
      position: { x: 7 },
      rotationDegrees: { y: 35 },
      scale: { x: 2, y: 3, z: 4 },
    });
    const transformed = objectToRecord(object);
    app.actions.history.undo();
    expect(objectToRecord(object)).toEqual(original);
    app.actions.history.redo();
    expect(objectToRecord(object)).toEqual(transformed);
    const duplicate = await app.imports.duplicateImportedObject(
      object.userData.objectId,
    ).result;
    app.actions.history.undo();
    expect(app.state.objects).toEqual([object]);
    app.actions.history.redo();
    expect(app.state.objects).toEqual([object, duplicate]);
    app.actions.transforms.setPosition(duplicate, { x: 100 });
    expect(objectToRecord(object)).toEqual(transformed);
    const inches = app.actions.transforms.read(object, { unit: 'in' });
    for (let i = 0; i < 10; i++) {
      const cm = app.actions.transforms.read(object, { unit: 'cm' });
      expect(cm.dimensions.width).toBeCloseTo(inches.dimensions.width * 2.54);
      app.actions.transforms.read(object, { unit: 'in' });
    }
    expect(objectToRecord(object)).toEqual(transformed);
    expect(geometry.attributes.position.array).toEqual(vertices);
    app.selection.unselectPickedObject();
    expect(app.selection.pickedObject).toBeNull();
    app.dispose();
  });

  it('releases geometry, materials and decoded images after repeated import/delete/history clearing', async () => {
    const json = selfContainedGltf();
    json.images = [
      { uri: `data:image/png;base64,${pixelPng().toString('base64')}` },
    ];
    json.textures = [{ source: 0 }];
    json.materials = [
      { pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
    ];
    json.meshes[0].primitives[0].material = 0;
    const bitmaps = [];
    const load = createImportLoader({
      decodeImage: async () => {
        const bitmap = { width: 1, height: 1, close: vi.fn() };
        bitmaps.push(bitmap);
        return bitmap;
      },
    });
    const app = harness({ load });
    const model = gltfFile(json);
    for (let i = 0; i < 12; i++) {
      const object = await app.imports.importModelFromFile(model).result;
      const mesh = object.getObjectsByProperty('isMesh', true)[0];
      const releases = [mesh.geometry, mesh.material, mesh.material.map].map(
        (resource) => {
          const release = vi.fn();
          resource.addEventListener('dispose', release);
          return release;
        },
      );
      app.actions.remove(object);
      releases.forEach((release) => expect(release).not.toHaveBeenCalled());
      app.actions.history.clear();
      releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
      expect(app.factory.importedFile(object)).toBeUndefined();
    }
    app.dispose();
    expect(bitmaps).toHaveLength(12);
    bitmaps.forEach((bitmap) => expect(bitmap.close).toHaveBeenCalledOnce());
  });

  it('preserves membership, selection and history on failed imports', async () => {
    const app = harness();
    const object = await app.imports.importModelFromFile(glbFile()).result;
    const before = objectToRecord(object);
    const task = app.imports.importModelFromFile(file('corrupt', 'bad.glb'));
    await expect(task.result).rejects.toThrow(/GLB header/);
    expect(app.imports.getImportStatus(task).state).toBe('failure');
    expect(app.state.objects).toEqual([object]);
    expect(app.selection.pickedObject).toBe(object);
    expect(objectToRecord(object)).toEqual(before);
    app.actions.history.undo();
    expect(app.state.objects).toEqual([]);
    app.dispose();
  });

  it.each(['undo', 'dispose'])(
    'cancels an in-flight import on %s and releases a late load',
    async (operation) => {
      const deferred = Promise.withResolvers();
      const asset = await createImportLoader()(
        localModelSource(glbFile()),
        glbFile(),
        signal(),
      );
      const release = vi.spyOn(asset, 'dispose');
      const load = vi.fn(() => deferred.promise);
      const app = harness({ load });
      await app.actions.add('referenceBox', {
        dimensions: [1, 2, 3],
        texture: 'null',
      });
      const task = app.imports.importModelFromUrl(
        'https://models.test/late.glb',
      );
      await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
      if (operation === 'undo') app.actions.history.undo();
      else app.dispose();
      expect(await task.result).toBeNull();
      deferred.resolve(asset);
      await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
      expect(app.state.objects).toEqual([]);
      if (operation !== 'dispose') app.dispose();
    },
  );

  it('keeps a replacement cache entry alive when an older cancelled request finishes late', async () => {
    const old = Promise.withResolvers();
    const load = vi
      .fn(createImportLoader())
      .mockImplementationOnce(() => old.promise);
    const registry = createImportRegistry({ load });
    const model = glbFile();
    const source = localModelSource(model);
    const controller = new globalThis.AbortController();
    const first = registry.acquire(source, model, controller.signal);
    const rejection = expect(first).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    controller.abort();
    await rejection;
    const second = await registry.acquire(source, model, signal());
    const stale = await createImportLoader()(source, model, signal());
    const dispose = vi.spyOn(stale, 'dispose');
    old.resolve(stale);
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
    const third = await registry.acquire(source, model, signal());
    expect(load).toHaveBeenCalledTimes(2);
    expect(second.object).not.toBe(third.object);
    second.release();
    third.release();
  });
  it('shares immutable geometry and integrates selection, dimensions, transforms and undo', async () => {
    const load = vi.fn(createImportLoader());
    const { state, actions, selection, transformControls, imports, dispose } =
      harness({ load });
    await actions.add('customDesk', {
      dimensions: [60, 2, 30],
      texture: 'null',
    });
    const task = imports.importModelFromFile(gltfFile());
    expect(imports.getImportStatus(task).state).toBe('loading');
    const object = await task.result;
    const id = object.userData.objectId;
    expect(imports.getImportStatus(task)).toEqual({
      state: 'success',
      objectId: id,
    });
    expect(state.has(object)).toBe(true);
    expect(selection.pickedObject).toBe(object);
    expect(transformControls.attach).toHaveBeenLastCalledWith(object);
    const mesh = object.getObjectsByProperty('isMesh', true)[0];
    expect(findObjectRoot(mesh, new Set(state.objects))).toBe(object);
    const support = createSurfaceGeometry().prepare(object, state.objects);
    expect(support.moving.minY).toBeCloseTo(support.targets[0].height);
    expect(createObjectFootprints().read(object)).toBeTruthy();
    const initial = actions.transforms.read(object, { unit: 'cm' }).dimensions;
    expect(initial.width).toBeCloseTo(50.8);
    expect(initial.height).toBeCloseTo(12.7);
    expect(initial.depth).toBeCloseTo(25.4);
    actions.transforms.setPosition(object, { x: 6 });
    actions.transforms.setRotationDegrees(object, { y: 45 });
    actions.transforms.setScale(object, 2);
    expect(actions.transforms.read(object).dimensions.width).toBeCloseTo(40);
    const duplicate = await imports.duplicateImportedObject(id).result;
    expect(duplicate.userData.objectId).not.toBe(id);
    expect(duplicate.userData.asset.id).toBe(object.userData.asset.id);
    expect(duplicate.position.equals(object.position)).toBe(true);
    expect(duplicate.rotation.equals(object.rotation)).toBe(true);
    expect(duplicate.scale.toArray()).toEqual([2, 2, 2]);
    expect(duplicate.getObjectsByProperty('isMesh', true)[0].geometry).toBe(
      mesh.geometry,
    );
    expect(load).toHaveBeenCalledTimes(1);
    const release = vi.fn();
    mesh.geometry.addEventListener('dispose', release);
    imports.removeImportedObject(id);
    expect(state.has(object)).toBe(false);
    expect(actions.history.undo()).toBe(true);
    expect(state.has(object)).toBe(true);
    expect(actions.history.redo()).toBe(true);
    actions.reset();
    expect(release).not.toHaveBeenCalled();
    actions.history.clear();
    expect(release).toHaveBeenCalledTimes(1);
    dispose();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent URLs and releases stale loads when a reset cancels all waiters', async () => {
    const asset = await createImportLoader()(
      localModelSource(glbFile()),
      glbFile(),
      signal(),
    );
    const release = vi.spyOn(asset, 'dispose');
    const deferred = Promise.withResolvers();
    const load = vi.fn(() => deferred.promise);
    const { state, actions, imports, dispose } = harness({ load });
    const one = imports.importModelFromUrl('https://models.test/item.glb');
    const two = imports.importModelFromUrl(
      'https://models.test/item.glb#other',
    );
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(imports.cancelImport(one)).toBe(true);
    expect(await one.result).toBeNull();
    expect(load.mock.calls[0][2].aborted).toBe(false);
    actions.reset();
    expect(await two.result).toBeNull();
    expect(load.mock.calls[0][2].aborted).toBe(true);
    deferred.resolve(asset);
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(state.objects).toHaveLength(0);
    expect(imports.getImportStatus(two).state).toBe('cancelled');
    dispose();
  });
});

describe('local project integration', () => {
  it('saves one local asset for duplicate instances and no remote bytes', async () => {
    let saved;
    const storage = {
      write: vi.fn(async (_id, project) => {
        saved = globalThis.structuredClone(project);
      }),
    };
    const fetch = vi.fn(async () => new globalThis.Response(triangleGlb()));
    const app = harness({ storage, load: createImportLoader({ fetch }) });
    const local = await app.imports.importModelFromFile(glbFile(), {
      attribution: 'Fixture author',
      license: 'CC0-1.0',
    }).result;
    const duplicate = await app.imports.duplicateImportedObject(
      local.userData.objectId,
    ).result;
    await app.imports.importModelFromUrl('https://models.test/item.glb').result;
    expect(storage.write).not.toHaveBeenCalled();
    await app.projects.save('one');
    expect(saved.files.size).toBe(1);
    expect(saved.records).toHaveLength(3);
    expect(saved.files.get(local.userData.asset.id)).toBeInstanceOf(
      globalThis.Blob,
    );
    app.actions.remove(local);
    app.actions.history.clear();
    await app.projects.save('two');
    expect(saved.files.size).toBe(1);
    expect(saved.records[0].objectId).toBe(duplicate.userData.objectId);
    expect(saved.records[0].asset).toEqual(duplicate.userData.asset);
    app.dispose();
  });

  it('does not restore a delayed storage read after reset or a newer open', async () => {
    const deferred = Promise.withResolvers();
    const storage = {
      read: vi.fn(async () => ({ version: 1, records: [], files: new Map() })),
    };
    storage.read.mockReturnValueOnce(deferred.promise);
    const app = harness({ storage });
    const object = await app.imports.importModelFromFile(glbFile()).result;
    const records = [objectToRecord(object)];
    const open = app.projects.open('old');
    await vi.waitFor(() => expect(storage.read).toHaveBeenCalledOnce());
    expect((await app.projects.open('new')).restored).toBe(true);
    deferred.resolve({ version: 1, records, files: new Map() });
    expect(await open).toEqual({ restored: false });
    expect(app.state.objects).toEqual([]);
    app.dispose();
  });

  it('restores legacy setups and rejects invalid imported metadata transactionally', async () => {
    const storage = { read: vi.fn() };
    const app = harness({ storage });
    const object = await app.imports.importModelFromFile(glbFile()).result;
    for (const modify of [
      (record) => {
        record.scale[0] = 0;
      },
      (record) => {
        record.position[1] = Infinity;
      },
      (record) => {
        record.asset.format = 'obj';
      },
      (record) => {
        record.asset.license = 'x'.repeat(2049);
      },
    ]) {
      const record = objectToRecord(object);
      modify(record);
      storage.read.mockResolvedValueOnce({
        version: 1,
        records: [record],
        files: new Map(),
      });
      await expect(app.projects.open('invalid')).rejects.toThrow(
        /Invalid imported/,
      );
      expect(app.state.objects).toEqual([object]);
    }
    storage.read.mockResolvedValueOnce('[ ]');
    expect((await app.projects.open('legacy')).restored).toBe(true);
    expect(app.state.objects).toEqual([]);
    app.actions.history.undo();
    expect(app.state.objects).toEqual([object]);
    app.dispose();
  });
  it('persists bytes only on save, restores stable IDs and can relink a missing local model', async () => {
    const storage = {
      write: vi.fn(async (_id, project) => {
        saved = project;
      }),
      read: vi.fn(async () => saved),
    };
    let saved;
    const first = harness({ storage });
    const object = await first.imports.importModelFromFile(glbFile(), {
      license: 'User-supplied',
    }).result;
    const id = object.userData.objectId;
    first.actions.transforms.setScale(object, 1.5);
    expect(storage.write).not.toHaveBeenCalled();
    expect(() => first.sharing.createLink()).toThrow(/local project/);
    await first.projects.save('my setup');
    expect(saved.files.size).toBe(1);
    expect(saved.records[0].asset.license).toBe('User-supplied');
    first.dispose();

    const next = harness({ storage });
    expect((await next.projects.open('my setup')).missingAssets).toEqual([]);
    expect(next.state.objects[0].userData.objectId).toBe(id);
    expect(next.state.objects[0].scale.toArray()).toEqual([1.5, 1.5, 1.5]);
    saved.files.clear();
    const { missingAssets } = await next.projects.open('my setup');
    expect(missingAssets).toMatchObject([
      { objectId: id, message: expect.stringMatching(/missing/) },
    ]);
    expect(
      next.actions.transforms.read(next.state.objects[0]).dimensions,
    ).toBeNull();
    const restored = await next.imports.retryMissingAsset(id, glbFile()).result;
    expect(restored.userData.objectId).toBe(id);
    expect(restored.scale.toArray()).toEqual([1.5, 1.5, 1.5]);
    expect(next.imports.getMissingAssets()).toEqual([]);
    expect(next.actions.history.undo()).toBe(true);
    expect(next.imports.getMissingAssets()).toHaveLength(1);
    next.dispose();
  });

  it('surfaces a write failure and preserves current membership on a bad restore', async () => {
    const storage = {
      write: vi.fn().mockRejectedValue(new Error('Browser storage is full.')),
      read: vi.fn().mockResolvedValue({ version: 77 }),
    };
    const app = harness({ storage });
    const object = await app.imports.importModelFromFile(glbFile()).result;
    await expect(app.projects.save('desk')).rejects.toThrow(/storage is full/);
    await expect(app.projects.open('desk')).rejects.toThrow(
      /unsupported format/,
    );
    expect(app.state.objects).toEqual([object]);
    await app.sharing.restore('[ ]');
    expect(app.state.objects).toEqual([]);
    app.dispose();
  });
});
