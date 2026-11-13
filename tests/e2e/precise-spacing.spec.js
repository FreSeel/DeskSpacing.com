import { expect, test } from '@playwright/test';

async function start(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  const referenceId = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.ready;
    const reference = await app.actions.add('referenceBox', {
      dimensions: [4, 6, 8],
    });
    reference.position.set(3.25, 8, -12);
    const object = await app.actions.add('referenceBox', {
      dimensions: [2, 3, 5],
    });
    object.position.set(-10, 20.5, -30.25);
    app.view.invalidateScene();
    return reference.uuid;
  });
  await page.locator('#selectionSpacingReference').selectOption(referenceId);
  await page
    .locator('#measurementUnit')
    .getByText('CM', { exact: true })
    .click();
  return referenceId;
}
const snapshot = (page) =>
  page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    return app.sharing.snapshot();
  });

test('places an exact bounds clearance with snapping on, updating coordinates, history and saved positions', async ({
  page,
}) => {
  await start(page);
  const before = await snapshot(page);
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').check();
  await page.locator('#snapMenu summary').click();
  const clearance = page.locator('#selectionSpacingClearance');
  await clearance.fill('10.123456789');
  await page.locator('#selectionSpacingApply').click();
  const placed = await snapshot(page);
  const target = 3.25 + 2 + 10.123456789 / 2.54 + 1;
  expect(placed[1].position).toEqual([target, 20.5, -30.25]);
  expect(placed[1].rotation).toEqual(before[1].rotation);
  expect(placed[1].dimensions).toEqual(before[1].dimensions);
  await expect(page.locator('#selectionSpacingMeasured')).toHaveText(
    '10.123457 cm',
  );
  await expect(page.locator('#selectionPositionX')).toHaveValue(
    String(Number((target * 2.54).toFixed(6))),
  );
  await page.locator('#selectionSpacingApply').click();
  expect(await snapshot(page)).toEqual(placed);
  await page.locator('#moreMenu summary').click();
  await page.locator('#undoTransform').click();
  expect(await snapshot(page)).toEqual(before);
  // Object creation belongs to the same history as placement. Undoing the
  // placement must leave the earlier add available, not empty the history.
  await expect(page.locator('#undoTransform')).toBeEnabled();
  await page.locator('#undoTransform').click();
  expect(await snapshot(page)).toEqual([before[0]]);
  await page.locator('#redoTransform').click();
  expect(await snapshot(page)).toHaveLength(2);
  await page.locator('#redoTransform').click();
  expect(await snapshot(page)).toEqual(placed);
  await page.locator('#saveModalButton').click();
  await page.goto(await page.locator('#customLinkForm').inputValue());
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.ready;
    app.selection.pick(app.state.objects[1]);
  });
  expect(await snapshot(page)).toEqual(placed);
  await expect(page.locator('#selectionSpacingReference')).toHaveValue('');
});

test('keeps drafts intact and rejects invalid input or a missing reference without moving', async ({
  page,
}) => {
  await start(page);
  const before = await snapshot(page);
  const clearance = page.locator('#selectionSpacingClearance');
  for (const text of ['', '-', '-5', 'Infinity', '1e']) {
    await clearance.fill(text);
    await clearance.press('Enter');
    await expect(clearance).toHaveValue(text);
    await expect(clearance).toHaveAttribute('aria-invalid', 'true');
    expect(await snapshot(page)).toEqual(before);
  }
  await clearance.press('Escape');
  await expect(clearance).toHaveValue('10');
  await clearance.fill('12.');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.state.objects[0].position.x += 1;
    app.view.invalidateScene();
  });
  await expect(page.locator('#selectionSpacingMeasured')).toHaveText(
    '-43.815 cm',
  );
  await expect(clearance).toHaveValue('12.');
  expect((await snapshot(page))[1]).toEqual(before[1]);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.actions.remove(app.state.objects[0]);
  });
  await expect(page.locator('#selectionSpacingApply')).toBeDisabled();
  await expect(page.locator('#selectionSpacingStatus')).toContainText(
    'reference object is unavailable',
  );
  await clearance.press('Enter');
  expect((await snapshot(page))[0]).toEqual(before[1]);
});

test('measures live edits, applies negative directions with Enter, and resets when selection changes', async ({
  page,
}) => {
  await start(page);
  await page.locator('#selectionSpacingDirection').selectOption('z-');
  const clearance = page.locator('#selectionSpacingClearance');
  await clearance.fill('5.125');
  await clearance.press('Enter');
  const placed = await snapshot(page);
  expect(placed[1].position[2]).toBeCloseTo(-12 - 4 - 5.125 / 2.54 - 2.5, 12);
  expect(placed[1].position.slice(0, 2)).toEqual([-10, 20.5]);
  await expect(page.locator('#selectionSpacingMeasured')).toHaveText(
    '5.125 cm',
  );
  await page.locator('#selectionDimensionsDepth').fill('25.4');
  await page.locator('#selectionDimensionsDepth').press('Enter');
  await expect(page.locator('#selectionSpacingMeasured')).toHaveText(
    '-1.225 cm',
  );
  await expect(clearance).toHaveValue('5.125');
  await expect(page.locator('#selectionSpacingStatus')).toContainText(
    'not separated in this direction',
  );
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.selection.pick(app.state.objects[0]);
  });
  await expect(page.locator('#selectionSpacingReference')).toHaveValue('');
  await expect(page.locator('#selectionSpacingMeasured')).toHaveText('—');
  await expect(page.locator('#selectionSpacingDirection')).toHaveValue('x+');
  await expect(clearance).toHaveValue('10');
});

test('spacing follows the global unit and cancels unfinished drafts without drift', async ({
  page,
}) => {
  await start(page);
  const before = await snapshot(page);
  const unit = page.locator('#measurementUnit');
  const clearance = page.locator('#selectionSpacingClearance');
  await unit.getByText('IN', { exact: true }).click();
  await expect(page.getByLabel('Clearance (in)')).toBeVisible();
  await expect(clearance).toHaveValue(String(10 / 2.54));
  await clearance.fill('-');
  await unit.getByText('CM', { exact: true }).click();
  await expect(clearance).toHaveValue('10');
  await expect(page.locator('#selectionSpacingStatus')).toContainText(
    'cancelled',
  );
  expect(await snapshot(page)).toEqual(before);
  await unit.getByText('IN', { exact: true }).click();
  await clearance.fill('2.5');
  await clearance.press('Enter');
  await expect(page.locator('#selectionSpacingMeasured')).toHaveText('2.5 in');
  const placed = await snapshot(page);
  expect(placed[1].position[0]).toBe(3.25 + 2 + 2.5 + 1);
  await unit.getByText('CM', { exact: true }).click();
  await expect(page.locator('#selectionSpacingMeasured')).toHaveText('6.35 cm');
  await unit.getByText('IN', { exact: true }).click();
  await page.locator('#selectionSpacingApply').click();
  expect(await snapshot(page)).toEqual(placed);
});
