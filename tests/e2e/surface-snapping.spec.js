import { expect, test } from '@playwright/test';

async function appCall(page, operation, value) {
  return page.evaluate(
    async ({ operation, value }) => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      await app.ready;
      const source = app.state.objects.find(
        (object) => object.userData.objectName === 'referenceBox',
      );
      if (operation === 'snapshot') return app.sharing.snapshot();
      if (operation === 'axis') return app.view.transformControls.axis;
      if (operation === 'link') return app.sharing.createLink();
      if (operation === 'dispose') {
        app.dispose();
        return;
      }
      if (operation === 'fixture') {
        const desk = await app.actions.add('customDesk', {
          dimensions: [12, 2, 8],
          texture: 'null',
        });
        const source = await app.actions.add('referenceBox', {
          dimensions: [2, 4, 2],
        });
        const peer = await app.actions.add('referenceBox', {
          dimensions: [2, 4, 2],
        });
        desk.position.set(0, 9, 0);
        source.position.set(-8, 12.4, 0);
        peer.position.set(2.25, 12, 5);
        app.selection.pick(source);
        app.view.camera.position.set(24, 42, 50);
        app.view.controls.target.set(0, 10, 2);
        app.view.controls.update();
        app.view.invalidateScene();
      }
      if (operation === 'project') {
        app.view.camera.updateMatrixWorld();
        const point = source.position.clone();
        point.x += value;
        point.project(app.view.camera);
        const rect = app.view.renderer.domElement.getBoundingClientRect();
        return {
          x: rect.x + ((point.x + 1) * rect.width) / 2,
          y: rect.y + ((1 - point.y) * rect.height) / 2,
        };
      }
      if (operation === 'reset') {
        source.position.set(-8, 12.4, 0);
        app.selection.pick(source);
        app.view.invalidateScene();
      }
      if (operation === 'moveSupport') {
        const before = source.position.toArray();
        app.state.objects[0].position.y += 2;
        app.view.invalidateScene();
        return { before, after: source.position.toArray() };
      }
      if (operation === 'catalog') {
        const desk = await app.actions.add(value);
        desk.updateWorldMatrix(true, true);
        const min = { x: Infinity, z: Infinity },
          max = { x: -Infinity, y: -Infinity, z: -Infinity };
        desk.traverse((mesh) => {
          if (!mesh.isMesh) return;
          for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            const point = mesh
              .getVertexPosition(i, source.position.clone())
              .applyMatrix4(mesh.matrixWorld);
            for (const axis of ['x', 'z'])
              min[axis] = Math.min(min[axis], point[axis]);
            for (const axis of ['x', 'y', 'z'])
              max[axis] = Math.max(max[axis], point[axis]);
          }
        });
        // Probe real rendered triangles independently of the snapping resolver.
        // The native control's public raycaster provides the existing Three type
        // without importing unbundled source files from the production site.
        const controls = app.view.transformControls;
        const raycaster = new (controls.getRaycaster().constructor)();
        let contact;

        for (const x of [0.25, 0.5, 0.75])
          for (const z of [0.25, 0.5, 0.75]) {
            raycaster.set(
              source.position
                .clone()
                .set(
                  min.x + (max.x - min.x) * x,
                  max.y + 10,
                  min.z + (max.z - min.z) * z,
                ),
              source.position.clone().set(0, -1, 0),
            );
            const hit = raycaster.intersectObject(desk, true)[0];

            if (hit && Math.abs(hit.point.y - max.y) < 0.01)
              contact = hit.point;
          }
        if (!contact) return { product: value, found: false, max };
        source.position.set(contact.x - 3, contact.y + 2.4, contact.z);
        app.selection.pick(source);
        controls.setMode('translate');
        controls.axis = 'X';
        controls.dispatchEvent({ type: 'mouseDown' });
        source.position.x = contact.x;
        controls.dispatchEvent({ type: 'objectChange' });
        const found = document
          .getElementById('snapStatus')
          .textContent.includes('Surface contact');
        controls.dispatchEvent({ type: 'mouseUp' });
        app.view.invalidateScene();
        return {
          product: value,
          found,
          height: contact.y,
          bottom: source.position.y - 2,
          area: (max.x - min.x) * (max.z - min.z),
        };
      }
    },
    { operation, value },
  );
}
async function start(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await appCall(page, 'fixture');
  await expect(page.locator('#selectionPanel')).toBeVisible();
}
async function enable(page, all = false) {
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').check();
  await page.locator('#snapGridEnabled').setChecked(all);
  await page.locator('#snapObjectsEnabled').setChecked(all);
  await page.locator('#snapSurfaceEnabled').check();
  await page.keyboard.press('Escape');
}
async function drag(page, desiredX) {
  const current = (await appCall(page, 'snapshot')).find(
    (r) => r.product === 'referenceBox',
  ).position[0];
  for (const offset of [3, 4, 5, 6, 8, 2]) {
    const start = await appCall(page, 'project', offset);
    await page.mouse.move(start.x, start.y);
    if ((await appCall(page, 'axis')) !== 'X') continue;
    const end = await appCall(page, 'project', offset + desiredX - current);
    const outside = await appCall(page, 'project', offset + 9.2 - current);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 18 });
    return { end, outside };
  }
  throw new Error('Could not find native X handle');
}
const sourceRecord = (records) =>
  records.find((r) => r.product === 'referenceBox');

test('surface contact cooperates with magnetic/grid native dragging and exact history, units and reload', async ({
  page,
}, testInfo) => {
  await start(page);
  await enable(page, true);
  const before = await appCall(page, 'snapshot');
  await drag(page, 2.35);
  const after = await appCall(page, 'snapshot');
  expect(sourceRecord(after).position).toEqual([2.25, 12, 0]);
  expect(sourceRecord(after).rotation).toEqual(sourceRecord(before).rotation);
  expect(sourceRecord(after).dimensions).toEqual(
    sourceRecord(before).dimensions,
  );
  await expect(page.locator('#snapStatus')).toHaveText(
    'Surface contact · Centers aligned',
  );
  await expect(page.locator('.surface-contact')).not.toHaveAttribute('d', '');
  await expect(page.locator('#snappingGuides')).toHaveCSS(
    'pointer-events',
    'none',
  );
  await expect(page.locator('#dimensionAnnotations')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('surface-and-magnetic.png'),
  });
  await page.mouse.up();
  await expect(page.locator('#snappingGuides')).toBeHidden();
  await page.keyboard.press('Control+z');
  expect(await appCall(page, 'snapshot')).toEqual(before);
  await page.keyboard.press('Control+Shift+z');
  expect(await appCall(page, 'snapshot')).toEqual(after);
  await page
    .locator('#measurementUnit')
    .getByText('CM', { exact: true })
    .click();
  expect(await appCall(page, 'snapshot')).toEqual(after);
  const link = await appCall(page, 'link');
  await page.goto(link);
  expect(await appCall(page, 'snapshot')).toEqual(after);
  await page.locator('#snapMenu summary').click();
  for (const id of [
    'snapEnabled',
    'snapGridEnabled',
    'snapObjectsEnabled',
    'snapSurfaceEnabled',
  ])
    await expect(page.locator(`#${id}`)).toBeChecked();
  await page.setViewportSize({ width: 375, height: 800 });
  await page.screenshot({
    path: testInfo.outputPath('surface-settings-phone.png'),
  });
  const movement = await appCall(page, 'moveSupport');
  expect(movement.after).toEqual(movement.before);
});

test('surface edge release and temporary bypass preserve height; cancellation and disposal clear indicators', async ({
  page,
}, testInfo) => {
  await start(page);
  await enable(page);
  const { end, outside } = await drag(page, 2.35);
  expect(sourceRecord(await appCall(page, 'snapshot')).position[1]).toBe(12);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: testInfo.outputPath('surface-contact-dark.png'),
  });
  await page.keyboard.down('Alt');
  await expect(page.locator('#snappingGuides')).toBeHidden();
  await page.mouse.move(end.x + 1, end.y);
  expect(sourceRecord(await appCall(page, 'snapshot')).position[1]).toBeCloseTo(
    12,
    10,
  );
  await page.keyboard.up('Alt');
  await page.mouse.move(end.x, end.y);
  await expect(page.locator('#snappingGuides')).toBeVisible();
  await page.mouse.move(outside.x, outside.y, { steps: 18 });
  await expect(page.locator('#snappingGuides')).toBeHidden();
  const released = sourceRecord(await appCall(page, 'snapshot')).position;
  // The native perspective drag plane follows the acquired height. Verify
  // free movement beyond the edge, not a fixed screen-to-world X conversion.
  expect(released[0]).toBeGreaterThan(6);
  expect(released[1]).toBeCloseTo(12, 10);
  await page.mouse.move(end.x, end.y, { steps: 18 });
  await expect(page.locator('#snappingGuides')).toBeVisible();
  await page
    .locator('#threeCanvas')
    .dispatchEvent('pointercancel', { pointerId: 1 });
  await expect(page.locator('#snappingGuides')).toBeHidden();
  await page.mouse.up();
  const frames = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await new Promise((done) => window.setTimeout(done, 150));
    const a = app.view.renderer.info.render.frame;
    await new Promise((done) => window.setTimeout(done, 150));
    return [a, app.view.renderer.info.render.frame];
  });
  expect(frames[1]).toBe(frames[0]);
  await appCall(page, 'dispose');
  await expect(page.locator('#snappingGuides')).toHaveCount(0);
});

test('surface and master toggles each preserve ordinary free placement when disabled', async ({
  page,
}) => {
  await start(page);
  await enable(page);
  for (const id of ['snapSurfaceEnabled', 'snapEnabled']) {
    await appCall(page, 'reset');
    await page.locator('#snapMenu summary').click();
    await page.locator('#snapSurfaceEnabled').check();
    await page.locator('#snapEnabled').check();
    await page.locator(`#${id}`).uncheck();
    await page.keyboard.press('Escape');
    await drag(page, 2.35);
    const position = sourceRecord(await appCall(page, 'snapshot')).position;
    expect(position[0]).toBeCloseTo(2.35, 4);
    expect(position[1]).toBeCloseTo(12.4, 10);
    await expect(page.locator('#snappingGuides')).toBeHidden();
    await page.mouse.up();
  }
});

test('surface recognition works with authored imported desk families and both concave tabletops', async ({
  page,
}) => {
  await start(page);
  await enable(page);
  for (const product of [
    'modernDesk',
    'standingDesk',
    'linnmonDesk39',
    'alexDesk61',
    'bekantLShapedLeft',
    'bekantLShapedRight',
  ]) {
    const result = await appCall(page, 'catalog', product);
    expect(result.found, JSON.stringify(result)).toBe(true);
    expect(result.height, product).toBeGreaterThan(20);
    expect(result.height, product).toBeLessThan(45);
    expect(result.area, product).toBeGreaterThan(400);
    // Exported near-coplanar tabletop vertices use a 0.01-inch tolerance.
    expect(Math.abs(result.bottom - result.height), product).toBeLessThan(0.01);
  }
});
