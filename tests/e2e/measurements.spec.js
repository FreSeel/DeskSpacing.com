import { expect, test } from '@playwright/test';

async function start(page, url = 'mainApp.html') {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto(url);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.ready;
  });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#threeCanvas')).toHaveAttribute(
    'aria-busy',
    'false',
  );
}

async function snapshot(page) {
  return page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    return app.sharing.snapshot();
  });
}

async function options(page, id, category) {
  await page.locator('#catalogCategory').selectOption(category);
  const button = page.locator(`[data-options="${id}"]`);
  if ((await button.getAttribute('aria-expanded')) !== 'true')
    await button.click();
}

test('converts all inputs and annotations without scene or draft drift; persists the preference', async ({
  page,
}) => {
  await start(page);
  const unit = page.getByRole('radiogroup', { name: 'Measurement unit' });
  await expect(
    unit.getByRole('radio', { name: 'Inches', exact: true }),
  ).toBeChecked();
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.selection.pick(
      app.state.objects.find(
        (object) => object.userData.objectName === 'small16x9Monitor28',
      ),
    );
  });
  const before = await snapshot(page);
  await options(page, 'referenceBox', 'shapes');
  await page.locator('#referenceBoxL').fill('39.37007874015748');
  for (let i = 0; i < 10; i++) {
    await unit.getByText('CM', { exact: true }).click();
    await expect(page.locator('#referenceBoxL')).toHaveValue('100');
    await unit.getByText('IN', { exact: true }).click();
    await expect(page.locator('#referenceBoxL')).toHaveValue('39.37');
  }
  await unit.getByText('CM', { exact: true }).click();
  await expect(page.locator('#customDeskW')).toHaveValue('2.54');
  await expect(page.locator('#referenceSphereRadius')).toHaveValue('2.54');
  await expect(page.locator('#referenceBoxL')).toHaveAttribute('max', '25400');
  await expect(page.locator('#referenceBoxL')).toHaveAttribute('step', 'any');
  await expect(page.locator('label[for="referenceBoxL"]')).toContainText(
    '(cm)',
  );
  await expect(page.locator('#small16x9MonitorForm option').first()).toHaveText(
    '55.88 cm',
  );
  await expect(page.locator('#small16x9MonitorForm')).toHaveValue('22');
  await expect(page.locator('#selectionVariation')).toContainText('71.12 cm');
  expect(await snapshot(page)).toEqual(before);
  await page
    .locator('[data-product="referenceBox"]:not([data-replace])')
    .click();
  await expect
    .poll(async () => (await snapshot(page)).length)
    .toBe(before.length + 1);
  expect((await snapshot(page)).at(-1).dimensions[0]).toBe(39.37007874015748);
  await page.reload();
  await expect(unit.getByRole('radio', { name: 'Centimeters' })).toBeChecked();
  await expect(page.locator('#referenceBoxL')).toHaveValue('2.54');
});

test('unit selector fits the toolbar and remains usable with disabled storage', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage disabled');
      },
    });
  });
  await start(page, 'mainApp.html?customSetup=%5B%20%5D');
  const unit = page.getByRole('radiogroup', { name: 'Measurement unit' });
  await expect(
    unit.getByRole('radio', { name: 'Inches', exact: true }),
  ).toBeChecked();
  await unit.getByText('CM', { exact: true }).click();
  await expect(page.locator('#customDeskL')).toHaveValue('2.54');
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(resolve),
          ),
        ),
    );
    const header = await page.locator('.editor-header').boundingBox();
    for (const control of [unit, page.locator('#saveModalButton')]) {
      const bounds = await control.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        header.y + header.height,
      );
    }
    await page.screenshot({ path: testInfo.outputPath(`units-${width}.png`) });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await unit.screenshot({ path: testInfo.outputPath('toggle-dark.png') });
});

test('creates and replaces custom shapes in both units, verifies actual bounds, and restores existing links', async ({
  page,
}) => {
  await start(page, 'mainApp.html?customSetup=%5B%20%5D');
  const unit = page.locator('#measurementUnit');
  await unit.getByText('CM', { exact: true }).click();
  await options(page, 'referenceBox', 'shapes');
  for (const [axis, value] of [
    ['L', '30'],
    ['W', '20'],
    ['H', '10'],
  ])
    await page.locator(`#referenceBox${axis}`).fill(value);
  await page
    .locator('[data-product="referenceBox"]:not([data-replace])')
    .click();
  await expect.poll(async () => (await snapshot(page)).length).toBe(1);
  const box = (await snapshot(page))[0];
  expect(box.dimensions).toEqual([30 / 2.54, 20 / 2.54, 10 / 2.54]);
  const bounds = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const object = app.state.objects[0];
    const mesh = object.children[0];
    object.updateMatrixWorld(true);
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox
      .clone()
      .applyMatrix4(mesh.matrixWorld)
      .getSize(object.position.clone());
    object.position.x = 12;
    object.rotation.y = 0.4;
    app.view.invalidateScene();
    return size.toArray();
  });
  bounds.forEach((value, index) =>
    expect(value * 2.54).toBeCloseTo([30, 20, 10][index], 4),
  );
  const moved = await snapshot(page);
  await unit.getByText('IN', { exact: true }).click();
  expect(await snapshot(page)).toEqual(moved);
  await page.locator('#referenceBoxL').fill('12');
  await page.locator('[data-product="referenceBox"][data-replace]').click();
  await expect
    .poll(async () => (await snapshot(page))[0].dimensions[0])
    .toBe(12);
  expect((await snapshot(page))[0].position[0]).toBe(12);
  await unit.getByText('CM', { exact: true }).click();
  await options(page, 'referenceSphere', 'shapes');
  await page.locator('#referenceSphereRadius').fill('10');
  await page
    .locator('[data-product="referenceSphere"]:not([data-replace])')
    .click();
  await expect.poll(async () => (await snapshot(page)).length).toBe(2);
  expect((await snapshot(page))[1].dimensions).toEqual([10 / 2.54, -1, -1]);
  const saved = await snapshot(page);
  const link = await page.evaluate(async () =>
    (
      await import(new URL('./src/main.js', window.location.href))
    ).app.sharing.createLink(),
  );
  await start(page, link);
  expect(await snapshot(page)).toEqual(saved);
  await expect(unit.getByRole('radio', { name: 'Centimeters' })).toBeChecked();
});

test('custom desk dimensions, validation, empty drafts and native keyboard selection follow units', async ({
  page,
}) => {
  await start(page, 'mainApp.html?customSetup=%5B%20%5D');
  const unit = page.locator('#measurementUnit');
  const inches = unit.getByRole('radio', { name: 'Inches', exact: true });
  await inches.focus();
  await expect(inches).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(unit.getByRole('radio', { name: 'Centimeters' })).toBeFocused();
  await expect(unit.getByRole('radio', { name: 'Centimeters' })).toBeChecked();
  await options(page, 'customDesk', 'desks');
  await page.locator('#customDeskL').fill('100');
  await page.locator('#customDeskW').fill('50');
  await page.locator('[data-product="customDesk"]').click();
  await expect.poll(async () => (await snapshot(page)).length).toBe(1);
  expect((await snapshot(page))[0].dimensions).toEqual([
    100 / 2.54,
    1,
    50 / 2.54,
  ]);
  await page.locator('#customDeskL').fill('25400.01');
  await page.locator('[data-product="customDesk"]').click();
  await expect(page.locator('#customDeskError')).toContainText('25400 cm');
  await unit.getByText('IN', { exact: true }).click();
  await expect(page.locator('#customDeskError')).toContainText('10000 in');
  // Rounding an out-of-bounds draft must not make it valid.
  await page.locator('[data-product="customDesk"]').click();
  await expect(page.locator('#customDeskError')).toBeVisible();
  await page.locator('#customDeskL').fill('');
  await unit.getByText('CM', { exact: true }).click();
  await expect(page.locator('#customDeskL')).toHaveValue('');
  await page.locator('[data-product="customDesk"]').click();
  expect((await snapshot(page))[0].dimensions[0]).toBe(100 / 2.54);
  await page.locator('#customDeskL').fill('120');
  await page.locator('[data-product="customDesk"]').click();
  await expect
    .poll(async () => (await snapshot(page))[0].dimensions[0])
    .toBe(120 / 2.54);
});
