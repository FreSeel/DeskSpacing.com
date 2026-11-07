import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import {
  modelJson,
  triangleBytes,
  triangleGlb,
} from '../fixtures/importModel.js';
import { pixelPng } from '../fixtures/importTexture.js';

const modelOrigin = 'https://models.test';
const projectId = 'Imported setup';

test.beforeEach(async ({ page }) => {
  // Specific model routes below override this fallback. No real external traffic.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
});

test('imported models use grid, magnetic and surface snapping after transforms with exact history and unit toggles', async ({
  page,
}) => {
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(
    async (bytes) => {
      const { app } = await import('./src/main.js');
      await app.ready;
      await app.actions.add('customDesk', {
        dimensions: [60, 2, 30],
        texture: 'null',
      });
      const object = await app.modelImports.importModelFromFile(
        new globalThis.File([new Uint8Array(bytes)], 'snapping.glb'),
      ).result;
      app.actions.transforms.setScale(object, { x: 2, y: 1.5, z: 0.75 });
      app.actions.transforms.setRotationDegrees(object, { y: 35 });
      app.view.camera.position.set(60, 75, 45);
      app.view.controls.target.set(0, 32, -53);
      app.view.controls.update();
      app.view.invalidateScene();
    },
    [...new Uint8Array(triangleGlb())],
  );
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').check();
  await page.locator('#snapGridEnabled').check();
  await page.locator('#snapObjectsEnabled').uncheck();
  await page.locator('#snapSurfaceEnabled').uncheck();
  await page.keyboard.press('Escape');
  const grid = await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    const object = app.selection.pickedObject;
    const controls = app.view.transformControls;
    const before = app.sharing.snapshot();
    controls.setMode('translate');
    controls.axis = 'X';
    controls.dispatchEvent({ type: 'mouseDown' });
    object.position.x = 6.2;
    controls.dispatchEvent({ type: 'objectChange' });
    controls.dispatchEvent({ type: 'mouseUp' });
    const snapped = object.position.x;
    const after = app.sharing.snapshot();
    app.actions.history.undo();
    const undone = app.sharing.snapshot();
    app.actions.history.redo();
    return { snapped, before, after, undone, redone: app.sharing.snapshot() };
  });
  expect(grid.snapped).toBe(6);
  expect(grid.undone).toEqual(grid.before);
  expect(grid.redone).toEqual(grid.after);
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapGridEnabled').uncheck();
  await page.locator('#snapObjectsEnabled').check();
  await page.keyboard.press('Escape');
  const magnetic = await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    const object = app.state.objects[1];
    const target = await app.modelImports.duplicateImportedObject(
      object.userData.objectId,
    ).result;
    app.actions.transforms.setPosition(target, { x: 15, z: -35 });
    app.actions.transforms.setPosition(object, { x: 11 });
    app.selection.pick(object);
    const controls = app.view.transformControls;
    controls.axis = 'X';
    controls.dispatchEvent({ type: 'mouseDown' });
    object.position.x = 15.1;
    controls.dispatchEvent({ type: 'objectChange' });
    const label = document.getElementById('snapStatus').textContent;
    controls.dispatchEvent({ type: 'mouseUp' });
    return {
      x: object.position.x,
      label,
    };
  });
  expect(magnetic.x).toBeCloseTo(15, 5);
  expect(magnetic.label).toMatch(/align|center/i);
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapObjectsEnabled').uncheck();
  await page.locator('#snapSurfaceEnabled').check();
  await page.keyboard.press('Escape');
  const surface = await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    const object = app.state.objects[1];
    const desk = app.state.objects[0];
    function height(root, max) {
      root.updateWorldMatrix(true, true);
      const heights = [];
      root.traverse((mesh) => {
        if (!mesh.isMesh) return;
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
          heights.push(
            mesh
              .getVertexPosition(i, root.position.clone())
              .applyMatrix4(mesh.matrixWorld).y,
          );
      });
      return max ? Math.max(...heights) : Math.min(...heights);
    }
    app.actions.transforms.setRotationDegrees(object, { x: 25 });
    app.actions.transforms.setPosition(object, { x: -4 });
    const top = height(desk, true);
    app.actions.transforms.setPosition(object, {
      y: object.position.y + top + 0.4 - height(object),
    });
    app.selection.pick(object);
    const controls = app.view.transformControls;
    controls.axis = 'X';
    controls.dispatchEvent({ type: 'mouseDown' });
    object.position.x = 0.1;
    controls.dispatchEvent({ type: 'objectChange' });
    controls.dispatchEvent({ type: 'mouseUp' });
    return {
      top,
      bottom: height(object),
      records: app.sharing.snapshot(),
      dimensions: app.actions.transforms.read(object).dimensions,
    };
  });
  expect(surface.bottom).toBeCloseTo(surface.top, 5);
  expect(surface.dimensions.width).toBeCloseTo(40, 4);
  expect(surface.dimensions.height).toBeCloseTo(7.5, 4);
  expect(surface.dimensions.depth).toBeCloseTo(7.5, 4);
  for (const unit of ['CM', 'IN', 'CM', 'IN'])
    await page
      .locator('#measurementUnit')
      .getByText(unit, { exact: true })
      .click();
  expect(
    await page.evaluate(async () =>
      (await import('./src/main.js')).app.sharing.snapshot(),
    ),
  ).toEqual(surface.records);
});

test('renders imported models and restores a saved project after reload', async ({
  page,
}) => {
  const requests = [];
  let offline = false;
  const json = modelJson('data/geometry.bin');
  json.images = [{ uri: 'data/pixel.png' }];
  json.textures = [{ source: 0 }];
  json.materials = [
    { pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
  ];
  json.meshes[0].primitives[0].material = 0;
  const png = pixelPng();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== modelOrigin) return route.abort();
    requests.push(url.pathname);
    const body = {
      '/assets/object.gltf': JSON.stringify(json),
      '/assets/data/geometry.bin': Buffer.from(triangleBytes()),
      '/assets/data/pixel.png': png,
    }[url.pathname];
    return route.fulfill({
      status: offline || !body ? 404 : 200,
      headers: { 'access-control-allow-origin': '*' },
      body: offline ? '' : body,
    });
  });
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.locator('#openImport').click();
  const dialog = page.getByRole('dialog', { name: 'Import a 3D model' });
  await dialog.getByLabel('Model file').setInputFiles({
    name: 'Local object.glb',
    mimeType: 'model/gltf-binary',
    buffer: Buffer.from(triangleGlb()),
  });
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#selectionTitle')).toHaveText('Local object.glb');
  const saved = await page.evaluate(
    async ({ modelOrigin, projectId }) => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      await app.ready;
      const imported = app.selection.pickedObject;
      app.actions.transforms.setPosition(imported, { x: 7 });
      app.actions.transforms.setRotationDegrees(imported, { y: 20 });
      app.actions.transforms.setScale(imported, 1.25);
      const url = `${modelOrigin}/assets/object.gltf`;
      const first = app.modelImports.importModelFromUrl(url);
      const second = app.modelImports.importModelFromUrl(url);
      const [remote, another] = await Promise.all([
        first.result,
        second.result,
      ]);
      const mesh = remote.getObjectsByProperty('isMesh', true)[0];
      const otherMesh = another.getObjectsByProperty('isMesh', true)[0];
      const beforeSave = await app.projects.list();
      await app.projects.save(projectId);
      return {
        beforeSave,
        records: app.sharing.snapshot(),
        sharedGeometry: mesh.geometry === otherMesh.geometry,
        textureWidth: mesh.material.map.image.width,
      };
    },
    { modelOrigin, projectId },
  );
  expect(saved.beforeSave).toEqual([]);
  expect(saved.sharedGeometry).toBe(true);
  expect(saved.textureWidth).toBe(1);
  const assetPaths = [
    '/assets/object.gltf',
    '/assets/data/geometry.bin',
    '/assets/data/pixel.png',
  ];
  expect(requests).toEqual(assetPaths);

  await page.reload();
  const reopened = await page.evaluate(async (projectId) => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const opened = await app.projects.open(projectId);
    return { opened, records: app.sharing.snapshot() };
  }, projectId);
  expect(reopened).toEqual({
    opened: { restored: true, missingAssets: [] },
    records: saved.records,
  });
  expect(requests).toEqual([...assetPaths, ...assetPaths]);

  offline = true;
  await page.reload();
  const unavailable = await page.evaluate(async (projectId) => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const opened = await app.projects.open(projectId);
    app.selection.pick(app.state.objects[1]);
    return opened.missingAssets;
  }, projectId);
  expect(unavailable.map(({ objectId }) => objectId)).toEqual(
    saved.records.slice(1).map(({ objectId }) => objectId),
  );
  await expect(page.locator('#selectionVariation')).toHaveText('Missing model');
  await expect(page.locator('#selectionDescription')).toContainText('HTTP 404');

  offline = false;
  const recovered = await page.evaluate(async (objectId) => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const object = await app.modelImports.retryMissingAsset(objectId).result;
    return {
      objectId: object.userData.objectId,
      remaining: app.modelImports.getMissingAssets().length,
    };
  }, unavailable[0].objectId);
  expect(recovered).toEqual({
    objectId: unavailable[0].objectId,
    remaining: 1,
  });
});

test('failed and cancelled URL imports preserve the scene and remain retryable', async ({
  page,
}) => {
  let pending;
  await page.route('https://models.test/**', async (route) => {
    if (route.request().url().endsWith('pending.glb')) {
      pending = route;
      return;
    }
    if (route.request().url().endsWith('cors.glb'))
      return route.abort('accessdenied');
    return route.fulfill({
      body: 'not a GLB',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    await app.ready;
    await app.actions.add('referenceBox', {
      dimensions: [2, 3, 4],
      texture: 'null',
    });
  });
  const before = await page.evaluate(async () =>
    (await import('./src/main.js')).app.sharing.snapshot(),
  );
  await page.locator('#openImport').click();
  await page.getByRole('radio', { name: 'Import from URL' }).check();
  for (const [name, error] of [
    ['corrupt', 'Invalid GLB header'],
    ['cors', 'CORS'],
  ]) {
    await page.locator('#importUrl').fill(`https://models.test/${name}.glb`);
    await page.locator('#submitImport').click();
    await expect(page.locator('#importError')).toContainText(error);
    await expect(page.locator('#submitImport')).toBeEnabled();
    expect(
      await page.evaluate(async () =>
        (await import('./src/main.js')).app.sharing.snapshot(),
      ),
    ).toEqual(before);
  }
  await page.locator('#importUrl').fill('https://models.test/pending.glb');
  await page.locator('#submitImport').click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#importModal')).toBeHidden();
  await pending
    .fulfill({
      body: Buffer.from(triangleGlb()),
      headers: { 'access-control-allow-origin': '*' },
    })
    .catch(() => {});
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await import('./src/main.js')).app.modelImports.getImportStatus()
            .state,
      ),
    )
    .toBe('cancelled');
  expect(
    await page.evaluate(async () =>
      (await import('./src/main.js')).app.sharing.snapshot(),
    ),
  ).toEqual(before);
});

test('saved project deletion and quota failure preserve other saved and live asset references', async ({
  page,
}) => {
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  const result = await page.evaluate(
    async (bytes) => {
      const { app } = await import('./src/main.js');
      const object = await app.modelImports.importModelFromFile(
        new globalThis.File([new Uint8Array(bytes)], 'fixture.glb'),
      ).result;
      await app.modelImports.duplicateImportedObject(object.userData.objectId)
        .result;
      await app.projects.save('first');
      await app.projects.save('second');
      async function stored(id) {
        return new Promise((resolve, reject) => {
          const open = globalThis.indexedDB.open(
            'deskspacing-local-projects',
            1,
          );
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('projects');
            const request = tx.objectStore('projects').get(id);
            tx.oncomplete = () => {
              db.close();
              resolve(request.result);
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
          };
        });
      }
      const original = await stored('second');
      app.actions.transforms.setPosition(object, { x: 23 });
      const put = globalThis.IDBObjectStore.prototype.put;
      let failure;
      try {
        globalThis.IDBObjectStore.prototype.put = function () {
          throw new globalThis.DOMException(
            'Simulated full browser storage',
            'QuotaExceededError',
          );
        };
        await app.projects.save('second');
      } catch (error) {
        failure = error.message;
      } finally {
        globalThis.IDBObjectStore.prototype.put = put;
      }
      const unchanged =
        JSON.stringify((await stored('second')).records) ===
        JSON.stringify(original.records);
      await app.projects.delete('first');
      const deleted = (await stored('first')) === undefined;
      const files = (await stored('second')).files.size;
      const live = app.state.objects.length;
      app.actions.reset();
      app.actions.history.clear();
      const reopened = await app.projects.open('second');
      return {
        failure,
        unchanged,
        deleted,
        files,
        live,
        reopened,
        count: app.state.objects.length,
        names: await app.projects.list(),
      };
    },
    [...new Uint8Array(triangleGlb())],
  );
  expect(result).toMatchObject({
    failure: expect.stringContaining('Browser storage is full'),
    unchanged: true,
    deleted: true,
    files: 1,
    live: 2,
    reopened: { restored: true, missingAssets: [] },
    count: 2,
    names: ['second'],
  });
});

test('imported instances release GPU resources and return to idle after removal and history clearing', async ({
  page,
}) => {
  const json = modelJson('geometry.bin');
  json.images = [{ uri: 'pixel.png' }];
  json.textures = [{ source: 0 }];
  json.materials = [
    { pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
  ];
  json.meshes[0].primitives[0].material = 0;
  await page.route('https://models.test/**', (route) =>
    route.fulfill({
      body: route.request().url().endsWith('.gltf')
        ? JSON.stringify(json)
        : route.request().url().endsWith('.png')
          ? pixelPng(64, 64)
          : Buffer.from(triangleBytes()),
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  const result = await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    await app.ready;
    const { renderer, camera, controls } = app.view;
    camera.position.set(0, 30, 0);
    controls.target.set(0, 5, -57);
    controls.update();
    const rendered = () =>
      new Promise((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(resolve),
        ),
      );
    app.view.invalidateScene();
    await rendered();
    const peaks = [],
      cleaned = [];
    // The first cycle initializes lazy gizmo geometry and the engine's DFG LUT.
    // Subsequent cycles must return to that warmed baseline without growth.
    for (let i = 0; i < 6; i++) {
      const object = await app.modelImports.importModelFromUrl(
        'https://models.test/object.gltf',
      ).result;
      const duplicate = await app.modelImports.duplicateImportedObject(
        object.userData.objectId,
      ).result;
      await rendered();
      peaks.push({ ...renderer.info.memory });
      app.actions.remove(object);
      app.actions.history.clear();
      app.actions.transforms.setPosition(duplicate, { x: 3 });
      await rendered();
      app.actions.remove(duplicate);
      app.actions.history.clear();
      await rendered();
      cleaned.push({ ...renderer.info.memory });
    }
    return {
      baseline: cleaned[0],
      peaks: peaks.slice(1),
      cleaned: cleaned.slice(1),
      lost: renderer.getContext().isContextLost(),
    };
  });
  expect(result.lost).toBe(false);
  result.peaks.forEach((peak) => {
    expect(peak.geometries).toBeGreaterThan(result.baseline.geometries);
    expect(peak.textures).toBeGreaterThan(result.baseline.textures);
  });
  result.cleaned.forEach((memory) => expect(memory).toEqual(result.baseline));
  await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    const original = app.view.renderer.render.bind(app.view.renderer);
    window.importFrames = 0;
    app.view.renderer.render = (...args) => {
      window.importFrames++;
      original(...args);
    };
  });
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => window.importFrames);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.importFrames)).toBe(frames);
  const disposed = await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    app.dispose();
    return app.view.renderer.info.memory;
  });
  expect(disposed.geometries).toBe(0);
  expect(disposed.textures).toBeLessThanOrEqual(1); // engine-owned DFG LUT
});
