import { expect, test } from '@playwright/test';

async function start(page, dense = false) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async (dense) => {
    const { app } = await import('./src/main.js');
    await app.ready;
    await app.actions.add('modernDesk');
    const products = [
      'small16x9Monitor28',
      'small16x9Monitor28',
      'default60PercentKeyboardAllGrey',
      'defaultMouse',
      'deskSpacingSpeakerPrimary',
      'deskSpacingSpeakerSecondary',
    ];
    for (let i = 0; i < (dense ? 49 : products.length); i++) {
      const item = await app.actions.add(products[i % products.length]);
      item.position.x = dense
        ? ((i % 7) - 3) * 8
        : [-18, 16, 12, 24, -20, 22][i];
      if (dense) item.position.z = -70 + Math.floor(i / 7) * 5;
    }
    app.view.camera.position.set(60, 75, 45);
    app.view.controls.target.set(0, 32, -53);
    app.view.controls.update();
    app.view.invalidateScene();
  }, dense);
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').check();
  await page.locator('#snapGridEnabled').setChecked(dense);
  await page.locator('#snapObjectsEnabled').check();
  await page.locator('#snapSurfaceEnabled').setChecked(dense);
  await page.keyboard.press('Escape');
}

// Use independent actual world-vertex bounds for assertions. The production
// pipeline is driven through the same TransformControls events as native input;
// native pointer hit testing is covered separately in snapping.spec.js.
async function exercise(page, operation) {
  return page.evaluate(async (operation) => {
    const { app } = await import('./src/main.js');
    const { transformControls: controls } = app.view;
    function bounds(object) {
      object.updateWorldMatrix(true, true);
      const min = { x: Infinity, y: Infinity, z: Infinity },
        max = { x: -Infinity, y: -Infinity, z: -Infinity };
      object.traverse((mesh) => {
        if (!mesh.isMesh || !mesh.visible) return;
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          const p = mesh
            .getVertexPosition(i, object.position.clone())
            .applyMatrix4(mesh.matrixWorld);
          for (const axis of ['x', 'y', 'z']) {
            min[axis] = Math.min(min[axis], p[axis]);
            max[axis] = Math.max(max[axis], p[axis]);
          }
        }
      });
      return {
        min,
        max,
        size: ['x', 'y', 'z'].map((axis) => max[axis] - min[axis]),
      };
    }
    const objects = app.state.objects;
    if (operation === 'pairs') {
      const results = [];
      for (const [si, ti, kind] of [
        [1, 2, 'edge'],
        [1, 2, 'center'],
        [3, 2, 'center'],
        [4, 3, 'edge'],
      ]) {
        const source = objects[si],
          target = objects[ti];
        const saved = objects.map((o) => o.position.clone());
        objects.forEach((o) => {
          if (o !== source && o !== target) o.position.x += 1000;
        });
        const a = bounds(source),
          b = bounds(target);
        const goal =
          kind === 'edge'
            ? b.min.x - (a.max.x - source.position.x)
            : (b.min.x + b.max.x - a.min.x - a.max.x) / 2 + source.position.x;
        source.position.x = goal - 4;
        app.selection.pick(source);
        controls.setMode('translate');
        controls.axis = 'X';
        const before = app.sharing.snapshot();
        controls.dispatchEvent({ type: 'mouseDown' });
        source.position.x = goal + 0.1;
        controls.dispatchEvent({ type: 'objectChange' });
        const after = app.sharing.snapshot(),
          placed = bounds(source);
        const label = document.getElementById('snapStatus').textContent;
        controls.dispatchEvent({ type: 'mouseUp' });
        app.actions.transforms.undo();
        const undone = app.sharing.snapshot();
        app.actions.transforms.redo();
        const redone = app.sharing.snapshot();
        results.push({
          kind,
          goal,
          actual: source.position.x,
          sizeBefore: a.size,
          sizeAfter: placed.size,
          label,
          history:
            JSON.stringify(before) === JSON.stringify(undone) &&
            JSON.stringify(after) === JSON.stringify(redone),
        });
        objects.forEach((o, i) => o.position.copy(saved[i]));
      }
      app.selection.pick(objects[3]);
      app.view.invalidateScene();
      return results;
    }
    if (operation === 'free') {
      const source = objects[3],
        before = app.sharing.snapshot();
      app.selection.pick(source);
      controls.axis = 'X';
      controls.dispatchEvent({ type: 'mouseDown' });
      source.position.x = 3.141592653589793;
      controls.dispatchEvent({ type: 'objectChange' });
      controls.dispatchEvent({ type: 'mouseUp' });
      return { before, after: app.sharing.snapshot() };
    }
    if (operation === 'surface') {
      const source = objects[5],
        desk = objects[0],
        height = bounds(desk).max.y;
      source.position.set(0, source.position.y, -53);
      source.position.y += height + 0.4 - bounds(source).min.y;
      const size = bounds(source).size;
      app.selection.pick(source);
      controls.axis = 'X';
      controls.dispatchEvent({ type: 'mouseDown' });
      source.position.x = 4.13;
      controls.dispatchEvent({ type: 'objectChange' });
      const actual = bounds(source);
      return {
        height,
        bottom: actual.min.y,
        sizeBefore: size,
        sizeAfter: actual.size,
      };
    }
    if (operation === 'finish') {
      controls.dispatchEvent({ type: 'mouseUp' });
      return {
        records: app.sharing.snapshot(),
        link: app.sharing.createLink(),
      };
    }
    if (operation === 'reload') {
      await app.ready;
      return app.sharing.snapshot();
    }
    if (operation === 'camera') {
      app.view.camera.position.set(-50, 65, 20);
      app.view.camera.zoom = 1.5;
      app.view.camera.updateProjectionMatrix();
      app.view.controls.update();
      app.view.invalidate();
    }
    if (operation === 'levels') {
      const records = app.sharing.snapshot();
      const second = {
        ...records[0],
        position: [70, records[0].position[1] + 3, records[0].position[2]],
      };
      await app.actions.restore([records[0], second, records[5]]);
      const [desk, upper, source] = app.state.objects;
      const low = bounds(desk).max.y,
        high = bounds(upper).max.y;
      source.position.x = 0;
      source.position.z = -53;
      source.position.y += low + 0.4 - bounds(source).min.y;
      const rawY = source.position.y;
      app.selection.pick(source);
      controls.axis = 'X';
      controls.dispatchEvent({ type: 'mouseDown' });
      source.position.x = 4;
      controls.dispatchEvent({ type: 'objectChange' });
      const first = bounds(source).min.y;
      for (const x of [30, 70, 72]) {
        source.position.set(x, rawY, -53);
        controls.dispatchEvent({ type: 'objectChange' });
      }
      const crossing = bounds(source).min.y;
      controls.dispatchEvent({ type: 'mouseUp' });
      controls.axis = 'Y';
      controls.dispatchEvent({ type: 'mouseDown' });
      source.position.y += high - low + 0.2;
      controls.dispatchEvent({ type: 'objectChange' });
      const secondContact = bounds(source).min.y;
      controls.dispatchEvent({ type: 'mouseUp' });
      const before = source.position.toArray();
      upper.position.y += 2;
      app.view.invalidateScene();
      return {
        low,
        high,
        first,
        crossing,
        secondContact,
        before,
        after: source.position.toArray(),
      };
    }
    if (operation === 'dense') {
      const source = objects[1],
        originals = [];
      let reads = 0;
      for (const object of objects)
        object.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const original = mesh.getVertexPosition;
          originals.push(() => {
            mesh.getVertexPosition = original;
          });
          mesh.getVertexPosition = function (...args) {
            reads++;
            return original.apply(this, args);
          };
        });
      try {
        app.selection.pick(source);
        controls.axis = 'X';
        controls.dispatchEvent({ type: 'mouseDown' });
        const preparationReads = reads;
        reads = 0;
        const start = source.position.x,
          positions = [];
        for (let i = 0; i < 40; i++) {
          source.position.x = start + 2.1 + (i % 2) * 0.001;
          controls.dispatchEvent({ type: 'objectChange' });
          positions.push(source.position.x);
        }
        const result = {
          count: objects.length,
          preparationReads,
          dragReads: reads,
          spread: Math.max(...positions) - Math.min(...positions),
        };
        controls.dispatchEvent({ type: 'mouseUp' });
        return result;
      } finally {
        originals.forEach((restore) => restore());
      }
    }
  }, operation);
}

test('real monitors, keyboard and mouse align independently with stable dimensions and history', async ({
  page,
}) => {
  await start(page);
  const results = await exercise(page, 'pairs');
  for (const result of results) {
    expect(result.actual).toBeCloseTo(result.goal, 7);
    result.sizeAfter.forEach((value, i) =>
      expect(value).toBeCloseTo(result.sizeBefore[i], 9),
    );
    expect(result.history).toBe(true);
    expect(result.label).toContain('aligned');
  }
  await expect(page.locator('#dimensionAnnotations')).toBeVisible();
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').uncheck();
  await page.keyboard.press('Escape');
  const free = await exercise(page, 'free');
  expect(free.after[3].position[0]).toBe(Math.PI);
  free.after.forEach((record, i) => {
    if (i !== 3) expect(record).toEqual(free.before[i]);
  });
});

test('real speaker contact coexists with annotations, camera zoom, cm/in and exact project reload', async ({
  page,
}, testInfo) => {
  await start(page);
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapSurfaceEnabled').check();
  await page.locator('#snapGridEnabled').check();
  await page.keyboard.press('Escape');
  const result = await exercise(page, 'surface');
  expect(Math.abs(result.bottom - result.height)).toBeLessThan(0.001);
  result.sizeAfter.forEach((value, i) =>
    expect(value).toBeCloseTo(result.sizeBefore[i], 9),
  );
  await expect(page.locator('#snappingGuides')).toBeVisible();
  await expect(page.locator('#dimensionAnnotations')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('speaker-contact.png') });
  await exercise(page, 'camera');
  await page.screenshot({
    path: testInfo.outputPath('speaker-contact-zoom.png'),
  });
  const saved = await exercise(page, 'finish');
  for (const unit of ['CM', 'IN', 'CM'])
    await page
      .locator('#measurementUnit')
      .getByText(unit, { exact: true })
      .click();
  expect(await exercise(page, 'reload')).toEqual(saved.records);
  await page.goto(saved.link);
  expect(await exercise(page, 'reload')).toEqual(saved.records);
  expect(saved.records).toHaveLength(7);
});

test('50 real catalog objects reuse prepared geometry across dense dragging and settle after release', async ({
  page,
}) => {
  await start(page, true);
  const result = await exercise(page, 'dense');
  expect(result.count).toBe(50);
  expect(result.preparationReads).toBeGreaterThan(0);
  expect(result.dragReads).toBe(0);
  expect(result.spread).toBeLessThan(0.01);
  expect(await page.locator('#snappingGuides path').count()).toBe(7);
  await expect(page.locator('#snappingGuides')).toBeHidden();
  const frames = await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    await new Promise((done) => window.setTimeout(done, 200));
    const first = app.view.renderer.info.render.frame;
    await new Promise((done) => window.setTimeout(done, 200));
    return [first, app.view.renderer.info.render.frame];
  });
  expect(frames[1]).toBe(frames[0]);
});

test('real accessories cross desk boundaries without switching height until deliberate vertical placement', async ({
  page,
}) => {
  await start(page);
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapObjectsEnabled').uncheck();
  await page.locator('#snapSurfaceEnabled').check();
  await page.keyboard.press('Escape');
  const result = await exercise(page, 'levels');
  expect(Math.abs(result.first - result.low)).toBeLessThan(0.001);
  expect(result.crossing).toBeCloseTo(result.first, 9);
  expect(Math.abs(result.secondContact - result.high)).toBeLessThan(0.001);
  expect(result.before).toEqual(result.after);
});
