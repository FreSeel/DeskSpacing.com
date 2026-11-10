import { expect, test } from '@playwright/test';
import { triangleGlb } from '../fixtures/importModel.js';

async function start(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => {
    window.planner = (await import('./src/main.js')).app;
    await window.planner.ready;
  });
}

async function projects(page) {
  await page.locator('#moreMenu summary').click();
  await page.locator('#moreMenu [data-bs-target="#projectsModal"]').click();
  await expect(page.locator('#projectsModal')).toBeVisible();
  return page.getByRole('dialog', { name: 'Local projects' });
}

async function save(dialog, name) {
  await dialog.getByLabel('Project name').fill(name);
  await dialog.getByRole('button', { name: 'Save project' }).click();
}

test('catalog project saves, reopens after reload, overwrites and deletes with confirmation', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    await window.planner.actions.add('defaultMouse');
    window.planner.actions.transforms.setPosition(
      window.planner.state.objects[0],
      { x: 12 },
    );
  });
  const original = await page.evaluate(() => window.planner.sharing.snapshot());
  let dialog = await projects(page);
  await expect(dialog.getByText('No local projects yet.')).toBeVisible();
  await expect(dialog).toContainText(
    'not synced to the cloud or portable backups',
  );
  await save(dialog, 'Desk one');
  await expect(dialog.getByRole('status')).toContainText('Saved Desk one');
  await expect(
    dialog.getByRole('button', { name: 'Open Desk one' }),
  ).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Close', exact: true })
    .first()
    .click();
  await page.reload();
  await page.evaluate(async () => {
    window.planner = (await import('./src/main.js')).app;
    await window.planner.ready;
    await window.planner.actions.add('defaultMouse');
  });
  const beforeOpen = await page.evaluate(() =>
    window.planner.sharing.snapshot(),
  );
  dialog = await projects(page);
  await dialog.getByRole('button', { name: 'Open Desk one' }).click();
  await expect(dialog.getByText(/replace the current setup/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(await page.evaluate(() => window.planner.sharing.snapshot())).toEqual(
    beforeOpen,
  );
  await dialog.getByRole('button', { name: 'Open Desk one' }).click();
  await dialog.getByRole('button', { name: 'Open project' }).click();
  await expect(dialog.getByRole('status')).toContainText('Opened Desk one');
  expect(await page.evaluate(() => window.planner.sharing.snapshot())).toEqual(
    original,
  );
  await page.evaluate(() => {
    window.planner.actions.transforms.setPosition(
      window.planner.state.objects[0],
      { x: 27 },
    );
  });
  const updated = await page.evaluate(() => window.planner.sharing.snapshot());
  await dialog.getByRole('button', { name: 'Save project' }).click();
  await expect(
    dialog.getByText(/previous saved version will be replaced/),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Overwrite project' }).click();
  await expect(dialog.getByRole('status')).toContainText('Saved Desk one');
  await expect(
    dialog.getByRole('button', { name: 'Save project' }),
  ).toBeFocused();
  await dialog.getByRole('button', { name: 'Delete Desk one' }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Open Desk one' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete Desk one' }).click();
  await dialog.getByRole('button', { name: 'Delete project' }).click();
  await expect(dialog.getByText('No local projects yet.')).toBeVisible();
  await expect(dialog.getByLabel('Project name')).toBeFocused();
  expect(await page.evaluate(() => window.planner.sharing.snapshot())).toEqual(
    updated,
  );
});

test('imported project reopens through UI and Share explains the local limit', async ({
  page,
}) => {
  await start(page);
  await page.locator('#saveModalButton').click();
  await expect(page.locator('#customLinkForm')).not.toHaveValue('');
  await page.locator('#saveModal [data-bs-dismiss="modal"]').first().click();
  await page.evaluate(
    async (bytes) => {
      const object = await window.planner.modelImports.importModelFromFile(
        new globalThis.File([new Uint8Array(bytes)], 'local.glb'),
      ).result;
      window.planner.actions.transforms.setPosition(object, { x: 9 });
    },
    [...new Uint8Array(triangleGlb())],
  );
  const original = await page.evaluate(() => window.planner.sharing.snapshot());
  await page.locator('#saveModalButton').click();
  const share = page.getByRole('dialog', { name: 'Share / Save your setup' });
  await expect(share.getByRole('alert')).toContainText('Imported models');
  await expect(share.getByRole('alert')).toContainText('More → Projects');
  await expect(share.locator('#customLinkForm')).toBeHidden();
  await expect(share.locator('#customLinkForm')).toHaveValue('');
  await share.getByRole('button', { name: 'Close' }).first().click();
  const dialog = await projects(page);
  await save(dialog, 'Local model');
  await expect(dialog.getByRole('status')).toContainText('Saved Local model');
  await page.reload();
  await page.evaluate(async () => {
    window.planner = (await import('./src/main.js')).app;
    await window.planner.ready;
  });
  const reopened = await projects(page);
  await reopened.getByRole('button', { name: 'Open Local model' }).click();
  await expect(reopened.getByRole('status')).toContainText(
    'Opened Local model',
  );
  expect(await page.evaluate(() => window.planner.sharing.snapshot())).toEqual(
    original,
  );
});

test('invalid data and quota failure leave the working scene and saved version intact', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    await window.planner.actions.add('defaultMouse');
  });
  const dialog = await projects(page);
  await save(dialog, 'Safe');
  await expect(dialog.getByRole('status')).toContainText('Saved Safe');
  const original = await page.evaluate(() => window.planner.sharing.snapshot());
  await page.evaluate(() => {
    window.planner.actions.transforms.setPosition(
      window.planner.state.objects[0],
      { x: 18 },
    );
    window.originalPut = globalThis.IDBObjectStore.prototype.put;
    globalThis.IDBObjectStore.prototype.put = function () {
      throw new globalThis.DOMException('Storage full', 'QuotaExceededError');
    };
  });
  const working = await page.evaluate(() => window.planner.sharing.snapshot());
  await dialog.getByRole('button', { name: 'Save project' }).click();
  await dialog.getByRole('button', { name: 'Overwrite project' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Browser storage is full',
  );
  await page.evaluate(() => {
    globalThis.IDBObjectStore.prototype.put = window.originalPut;
  });
  expect(await page.evaluate(() => window.planner.sharing.snapshot())).toEqual(
    working,
  );
  await dialog.getByRole('button', { name: 'Open Safe' }).click();
  await dialog.getByRole('button', { name: 'Open project' }).click();
  await expect(dialog.getByRole('status')).toContainText('Opened Safe');
  expect(await page.evaluate(() => window.planner.sharing.snapshot())).toEqual(
    original,
  );
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(
        'deskspacing-local-projects',
        1,
      );
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put({ version: 77 }, 'Bad');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await dialog
    .getByRole('button', { name: 'Close', exact: true })
    .first()
    .click();
  const reopened = await projects(page);
  await reopened.getByRole('button', { name: 'Open Bad' }).click();
  await reopened.getByRole('button', { name: 'Open project' }).click();
  await expect(reopened.getByRole('alert')).toContainText('unsupported format');
  expect(await page.evaluate(() => window.planner.sharing.snapshot())).toEqual(
    original,
  );
});

test('missing local assets keep placeholders and modal focus returns to More', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(
    async (bytes) => {
      await window.planner.modelImports.importModelFromFile(
        new globalThis.File([new Uint8Array(bytes)], 'missing.glb'),
      ).result;
    },
    [...new Uint8Array(triangleGlb())],
  );
  let dialog = await projects(page);
  await expect(dialog.getByLabel('Project name')).toBeFocused();
  await save(dialog, 'Missing');
  await expect(dialog.getByRole('status')).toContainText('Saved Missing');
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(
        'deskspacing-local-projects',
        1,
      );
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const get = store.get('Missing');
      get.onsuccess = () =>
        store.put({ ...get.result, files: new Map() }, 'Missing');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await dialog.getByRole('button', { name: 'Open Missing' }).click();
  await dialog.getByRole('button', { name: 'Open project' }).click();
  await expect(dialog.getByRole('status')).toContainText('Placeholder objects');
  await dialog
    .getByRole('button', { name: 'Close', exact: true })
    .first()
    .click();
  await expect(page.locator('#moreMenu summary')).toBeFocused();
  expect(
    await page.evaluate(
      () => window.planner.modelImports.getMissingAssets().length,
    ),
  ).toBe(1);
  dialog = await projects(page);
  await dialog.getByRole('button', { name: 'Open Missing' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Open project' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    dialog.getByRole('button', { name: 'Open Missing' }),
  ).toBeFocused();
  await expect(dialog).toBeVisible();
});

test('catalog-only Share still provides an active deployment URL', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => window.planner.actions.add('defaultMouse'));
  await page.locator('#saveModalButton').click();
  const share = page.getByRole('dialog', { name: 'Share / Save your setup' });
  await expect(share.locator('#customLinkForm')).toBeVisible();
  await expect(share.getByRole('alert')).toBeHidden();
  expect(await share.locator('#customLinkForm').inputValue()).toContain(
    '/DeskSpacing.com/mainApp.html?customSetup=',
  );
});

test('unavailable browser storage is explained inside Projects', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', { get: () => undefined });
  });
  await start(page);
  const dialog = await projects(page);
  await expect(dialog.getByRole('alert')).toContainText(
    'IndexedDB is unavailable in this browser',
  );
  await expect(
    dialog.getByRole('button', { name: 'Save project' }),
  ).toBeDisabled();
  await expect(dialog.getByText('No local projects yet.')).toBeHidden();
});

test('a project added while Projects is open still requires overwrite confirmation', async ({
  page,
}) => {
  await start(page);
  const dialog = await projects(page);
  await expect(dialog.getByText('No local projects yet.')).toBeVisible();
  await page.evaluate(() => window.planner.projects.save('Added later'));
  await save(dialog, 'Added later');
  await expect(
    dialog.getByText(/previous saved version will be replaced/),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(await page.evaluate(() => window.planner.projects.list())).toEqual([
    'Added later',
  ]);
});

test('Projects remains usable in a dark phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await start(page);
  const dialog = await projects(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await save(dialog, 'Phone setup');
  await expect(dialog.getByRole('status')).toContainText('Saved Phone setup');
  await expect(
    dialog.getByRole('button', { name: 'Open Phone setup' }),
  ).toBeVisible();
  const bounds = await dialog.locator('.modal-content').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(360);
  expect(bounds.height).toBeLessThanOrEqual(640);
});
