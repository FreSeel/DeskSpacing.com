import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import {
  modelJson,
  triangleBytes,
  triangleGlb,
} from '../fixtures/importModel.js';

const modelOrigin = 'https://models.test';
const projectId = 'Imported setup';
const modelBytes = [...triangleGlb()];

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
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP438DwHwAGgAJ/EEwb4QAAAABJRU5ErkJggg==',
    'base64',
  );
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
  const saved = await page.evaluate(
    async ({ modelBytes, modelOrigin, projectId }) => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      await app.ready;
      const local = new window.File(
        [Uint8Array.from(modelBytes)],
        'Local object.glb',
      );
      const imported = await app.modelImports.importModelFromFile(local).result;
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
    { modelBytes, modelOrigin, projectId },
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
