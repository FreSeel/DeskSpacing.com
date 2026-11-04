import { describe, expect, it, vi } from 'vitest';
import * as THREE from '../../src/engine.js';
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
} from '../fixtures/importModel.js';

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
