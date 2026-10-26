import { expect, test } from '@playwright/test';

async function start(page, width) {
  await page.setViewportSize({ width, height: 844 });
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
  await expect(page.locator('.planner-loading')).toBeHidden();
}

async function snapshot(page) {
  // Allow queued layout, ResizeObserver and the idle renderer to finish.
  return page.evaluate(async () => {
    for (let i = 0; i < 3; i++)
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const { view, state, selection } = window.planner;
    return {
      camera: {
        position: view.camera.position.toArray(),
        quaternion: view.camera.quaternion.toArray(),
        zoom: view.camera.zoom,
        target: view.controls.target.toArray(),
        projection: view.camera.projectionMatrix.toArray(),
      },
      canvas: document
        .getElementById('threeCanvas')
        .getBoundingClientRect()
        .toJSON(),
      objects: state.objects.map((object) => ({
        id: object.uuid,
        position: object.position.toArray(),
        rotation: object.rotation.toArray(),
        scale: object.scale.toArray(),
      })),
      selected: selection.pickedObject?.uuid ?? null,
      attached: view.transformControls.object?.uuid ?? null,
      sameView:
        view.camera === window.originalView.camera &&
        view.controls === window.originalView.controls &&
        view.renderer === window.originalView.renderer,
      resets: window.cameraResets,
    };
  });
}

for (const scenario of [
  {
    name: 'desktop monitor button',
    width: 1440,
    product: 'small16x9Monitor28',
    method: 'button',
  },
  {
    name: 'desktop keyboard shortcut',
    width: 1440,
    product: 'default60PercentKeyboardAllGrey',
    method: 'keyboard',
  },
  {
    name: 'compact monitor action',
    width: 1100,
    product: 'small16x9Monitor28',
    method: 'action',
  },
  {
    name: 'phone monitor sheet',
    width: 390,
    product: 'small16x9Monitor28',
    method: 'button',
  },
  {
    name: 'phone keyboard shortcut',
    width: 390,
    product: 'default60PercentKeyboardAllGrey',
    method: 'keyboard',
  },
  {
    name: 'unselected mouse action',
    width: 1440,
    product: 'small16x9Monitor28',
    method: 'unselected',
  },
]) {
  test(`deletion preserves perspective and inspector footprint: ${scenario.name}`, async ({
    page,
  }) => {
    await start(page, scenario.width);
    await page.evaluate((product) => {
      const { view, state, selection } = window.planner;
      selection.pick(
        state.objects.find((object) => object.userData.objectName === product),
      );
      // A non-default orbit, pan target and zoom must survive deletion.
      view.camera.position.set(85, 110, 160);
      view.camera.zoom = 1.2;
      view.camera.updateProjectionMatrix();
      view.controls.target.set(12, 28, -15);
      view.controls.update();
      view.invalidate();
      window.originalView = {
        camera: view.camera,
        controls: view.controls,
        renderer: view.renderer,
      };
      window.cameraResets = 0;
      const reset = view.controls.reset.bind(view.controls);
      view.controls.reset = () => {
        window.cameraResets++;
        reset();
      };
    }, scenario.product);
    if (scenario.width === 1100) {
      await page.locator('#closeLibrary').click();
      await page.locator('#openSelection').click();
    }
    if (scenario.width < 768 && scenario.method === 'button')
      await page.locator('#toggleSelectionPanel').click();
    await expect(page.locator('#selectionPanel')).toBeVisible();
    const before = await snapshot(page);
    expect(before.selected).not.toBeNull();
    const removed = await page.evaluate((method) => {
      const { selection, state } = window.planner;
      return (
        method === 'unselected'
          ? state.objects.find(
              (object) => object.userData.objectName === 'defaultMouse',
            )
          : selection.pickedObject
      ).uuid;
    }, scenario.method);
    if (scenario.method === 'button')
      await page.locator('#removeObject').click();
    else if (scenario.method === 'keyboard') {
      await page.locator('#threeCanvas').focus();
      await page.keyboard.press('Delete');
    } else {
      await page.evaluate((id) => {
        const { actions, state } = window.planner;
        actions.remove(state.objects.find((object) => object.uuid === id));
      }, removed);
    }
    const after = await snapshot(page);
    expect(after.objects).toEqual(
      before.objects.filter((object) => object.id !== removed),
    );
    expect(after.camera).toEqual(before.camera);
    expect(after.canvas).toEqual(before.canvas);
    expect(after.sameView).toBe(true);
    expect(after.resets).toBe(0);
    await expect(page.locator('#selectionPanel')).toBeVisible();
    if (scenario.method === 'unselected') {
      expect(after.selected).toBe(before.selected);
      expect(after.attached).toBe(before.attached);
    } else {
      expect(after.selected).toBeNull();
      expect(after.attached).toBeNull();
      await expect(page.locator('#selectionTitle')).toHaveText(
        'No object selected',
      );
      await expect(page.locator('#removeObject')).toBeHidden();
      await expect(page.locator('#selectionTransforms')).toBeHidden();
      await expect(page.locator('#selectionPreview')).toBeEmpty();
      await expect(page.locator('#panelBackdrop')).toBeHidden();
      if (scenario.method === 'button' || scenario.method === 'keyboard')
        await expect(page.locator('#threeCanvas')).toBeFocused();
      expect(
        await page.evaluate(
          (product) =>
            window.planner.state.objects.some(
              (object) => object.userData.objectName === product,
            ),
          scenario.product,
        ),
      ).toBe(false);
    }
    if (scenario.name === 'desktop monitor button') {
      const bounds = await page.locator('#threeCanvas').boundingBox();
      async function drag() {
        await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + 100);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + 125, {
          steps: 5,
        });
        await page.mouse.up();
      }
      await drag();
      const orbited = await snapshot(page);
      expect(orbited.camera.position).not.toEqual(after.camera.position);
      await page.keyboard.down('Shift');
      await drag();
      await page.keyboard.up('Shift');
      const panned = await snapshot(page);
      expect(panned.camera.target).not.toEqual(orbited.camera.target);
      await page.mouse.wheel(0, 120);
      await expect
        .poll(async () => (await snapshot(page)).camera.position)
        .not.toEqual(panned.camera.position);
      await page.locator('#resetCameraButton').click();
      const reset = await snapshot(page);
      expect(reset.resets).toBe(1);
      expect(reset.camera.zoom).toBe(1);
      expect(reset.camera.target).toEqual([0, 30.55, -60]);
    }
  });
}
