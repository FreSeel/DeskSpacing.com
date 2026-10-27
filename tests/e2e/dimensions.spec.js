import { expect, test } from '@playwright/test';

async function start(page, url = 'mainApp.html?customSetup=%5B%20%5D') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto(url);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.ready;
    await document.fonts.ready;
  });
}

const label = (page, axis) => page.locator(`[data-dimension="${axis}"]`);
async function labels(page, values, unit = 'cm') {
  for (const [axis, prefix, index] of [
    ['x', 'W', 0],
    ['y', 'H', 1],
    ['z', 'D', 2],
  ]) {
    await expect(label(page, axis)).toBeVisible();
    await expect(label(page, axis)).toHaveText(
      `${prefix}: ${values[index]} ${unit}`,
    );
  }
}

// Independent world bounds at the product's initial authored orientation. Used
// to frame real assets and compare displayed physical dimensions with vertices.
async function frameSelection(page) {
  return page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const object = app.selection.pickedObject;
    object.updateWorldMatrix(true, true);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const point = object.position.clone();
    object.traverse((mesh) => {
      if (!mesh.isMesh) return;
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
        point.toArray().forEach((value, axis) => {
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        });
      }
    });
    const size = max.map((value, axis) => value - min[axis]);
    const center = min.map((value, axis) => (value + max[axis]) / 2);
    const distance = Math.max(...size) * 1.8 + 8;
    app.view.controls.target.fromArray(center);
    app.view.camera.position
      .fromArray(center)
      .add(point.set(distance * 0.8, distance * 0.6, distance));
    app.view.controls.update();
    app.view.invalidate();
    // Selection can resize the workspace; wait for camera/ResizeObserver and
    // the existing demand renderer before reading projected positions.
    for (let i = 0; i < 3; i++)
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    return size;
  });
}

async function chooseUnit(page, unit) {
  await page
    .locator('#measurementUnit')
    .getByText(unit.toUpperCase(), { exact: true })
    .click();
}

test('complete cm-to-inch edit flow preserves untouched precision through save, reload and duplicate creation', async ({
  page,
}) => {
  await start(page);
  await chooseUnit(page, 'cm');
  await page.locator('#catalogCategory').selectOption('shapes');
  await page.locator('[data-options="referenceBox"]').click();
  for (const [axis, value] of [
    ['L', '30'],
    ['W', '20'],
    ['H', '10'],
  ])
    await page.locator(`#referenceBox${axis}`).fill(value);
  await page
    .locator('[data-product="referenceBox"]:not([data-replace])')
    .click();
  await frameSelection(page);
  await labels(page, [30, 20, 10]);
  await chooseUnit(page, 'in');
  await labels(page, [11.81, 7.87, 3.94], 'in');
  await expect(page.locator('#referenceBoxW')).toHaveValue('7.87');
  await page.locator('#referenceBoxL').fill('12');
  await page.locator('[data-product="referenceBox"][data-replace]').click();
  await labels(page, [12, 7.87, 3.94], 'in');
  await chooseUnit(page, 'cm');
  await labels(page, [30.48, 20, 10]);
  await expect(page.locator('#referenceBoxL')).toHaveValue('30.48');
  await expect(page.locator('#referenceBoxW')).toHaveValue('20');
  await expect(page.locator('#referenceBoxH')).toHaveValue('10');
  for (let i = 0; i < 5; i++) {
    await chooseUnit(page, 'in');
    await chooseUnit(page, 'cm');
  }
  await page
    .locator('[data-product="referenceBox"]:not([data-replace])')
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await import(new URL('./src/main.js', window.location.href))).app
            .state.objects.length,
      ),
    )
    .toBe(2);
  await page.locator('#saveModalButton').click();
  const link = await page.locator('#customLinkForm').inputValue();
  const saved = await page.evaluate(async () =>
    (
      await import(new URL('./src/main.js', window.location.href))
    ).app.sharing.snapshot(),
  );
  expect(saved.map((record) => record.dimensions)).toEqual([
    [12, 20 / 2.54, 10 / 2.54],
    [12, 20 / 2.54, 10 / 2.54],
  ]);
  await start(page, link);
  await expect(page.getByRole('radio', { name: 'Centimeters' })).toBeChecked();
  expect(
    await page.evaluate(async () =>
      (
        await import(new URL('./src/main.js', window.location.href))
      ).app.sharing.snapshot(),
    ),
  ).toEqual(saved);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.selection.pick(app.state.objects[1]);
    app.actions.remove(app.state.objects[0]);
  });
  await frameSelection(page);
  await labels(page, [30.48, 20, 10]);
});

test('Dimensions toggle hides lines and labels across selection and unit changes, with keyboard support', async ({
  page,
}, testInfo) => {
  await start(page);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.actions.add('referenceSphere', { dimensions: [5, -1, -1] });
  });
  await frameSelection(page);
  const toggle = page.getByRole('button', { name: 'Dimensions', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await labels(page, [10, 10, 10], 'in');
  const before = await page.evaluate(async () =>
    (
      await import(new URL('./src/main.js', window.location.href))
    ).app.sharing.createLink(),
  );
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dimensionAnnotations')).toBeHidden();
  expect(
    await page.evaluate(async () =>
      (
        await import(new URL('./src/main.js', window.location.href))
      ).app.sharing.createLink(),
    ),
  ).toBe(before);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.selection.unselectPickedObject();
    await app.actions.add('referenceBox', { dimensions: [10, 8, 6] });
  });
  await frameSelection(page);
  await chooseUnit(page, 'cm');
  await expect(page.locator('#dimensionAnnotations')).toBeHidden();
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await labels(page, [25.4, 20.32, 15.24]);
  await page.keyboard.press('Enter');
  await expect(page.locator('#dimensionAnnotations')).toBeHidden();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(toggle).toBeVisible();
    const bounds = await toggle.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    const reset = await page.locator('#resetCameraButton').boundingBox();
    expect(bounds.y + bounds.height).toBeLessThan(reset.y);
    await page.screenshot({
      path: testInfo.outputPath(`dimensions-toggle-${width}.png`),
    });
  }
});

test('custom inputs produce accurate W/D/H; units, movement, rotation and resizing follow live geometry', async ({
  page,
}, testInfo) => {
  await start(page);
  await chooseUnit(page, 'cm');
  await page.locator('#catalogCategory').selectOption('shapes');
  await page.locator('[data-options="referenceBox"]').click();
  for (const [axis, value] of [
    ['L', '30'],
    ['W', '20'],
    ['H', '10'],
  ])
    await page.locator(`#referenceBox${axis}`).fill(value);
  await page
    .locator('[data-product="referenceBox"]:not([data-replace])')
    .click();
  await expect(page.locator('#selectionTitle')).toHaveText('Box');
  await frameSelection(page);
  await labels(page, [30, 20, 10]);
  await page.screenshot({ path: testInfo.outputPath('custom-box-cm.png') });
  const before = await page.evaluate(async () =>
    (
      await import(new URL('./src/main.js', window.location.href))
    ).app.sharing.createLink(),
  );
  const path = await page
    .locator('.dimension-annotations path')
    .first()
    .getAttribute('d');
  await chooseUnit(page, 'in');
  await labels(page, [11.81, 7.87, 3.94], 'in');
  expect(
    await page.evaluate(async () =>
      (
        await import(new URL('./src/main.js', window.location.href))
      ).app.sharing.createLink(),
    ),
  ).toBe(before);
  await chooseUnit(page, 'cm');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const object = app.selection.pickedObject;
    object.position.x += 2;
    object.rotation.set(0.2, 0.7, 0.1);
    app.view.transformControls.dispatchEvent({ type: 'objectChange' });
  });
  await labels(page, [30, 20, 10]);
  await expect(
    page.locator('.dimension-annotations path').first(),
  ).not.toHaveAttribute('d', path);
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.selection.pickedObject.children[0].geometry.scale(2, 1, 1);
    app.view.invalidateScene();
  });
  await labels(page, [60, 20, 10]);
  await page.locator('#referenceBoxL').fill('40');
  await page.locator('[data-product="referenceBox"][data-replace]').click();
  await labels(page, [40, 20, 10]);
});

test('predefined geometry, authored orientation and imported scale produce reliable dimensions', async ({
  page,
}, testInfo) => {
  await start(page);
  await chooseUnit(page, 'cm');
  for (const product of [
    'modernDesk',
    'small16x9Monitor28',
    'defaultMouse',
    'deskSpacingSpeakerPrimary',
    'appleStudioDisplay',
  ]) {
    await page.evaluate(async (product) => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      app.actions.reset();
      await app.actions.add(product);
    }, product);
    const size = await frameSelection(page);
    const expected = size.map((inches) => Number((inches * 2.54).toFixed(2)));
    await labels(page, expected);
    await page.screenshot({ path: testInfo.outputPath(`${product}.png`) });
    await page.evaluate(async () => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      app.selection.pickedObject.rotation.y += 0.5;
      app.view.invalidateScene();
    });
    await labels(page, expected);
  }
});

test('annotations do not intercept selection or camera controls; deletion, restore and disposal clear stale labels', async ({
  page,
}, testInfo) => {
  await start(page);
  await chooseUnit(page, 'cm');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.actions.add('referenceSphere', { dimensions: [5, -1, -1] });
  });
  await frameSelection(page);
  await labels(page, [25.4, 25.4, 25.4]);
  await page.screenshot({ path: testInfo.outputPath('sphere.png') });
  const link = await page.evaluate(async () =>
    (
      await import(new URL('./src/main.js', window.location.href))
    ).app.sharing.createLink(),
  );
  const clickPoint = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const point = app.selection.pickedObject.position
      .clone()
      .project(app.view.camera);
    const rect = app.view.renderer.domElement.getBoundingClientRect();
    app.selection.unselectPickedObject();
    return {
      x: rect.x + ((point.x + 1) * rect.width) / 2,
      y: rect.y + ((1 - point.y) * rect.height) / 2,
    };
  });
  await expect(page.locator('.dimension-annotations')).toBeHidden();
  await page.mouse.click(clickPoint.x, clickPoint.y);
  await labels(page, [25.4, 25.4, 25.4]);
  const bounds = await label(page, 'x').boundingBox();
  expect(
    await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).id, {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    }),
  ).toBe('threeCanvas');
  const before = await page.evaluate(async () =>
    (
      await import(new URL('./src/main.js', window.location.href))
    ).app.view.camera.position.toArray(),
  );
  await page.mouse.move(bounds.x, bounds.y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 40, bounds.y + 15, { steps: 6 });
  await page.mouse.up();
  expect(
    await page.evaluate(async () =>
      (
        await import(new URL('./src/main.js', window.location.href))
      ).app.view.camera.position.toArray(),
    ),
  ).not.toEqual(before);
  await page.locator('#threeCanvas').focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.dimension-annotations')).toBeHidden();
  await start(page, link);
  await expect(page.locator('.dimension-annotations')).toBeHidden();
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.selection.pick(app.state.objects[0]);
  });
  await frameSelection(page);
  await labels(page, [25.4, 25.4, 25.4]);
  // Existing demand-renderer must settle with annotations visible.
  await page.waitForTimeout(750);
  const frames = await page.evaluate(
    async () =>
      (await import(new URL('./src/main.js', window.location.href))).app.view
        .renderer.info.render.frame,
  );
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(
      async () =>
        (await import(new URL('./src/main.js', window.location.href))).app.view
          .renderer.info.render.frame,
    ),
  ).toBe(frames);
  await page.evaluate(async () =>
    (
      await import(new URL('./src/main.js', window.location.href))
    ).app.dispose(),
  );
  await expect(page.locator('.dimension-annotations')).toHaveCount(0);
});

test('custom desks show tabletop thickness and retain their movement lock on creation and pointer selection', async ({
  page,
}, testInfo) => {
  await start(page);
  await chooseUnit(page, 'cm');
  await page.locator('#catalogCategory').selectOption('desks');
  await page.locator('[data-options="customDesk"]').click();
  await page.locator('#customDeskL').fill('100');
  await page.locator('#customDeskW').fill('50');
  await page.locator('[data-product="customDesk"]').click();
  await expect(page.locator('#selectionTitle')).toHaveText('Custom Desk');
  await frameSelection(page);
  await labels(page, [100, 2.54, 50]);
  const point = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const point = app.selection.pickedObject.position
      .clone()
      .project(app.view.camera);
    const rect = app.view.renderer.domElement.getBoundingClientRect();
    app.selection.unselectPickedObject();
    return {
      x: rect.x + ((point.x + 1) * rect.width) / 2,
      y: rect.y + ((1 - point.y) * rect.height) / 2,
    };
  });
  await page.mouse.click(point.x, point.y);
  await labels(page, [100, 2.54, 50]);
  expect(
    await page.evaluate(async () =>
      Boolean(
        (await import(new URL('./src/main.js', window.location.href))).app.view
          .transformControls.object,
      ),
    ),
  ).toBe(false);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: testInfo.outputPath('custom-desk-dark.png') });
});
