import { expect, test } from '@playwright/test';

async function appCall(page, operation, value) {
  return page.evaluate(
    async ({ operation, value }) => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      await app.ready;
      const source = app.state.objects[0];
      if (operation === 'snapshot') return app.sharing.snapshot();
      if (operation === 'axis') return app.view.transformControls.axis;
      if (operation === 'rotate') {
        source.rotation.y = 0.47;
        app.state.objects[1].rotation.y = -0.22;
        app.view.invalidateScene();
      }
      if (operation === 'camera') {
        app.view.camera.position.set(...value);
        app.view.controls.target.set(0, 1, 3);
        app.view.controls.update();
        app.view.invalidate();
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
      if (operation === 'resetSource') {
        source.position.set(-8, 1, 0);
        app.selection.pick(source);
        app.view.invalidateScene();
      }
      if (operation === 'fixture') {
        const source = await app.actions.add('referenceBox', {
          dimensions: [4, 2, 2],
        });
        const target = await app.actions.add('referenceBox', {
          dimensions: [8, 2, 4],
        });
        source.position.set(-8, 1, 0);
        target.position.set(4, 1, 6);
        if (value)
          for (let i = 0; i < value; i++) {
            const item = await app.actions.add('referenceBox', {
              dimensions: [2, 2, 2],
            });
            item.position.set(25 + (i % 8) * 5, 1, -15 + Math.floor(i / 8) * 5);
          }
        app.selection.pick(source);
        app.view.invalidateScene();
      }
      if (operation === 'stats')
        return {
          geometries: app.view.renderer.info.memory.geometries,
          objects: app.state.objects.length,
          frames: app.view.renderer.info.render.frame,
        };
      if (operation === 'link') return app.sharing.createLink();
      if (operation === 'deselect') app.selection.unselectPickedObject();
      if (operation === 'dispose') app.dispose();
    },
    { operation, value },
  );
}
async function start(page, count = 0) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await appCall(page, 'fixture', count);
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await appCall(page, 'camera', [24, 35, 50]);
}
async function enable(page, grid = false) {
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').check();
  await page.locator('#snapGridEnabled').setChecked(grid);
  await page.locator('#snapObjectsEnabled').check();
  await page.keyboard.press('Escape');
}
async function drag(page, desiredX) {
  const current = (await appCall(page, 'snapshot'))[0].position[0];
  for (const offset of [3, 4, 5, 6, 8, 2]) {
    const point = await appCall(page, 'project', offset);
    await page.mouse.move(point.x, point.y);
    if ((await appCall(page, 'axis')) !== 'X') continue;
    const end = await appCall(page, 'project', offset + desiredX - current);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 15 });
    return { end, offset };
  }
  throw new Error('Could not find the native X translation handle');
}

test('magnetic edge guides follow native dragging, preserve dimensions and produce one undoable saved move', async ({
  page,
}, testInfo) => {
  await start(page);
  await enable(page, true);
  const before = await appCall(page, 'snapshot');
  await drag(page, 2.15);
  const after = await appCall(page, 'snapshot');
  expect(after[0].position[0]).toBeCloseTo(2, 8);
  expect(after[0].position.slice(1)).toEqual(before[0].position.slice(1));
  expect(after[0].rotation).toEqual(before[0].rotation);
  expect(after[0].dimensions).toEqual(before[0].dimensions);
  await expect(page.locator('#snappingGuides')).toBeVisible();
  await expect(page.locator('#snappingGuides')).toHaveCSS(
    'pointer-events',
    'none',
  );
  await expect(page.locator('#snapStatus')).toHaveText('Edges aligned');
  expect(
    await page.locator('#snappingGuides path[d]:not([d=""])').count(),
  ).toBeGreaterThan(0);
  await expect(page.locator('#dimensionAnnotations')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('magnetic-edges.png') });
  await page.mouse.up();
  await expect(page.locator('#snappingGuides')).toBeHidden();
  await page.keyboard.press('Control+z');
  expect(await appCall(page, 'snapshot')).toEqual(before);
  await page.keyboard.press('Control+Shift+z');
  expect(await appCall(page, 'snapshot')).toEqual(after);
  const link = await appCall(page, 'link');
  await page.goto(link);
  await expect(page.locator('#threeCanvas')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  expect(await appCall(page, 'snapshot')).toEqual(after);
});

test('magnetic center alignment handles rotated objects and a second camera view; bypass and release remove guides', async ({
  page,
}, testInfo) => {
  await start(page);
  await enable(page);
  await appCall(page, 'rotate');
  await appCall(page, 'camera', [-24, 45, 50]);
  const before = await appCall(page, 'snapshot');
  const { end } = await drag(page, 4.15);
  expect((await appCall(page, 'snapshot'))[0].position[0]).toBeCloseTo(4, 8);
  await expect(page.locator('#snapStatus')).toHaveText('Centers aligned');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.screenshot({
    path: testInfo.outputPath('magnetic-centers-dark.png'),
  });
  await page.keyboard.down('Alt');
  await expect(page.locator('#snappingGuides')).toBeHidden();
  await page.mouse.move(end.x + 1, end.y);
  expect((await appCall(page, 'snapshot'))[0].position[0]).not.toBe(4);
  await page.keyboard.up('Alt');
  await page.mouse.move(end.x, end.y);
  expect((await appCall(page, 'snapshot'))[0].position[0]).toBeCloseTo(4, 8);
  await expect(page.locator('#snappingGuides')).toBeVisible();
  await page
    .locator('#threeCanvas')
    .dispatchEvent('pointercancel', { pointerId: 1 });
  await expect(page.locator('#snappingGuides')).toBeHidden();
  await page.mouse.up();
  expect((await appCall(page, 'snapshot'))[0].rotation).toEqual(
    before[0].rotation,
  );
  await page.keyboard.press('Control+z');
  expect(await appCall(page, 'snapshot')).toEqual(before);
});

test('magnetic preferences preserve grid spacing and allow master, grid and object modes independently', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('deskspacing.snapping'))
      window.localStorage.setItem(
        'deskspacing.snapping',
        JSON.stringify({ enabled: true, grid: { spacing: 0.5 } }),
      );
  });
  await start(page);
  await page.locator('#snapMenu summary').click();
  await expect(page.locator('#snapEnabled')).toBeChecked();
  await expect(page.locator('#snapGridEnabled')).toBeChecked();
  await expect(page.locator('#snapObjectsEnabled')).not.toBeChecked();
  await expect(page.locator('#snapSpacing')).toHaveValue('0.5');
  await page.locator('#snapGridEnabled').uncheck();
  await page.locator('#snapObjectsEnabled').check();
  await page.locator('#snapEnabled').uncheck();
  await page.reload();
  await page.locator('#snapMenu summary').click();
  await expect(page.locator('#snapEnabled')).not.toBeChecked();
  await expect(page.locator('#snapGridEnabled')).not.toBeChecked();
  await expect(page.locator('#snapObjectsEnabled')).toBeChecked();
  await expect(page.locator('#snapSpacing')).toHaveValue('0.5');
  await page.locator('#snapEnabled').check();
  await page.setViewportSize({ width: 375, height: 800 });
  await page.screenshot({
    path: testInfo.outputPath('magnetic-settings-phone.png'),
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#snapMenu summary')).toBeFocused();
});

test('magnetic dragging in a 50-object scene reuses guides and geometry, releases targets and returns to idle', async ({
  page,
}) => {
  await start(page, 48);
  await enable(page);
  const initial = await appCall(page, 'stats');
  expect(initial.objects).toBe(50);
  // Native TransformControls uploads its drag-only helpers lazily. Warm that
  // existing path before checking that subsequent magnetic drags allocate none.
  await drag(page, 2.15);
  await page.mouse.up();
  const warmed = await appCall(page, 'stats');
  await appCall(page, 'resetSource');
  await drag(page, 2.15);
  expect((await appCall(page, 'snapshot'))[0].position[0]).toBeCloseTo(2, 8);
  const elements = await page.locator('#snappingGuides *').count();
  // Move away from every nearby anchor while the same gesture remains active.
  const release = await appCall(page, 'project', -3.7);
  await page.mouse.move(release.x, release.y, { steps: 20 });
  await expect(page.locator('#snappingGuides')).toBeHidden();
  await page.mouse.up();
  await expect(page.locator('#snappingGuides')).toBeHidden();
  expect(await page.locator('#snappingGuides *').count()).toBe(elements);
  const final = await appCall(page, 'stats');
  expect(final.geometries).toBe(warmed.geometries);
  const frames = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await new Promise((done) => window.setTimeout(done, 150));
    const frame = app.view.renderer.info.render.frame;
    await new Promise((done) => window.setTimeout(done, 150));
    return [frame, app.view.renderer.info.render.frame];
  });
  expect(frames[1]).toBe(frames[0]);
  await appCall(page, 'dispose');
  await expect(page.locator('#snappingGuides')).toHaveCount(0);
});

test('magnetic guides clear on deselection, and master-off leaves native free movement', async ({
  page,
}) => {
  await start(page);
  await enable(page);
  await drag(page, 2.15);
  await expect(page.locator('#snappingGuides')).toBeVisible();
  await appCall(page, 'deselect');
  await expect(page.locator('#snappingGuides')).toBeHidden();
  await page.mouse.up();
  await appCall(page, 'resetSource');
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').uncheck();
  await page.keyboard.press('Escape');
  await drag(page, 2.15);
  await expect(page.locator('#snappingGuides')).toBeHidden();
  expect((await appCall(page, 'snapshot'))[0].position[0]).toBeCloseTo(2.15, 4);
  await page.mouse.up();
});
