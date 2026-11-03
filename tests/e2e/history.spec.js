import { expect, test } from '@playwright/test';
test('history controls, shortcuts, deletion and repeated restoration preserve the live viewport', async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html');
  await page.evaluate(async () => {
    window.planner = (
      await import(new URL('./src/main.js', window.location.href))
    ).app;
    await window.planner.ready;
  });
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await page.locator('#moreMenu summary').click();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await page.evaluate(async () => {
    const { actions, view, selection } = window.planner;
    window.historyObject = await actions.add('referenceBox', {
      dimensions: [3, 4, 5],
    });
    selection.pick(window.historyObject);
    view.camera.position.set(100, 100, 100);
    view.controls.update();
    window.savedView = [
      view.scene,
      view.camera,
      view.renderer,
      document.querySelector('canvas'),
    ];
  });
  const snapshot = () =>
    page.evaluate(() => {
      const { view } = window.planner;
      return {
        camera: view.camera.position.toArray(),
        rotation: view.camera.quaternion.toArray(),
        target: view.controls.target.toArray(),
        canvas: document
          .querySelector('canvas')
          .getBoundingClientRect()
          .toJSON(),
      };
    });
  await page.waitForTimeout(300);
  const before = await snapshot();
  await page.locator('#threeCanvas').focus();
  await page.keyboard.press('Delete');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press(i === 0 ? 'Meta+z' : 'Control+z');
    expect(
      await page.evaluate(() => window.planner.state.has(window.historyObject)),
    ).toBe(true);
    await page.keyboard.press(
      i === 0 ? 'Meta+Shift+z' : i === 1 ? 'Control+Shift+z' : 'Control+y',
    );
    expect(
      await page.evaluate(() => window.planner.state.has(window.historyObject)),
    ).toBe(false);
  }
  const after = await snapshot();
  expect(after.canvas).toEqual(before.canvas);
  for (const key of ['camera', 'rotation', 'target'])
    after[key].forEach((value, index) =>
      expect(value).toBeCloseTo(before[key][index], 10),
    );
  expect(
    await page.evaluate(() => {
      const { view } = window.planner;
      return [
        view.scene,
        view.camera,
        view.renderer,
        document.querySelector('canvas'),
      ].every((value, i) => value === window.savedView[i]);
    }),
  ).toBe(true);
  if (!(await page.locator('#moreMenu').evaluate((menu) => menu.open)))
    await page.locator('#moreMenu summary').click();
  await undo.click();
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(redo).toBeDisabled();
  await page.locator('#catalogSearch').fill('desk');
  await page.keyboard.press('Control+z');
  expect(
    await page.evaluate(() => window.planner.state.has(window.historyObject)),
  ).toBe(false);
});
