import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

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
  });
}

const snapshot = (page) =>
  page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    return app.sharing.snapshot();
  });

test('compact spacing controls retain readable text and touch targets', async ({
  page,
}, testInfo) => {
  await start(page);
  const referenceId = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const reference = app.state.objects[0];
    await app.actions.add('referenceBox', { dimensions: [6, 4, 5] });
    return reference.uuid;
  });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.editor-shell')).toHaveAttribute(
      'data-layout',
      width < 768 ? 'phone' : 'tablet',
    );
    const toggle = page.locator('#toggleSelectionPanel');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true')
      await toggle.click();
    await page.locator('#selectionSpacingReference').selectOption(referenceId);
    await page.locator('#selectionSpacingApply').click();
    await expect(page.locator('#selectionSpacingMeasured')).toHaveText('10 cm');
    for (const id of [
      'selectionSpacingReference',
      'selectionSpacingDirection',
      'selectionSpacingClearance',
    ]) {
      const control = page.locator(`#${id}`);
      await expect(control).toHaveCSS('font-size', '16px');
      const bounds = await control.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({
      path: testInfo.outputPath(`spacing-${width}.png`),
    });
  }
});

test('all rotation axes accept common, negative and arbitrary degrees and invalid edits preserve the scene', async ({
  page,
}) => {
  await start(page);
  for (const [index, axis] of ['X', 'Y', 'Z'].entries()) {
    const input = page.locator(`#selectionRotation${axis}`);
    for (const angle of [45, 90, 180, -90, 23.456789, -360.125, 0]) {
      await input.fill(String(angle));
      await input.press('Enter');
      expect((await snapshot(page))[0].rotation[index]).toBe(
        angle * (Math.PI / 180),
      );
      expect(Number(await input.inputValue())).toBeCloseTo(angle, 11);
    }
  }
  const before = await snapshot(page);
  for (const [id, text] of [
    ['selectionPositionX', '1e100'],
    ['selectionRotationY', 'Infinity'],
    ['selectionRotationZ', '-'],
    ['selectionDimensionsWidth', '0'],
    ['selectionDimensionsHeight', '-1'],
    ['selectionDimensionsDepth', '1e100'],
  ]) {
    const input = page.locator(`#${id}`);
    await input.fill(text);
    await input.press('Enter');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(await snapshot(page)).toEqual(before);
    await input.press('Escape');
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  }
});

test('10 cm placement works on six world directions for rotated scaled objects and refreshes measured dimensions', async ({
  page,
}, testInfo) => {
  await start(page);
  const referenceId = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const reference = app.state.objects[0];
    reference.position.set(10.25, 8, -4.125);
    reference.rotation.set(0.15, -0.35, 0.2);
    reference.scale.set(1.2, 0.8, 1.4);
    const object = await app.actions.add('referenceBox', {
      dimensions: [6, 2, 4],
    });
    object.position.set(-8, 10, -2);
    object.rotation.set(0.2, 0.5, -0.3);
    object.scale.set(1.25, 0.75, 1.5);
    app.view.invalidateScene();
    return reference.uuid;
  });
  await page.locator('#selectionSpacingReference').selectOption(referenceId);
  await page.locator('#selectionSpacingClearance').fill('10');
  for (const [dimension, expected] of [
    ['Width', 6 * 1.25 * 2.54],
    ['Height', 2 * 0.75 * 2.54],
    ['Depth', 4 * 1.5 * 2.54],
  ]) {
    const input = page.locator(`#selectionDimensions${dimension}`);
    await expect(input).toHaveAttribute('readonly', '');
    expect(Number(await input.inputValue())).toBeCloseTo(expected, 6);
  }
  const evidence = [];
  for (const direction of ['x+', 'x-', 'y+', 'y-', 'z+', 'z-']) {
    const before = await snapshot(page);
    await page.locator('#selectionSpacingDirection').selectOption(direction);
    await page.locator('#selectionSpacingApply').click();
    const actual = await page.evaluate(async (direction) => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      const [reference, object] = app.state.objects;
      const axis = direction[0];
      const sign = direction[1] === '+' ? 1 : -1;
      // Independently measure this fixture's actual single-box mesh bounds.
      const boxes = [object, reference].map((root) => {
        root.updateWorldMatrix(true, true);
        const mesh = root.children[0];
        mesh.geometry.computeBoundingBox();
        return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      });
      const gap =
        sign === 1
          ? boxes[0].min[axis] - boxes[1].max[axis]
          : boxes[1].min[axis] - boxes[0].max[axis];
      return {
        direction,
        geometryGapCm: gap * 2.54,
        measuredCm: app.actions.spacing.measure(object, reference, {
          axis,
          direction: sign,
          unit: 'cm',
        }).clearance,
        scale: object.scale.toArray(),
      };
    }, direction);
    evidence.push(actual);
    expect(Math.abs(actual.geometryGapCm - 10)).toBeLessThanOrEqual(1e-8);
    expect(Math.abs(actual.measuredCm - 10)).toBeLessThanOrEqual(1e-8);
    expect(actual.scale).toEqual([1.25, 0.75, 1.5]);
    const after = await snapshot(page);
    expect(after[1].rotation).toEqual(before[1].rotation);
    expect(after[1].dimensions).toEqual(before[1].dimensions);
    for (const [index, axis] of ['x', 'y', 'z'].entries()) {
      if (axis !== direction[0])
        expect(after[1].position[index]).toBe(before[1].position[index]);
      expect(
        Number(
          await page
            .locator(`#selectionPosition${axis.toUpperCase()}`)
            .inputValue(),
        ),
      ).toBeCloseTo(after[1].position[index] * 2.54, 6);
    }
    await expect(page.locator('#selectionSpacingMeasured')).toHaveText('10 cm');
  }
  const evidencePath = testInfo.outputPath('clearance-evidence.json');
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  await testInfo.attach('ten-centimeter-clearance-evidence', {
    path: evidencePath,
    contentType: 'application/json',
  });
});
