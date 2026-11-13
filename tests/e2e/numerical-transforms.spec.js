import { expect, test } from '@playwright/test';

async function start(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.ready;
    await app.actions.add('referenceBox', { dimensions: [3, 4, 5] });
    app.actions.history.clear();
  });
  await expect(page.locator('#selectionNumericalTransforms')).toBeVisible();
  await page
    .locator('#measurementUnit')
    .getByText('CM', { exact: true })
    .click();
}

const snapshot = (page) =>
  page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    return app.sharing.snapshot();
  });

test('commits precise cm and degree fields with Enter and blur, then restores undo/redo and saved values', async ({
  page,
}) => {
  await start(page);
  const x = page.locator('#selectionPositionX');
  const rotation = page.locator('#selectionRotationY');
  const width = page.locator('#selectionDimensionsWidth');
  await x.fill('-12.123456789');
  await x.press('Enter');
  await page.locator('#selectionPositionY').fill('80.987654321');
  await page.locator('#selectionPositionY').press('Tab');
  await page.locator('#selectionPositionZ').fill('-125.5');
  await page.locator('#selectionPositionZ').press('Enter');
  await rotation.fill('-23.456789');
  await rotation.press('Tab');
  await width.fill('30.123456789');
  await width.press('Enter');
  await width.press('Tab');
  const edited = await snapshot(page);
  expect(edited[0].position[0]).toBe(-12.123456789 / 2.54);
  expect(edited[0].position[1]).toBe(80.987654321 / 2.54);
  expect(edited[0].position[2]).toBe(-125.5 / 2.54);
  expect(edited[0].rotation[1]).toBe(-23.456789 * (Math.PI / 180));
  expect(edited[0].dimensions).toEqual([30.123456789 / 2.54, 4, 5]);
  await page.locator('#moreMenu summary').click();
  await page.locator('#undoTransform').click();
  expect((await snapshot(page))[0].dimensions).toEqual([3, 4, 5]);
  await expect(width).toHaveValue('7.62');
  await page.locator('#redoTransform').click();
  expect(await snapshot(page)).toEqual(edited);
  await page.locator('#saveModalButton').click();
  const link = await page.locator('#customLinkForm').inputValue();
  await page.goto(link);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.ready;
    app.selection.pick(app.state.objects[0]);
  });
  expect(await snapshot(page)).toEqual(edited);
  await expect(width).toHaveValue('30.123457');
});

test('preserves partial text through unrelated renders and cancels invalid drafts without scene edits', async ({
  page,
}) => {
  await start(page);
  const x = page.locator('#selectionPositionX');
  const before = await snapshot(page);
  await x.fill('-');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.view.camera.position.x += 1;
    app.view.invalidate();
    for (let i = 0; i < 3; i++)
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
  await expect(x).toHaveValue('-');
  expect(await x.evaluate((input) => input.selectionStart)).toBe(1);
  await x.press('Enter');
  await expect(x).toHaveAttribute('aria-invalid', 'true');
  expect(await snapshot(page)).toEqual(before);
  await x.press('Escape');
  await expect(x).toHaveValue('0');
  await expect(x).toBeFocused();
  await x.fill('');
  await x.press('Tab');
  await expect(x).toHaveValue('0');
  await expect(page.locator('#selectionTransformStatus')).toContainText(
    'Edit not applied',
  );
  expect(await snapshot(page)).toEqual(before);
  await expect(page.locator('#undoTransform')).toBeDisabled();
});

test('focus, blur, and unit changes do not round stored values', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.actions.transforms.setPosition(app.selection.pickedObject, {
      x: 1.2345678912345,
    });
  });
  const before = await snapshot(page);
  const x = page.locator('#selectionPositionX');
  await expect(x).toHaveValue('3.135802');
  await x.focus();
  await expect(x).toHaveValue('3.135802');
  await x.press('Tab');
  for (const unit of ['CM', 'IN', 'CM', 'IN'])
    await page
      .locator('#measurementUnit')
      .getByText(unit, { exact: true })
      .click();
  await expect(x).toHaveAttribute('aria-label', 'Position X (in)');
  await expect(x).toHaveValue('1.234568');
  expect(await snapshot(page)).toEqual(before);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.actions.transforms.undo();
  });
  expect((await snapshot(page))[0].position[0]).toBe(0);
});

test('unit switching cancels drafts, preserves canonical values and edits inches', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    app.actions.transforms.setPosition(app.selection.pickedObject, {
      x: 1.2345678912345,
    });
  });
  const before = await snapshot(page);
  const x = page.locator('#selectionPositionX');
  const width = page.locator('#selectionDimensionsWidth');
  const unit = page.locator('#measurementUnit');
  await expect(x).toHaveValue('3.135802');
  for (const value of ['IN', 'CM', 'IN'])
    await unit.getByText(value, { exact: true }).click();
  expect(await snapshot(page)).toEqual(before);
  await expect(x).toHaveAttribute('aria-label', 'Position X (in)');
  await expect(width).toHaveValue('3');
  await expect(page.locator('#selectionRotationY')).toHaveAttribute(
    'aria-label',
    'Rotation Y (°)',
  );
  await x.fill('-');
  await unit.getByText('CM', { exact: true }).click();
  await expect(page.locator('#selectionTransformStatus')).toContainText(
    'cancelled',
  );
  expect(await snapshot(page)).toEqual(before);
  await x.fill('25.4');
  await unit.getByText('IN', { exact: true }).click();
  expect(await snapshot(page)).toEqual(before);
  await x.fill('-');
  await x.press('Escape');
  expect(await snapshot(page)).toEqual(before);
  await x.fill('2');
  await expect(x).toHaveValue('2');
  await x.press('Enter');
  expect((await snapshot(page))[0].position[0]).toBe(2);
  await width.fill('4');
  await width.press('Tab');
  expect((await snapshot(page))[0].dimensions[0]).toBe(4);
  await page.evaluate(async () =>
    (await import('./src/main.js')).app.actions.transforms.undo(),
  );
  expect((await snapshot(page))[0].dimensions[0]).toBe(3);
});

test('updates native rotation and geometry readouts and rejects stale drafts on the same field', async ({
  page,
}) => {
  await start(page);
  const x = page.locator('#selectionPositionX');
  await x.fill('123');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const object = app.selection.pickedObject;
    object.position.x = 10;
    object.rotation.y = Math.PI / 4;
    app.view.invalidateScene();
  });
  await expect(page.locator('#selectionRotationY')).toHaveValue('45');
  await expect(x).toHaveValue('123');
  await x.press('Enter');
  await expect(x).toHaveValue('25.4');
  expect((await snapshot(page))[0].position[0]).toBe(10);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.actions.transforms.setDimensions(
      app.selection.pickedObject,
      { width: 20 },
      { unit: 'cm' },
    );
  });
  await expect(page.locator('#selectionDimensionsWidth')).toHaveValue('20');
  await x.fill('-');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.actions.add('referenceBox', { dimensions: [6, 7, 8] });
  });
  await expect(x).toHaveValue('0');
  await expect(page.locator('#selectionDimensionsWidth')).toHaveValue('15.24');
  // The same focused DOM field must edit the newly selected object.
  await x.fill('5');
  await x.press('Enter');
  const records = await snapshot(page);
  expect(records[0].position[0]).toBe(10);
  expect(records[1].position[0]).toBe(5 / 2.54);
});

test('shows fixed dimensions and locks, with a uniform diameter editor for spheres', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.actions.add('customDesk', {
      dimensions: [50, 1, 20],
      texture: 'null',
    });
  });
  await expect(page.locator('#selectionPositionX')).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(page.locator('#selectionRotationY')).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(page.locator('#selectionDimensionsHeight')).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(page.locator('#selectionDimensionsHeight')).toHaveValue('2.54');
  await expect(page.locator('#selectionDimensionsWidth')).toBeEditable();
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.actions.add('defaultMouse');
  });
  for (const axis of ['Width', 'Height', 'Depth'])
    await expect(page.locator(`#selectionDimensions${axis}`)).toHaveAttribute(
      'readonly',
      '',
    );
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.actions.add('referenceSphere', { dimensions: [2, -1, -1] });
  });
  const diameter = page.locator('#selectionDimensionsDiameter');
  await diameter.fill('20');
  await diameter.press('Enter');
  for (const axis of ['Width', 'Height', 'Depth'])
    await expect(page.locator(`#selectionDimensions${axis}`)).toHaveValue('20');
  expect((await snapshot(page)).at(-1).dimensions).toEqual([
    20 / 2.54 / 2,
    -1,
    -1,
  ]);
});

test('Escape cancels a draft without closing the compact inspector sheet', async ({
  page,
}) => {
  await start(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#toggleSelectionPanel').click();
  const x = page.locator('#selectionPositionX');
  await x.fill('-123.5');
  await x.press('Escape');
  await expect(page.locator('#selectionPanel')).toHaveAttribute(
    'aria-modal',
    'true',
  );
  await expect(x).toHaveValue('0');
  await expect(x).toBeFocused();
  expect((await snapshot(page))[0].position[0]).toBe(0);
});
