import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

async function start(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.ready;
    // Mock only the service boundary, keeping the production UI bundle intact.
    const mock = (window.importMock = { calls: [], cancellations: 0 });
    function start(method, value) {
      mock.calls.push([method, value]);
      const { promise, resolve, reject } = Promise.withResolvers();
      const task = { result: promise, resolve, reject, state: 'loading' };
      mock.task = task;
      mock.fail = (message) => {
        Object.assign(task, { state: 'failure', message });
        reject(new Error(message));
      };
      mock.succeed = () => {
        task.state = 'success';
        resolve({});
      };
      return task;
    }
    Object.assign(app.modelImports, {
      importModelFromFile: (file) => start('file', file.name),
      importModelFromUrl: (url) => start('url', url),
      getImportStatus: (task) => task,
      cancelImport(task) {
        mock.cancellations++;
        task.resolve(null);
      },
    });
  });
}

const dialog = (page) =>
  page.getByRole('dialog', { name: 'Import a 3D model' });
const submit = (page) =>
  dialog(page).getByRole('button', { name: 'Import', exact: true });
const upload = (page) => dialog(page).getByLabel('Model file');
const fixture = (name) => ({
  name,
  mimeType: 'application/octet-stream',
  buffer: Buffer.from('model'),
});

for (const theme of ['light', 'dark']) {
  test(`import controls fit and remain keyboard accessible in ${theme} on desktop and phone`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await start(page);
    for (const width of [1280, 375, 320]) {
      await page.setViewportSize({ width, height: 640 });
      if (width < 768) await page.locator('#openLibrary').click();
      const trigger = page.locator('#openImport');
      await expect(trigger).toBeVisible();
      const bounds = await trigger.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await trigger.click();
      await expect(upload(page)).toBeFocused();
      await upload(page).setInputFiles(fixture('review.glb'));
      await submit(page).focus();
      await page.keyboard.press('Tab');
      await expect(
        dialog(page).getByRole('button', { name: 'Close' }),
      ).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(submit(page)).toBeFocused();
      const buttons = await submit(page).boundingBox();
      expect(buttons.x + buttons.width).toBeLessThanOrEqual(width);
      expect(buttons.y + buttons.height).toBeLessThanOrEqual(640);
      await page.screenshot({
        path: testInfo.outputPath(`import-${theme}-${width}.png`),
      });
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toBeHidden();
    }
  });
}

test('opens with focus, switches methods, validates and replaces files', async ({
  page,
}) => {
  await start(page);
  await page.locator('#openImport').click();
  await expect(upload(page)).toBeFocused();
  await expect(submit(page)).toBeDisabled();
  await upload(page).setInputFiles(fixture('wrong.obj'));
  await expect(dialog(page).getByRole('alert')).toContainText(
    'self-contained .gltf',
  );
  await expect(submit(page)).toBeDisabled();
  await upload(page).setInputFiles(fixture('first.glb'));
  await expect(dialog(page).getByText(/first.glb ·/)).toBeVisible();
  await upload(page).setInputFiles(fixture('replacement.gltf'));
  await expect(dialog(page).getByText(/replacement.gltf ·/)).toBeVisible();
  await expect(submit(page)).toBeEnabled();
  await dialog(page).getByRole('radio', { name: 'Import from URL' }).check();
  const url = dialog(page).getByRole('textbox', { name: 'Direct model URL' });
  await expect(url).toBeVisible();
  await url.fill('https://sketchfab.com/models/example');
  await expect(url).toHaveAttribute('aria-invalid', 'true');
  await expect(submit(page)).toBeDisabled();
  await url.fill('https://assets.example/model.glb?version=1');
  await expect(submit(page)).toBeEnabled();
  await dialog(page).getByRole('radio', { name: 'Upload file' }).check();
  await expect(dialog(page).getByText(/replacement.gltf ·/)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Clear file' }).click();
  await expect(upload(page)).toBeFocused();
  await expect(submit(page)).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('#openImport')).toBeFocused();
});

test('keeps the source on failure, prevents double submit and closes on success', async ({
  page,
}) => {
  await start(page);
  await page.locator('#openImport').click();
  await dialog(page).getByRole('radio', { name: 'Import from URL' }).check();
  const url = dialog(page).getByRole('textbox', { name: 'Direct model URL' });
  await url.fill('https://assets.example/model.glb');
  await submit(page).click();
  await expect(dialog(page).getByText('Importing model…')).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  await expect(url).toBeDisabled();
  await page.locator('#importForm').dispatchEvent('submit');
  expect(await page.evaluate(() => window.importMock.calls)).toEqual([
    ['url', 'https://assets.example/model.glb'],
  ]);
  await page.evaluate(() =>
    window.importMock.fail('Check server CORS settings.'),
  );
  await expect(dialog(page).getByRole('alert')).toHaveText(
    'Check server CORS settings.',
  );
  await expect(url).toHaveValue('https://assets.example/model.glb');
  await submit(page).click();
  await page.evaluate(() => window.importMock.succeed());
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText('Model imported and selected.')).toBeVisible();
  await expect(page.locator('#openImport')).toBeFocused();
});

test('cancels a pending upload with Escape and returns focus on a dark phone layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await start(page);
  const objects = page.locator('#openLibrary');
  await objects.click();
  await page.locator('#openImport').click();
  await expect(upload(page)).toBeFocused();
  await upload(page).setInputFiles(fixture('phone.glb'));
  await submit(page).click();
  await expect(
    dialog(page).getByRole('button', { name: 'Cancel' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dialog(page).getByRole('button', { name: 'Close' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(objects).toBeFocused();
  expect(await page.evaluate(() => window.importMock.cancellations)).toBe(1);
  expect(await page.evaluate(() => window.importMock.calls)).toEqual([
    ['file', 'phone.glb'],
  ]);
  await objects.click();
  await page.locator('#openImport').click();
  await expect(submit(page)).toBeDisabled();
});
