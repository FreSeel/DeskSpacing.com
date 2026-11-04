import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

async function start(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.route('**/src/main.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `
      import { bindImportDialog } from './ui/importDialog.js';
      import { bindEditorShell } from './ui/editorShell.js';
      import { createFeedback } from './ui/feedback.js';
      const mock = window.importMock = { calls: [], cancellations: 0 };
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
      bindEditorShell({ document, host: window, transformControls: new EventTarget() });
      bindImportDialog({
        document,
        feedback: createFeedback(document),
        close: (modal) => window.bootstrap.Modal.getInstance(modal).hide(),
        modelImports: {
          importModelFromFile: (file) => start('file', file.name),
          importModelFromUrl: (url) => start('url', url),
          getImportStatus: (task) => task,
          cancelImport(task) {
            mock.cancellations++;
            task.resolve(null);
          },
        },
      });
    `,
    }),
  );
  await page.goto('mainApp.html');
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
