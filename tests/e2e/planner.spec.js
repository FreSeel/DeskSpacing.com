import { expect, test } from '@playwright/test';

// Inspect the exported application lifecycle; the adapter exists only in tests.
const snapshot = (page) =>
  page.evaluate(() =>
    window.planner.state.objects
      .map((object) => ({
        product: object.userData.objectName,
        type: object.userData.type,
        position: object.position.toArray(),
        rotation: object.rotation.toArray().slice(0, 3),
      }))
      .sort((a, b) => a.product.localeCompare(b.product)),
  );

async function ready(page, count = 6) {
  await page.evaluate(async () => {
    window.planner = window.location.pathname.endsWith('/mainApp.html')
      ? (await import(new URL('./src/main.js', window.location.href).href)).app
      : {
          state: {
            get objects() {
              return window.objectsArr;
            },
          },
          view: {
            renderer: window.renderer,
            scene: window.scene,
            transformControls: window.transformControls,
          },
        };
  });
  await expect(page.locator('#starterModal')).toBeVisible();
  await page
    .locator('#starterModal .modal-footer [data-bs-dismiss=modal]')
    .click();
  await expect(page.locator('#starterModal')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.planner.state.objects?.length))
    .toBe(count);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.planner.view.renderer?.info.render.triangles ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() =>
      window.planner.view.renderer.getContext().isContextLost(),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(() =>
      window.planner.state.objects.every((object) =>
        window.planner.view.scene.children.includes(object),
      ),
    ),
  ).toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Analytics/fonts are optional; all required application JS and models must be local.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
});

test('homepage opens the creator, loads real GLBs and restores a shared setup', async ({
  page,
}) => {
  const errors = [];
  const failedAssets = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      response.url().startsWith('http://127.0.0.1:4173/') &&
      response.status() >= 400
    )
      failedAssets.push(response.url());
  });
  await page.goto('./');
  await page.locator('a[href="mainApp.html"]').first().click();
  await expect(page).toHaveURL(/\/DeskSpacing\.com\/mainApp\.html$/);
  await ready(page);
  expect((await snapshot(page)).map((object) => object.product)).toEqual(
    [
      'default60PercentKeyboardAllGrey',
      'defaultMouse',
      'floor',
      'modernDesk',
      'QCKSmall',
      'small16x9Monitor28',
    ].sort((a, b) => a.localeCompare(b)),
  );
  expect(
    await page.evaluate(() =>
      window.planner.state.objects
        .filter((object) => !object.userData.type.includes('Primitive'))
        .every((object) => {
          let meshes = 0;
          object.traverse((child) => {
            if (child.isMesh && child.geometry.attributes.position.count > 0)
              meshes++;
          });
          return meshes > 0;
        }),
    ),
  ).toBe(true);

  await page.locator('#saveModalButton').click();
  await expect(page.locator('#saveModal')).toBeVisible();
  const link = await page.locator('#customLinkForm').inputValue();
  expect(new URL(link).pathname).toBe('/DeskSpacing.com/mainApp.html');
  expect(new URL(link).origin).toBe('http://127.0.0.1:4173');
  const before = await snapshot(page);
  await page.goto(link);
  await ready(page);
  expect(await snapshot(page)).toEqual(before);
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

test('catalog loads an additional model; selection, rotate shortcut and delete update the scene', async ({
  page,
}) => {
  await page.goto('mainApp.html');
  await ready(page);
  // Open the catalog accordion through Bootstrap 5 before adding a real model.
  await page.locator('#headingSeven').click();
  await expect(page.locator('#collapseSeven')).toBeVisible();
  const add = page.locator(
    '[data-action="add"][data-product="defaultMouse"]:not([data-replace])',
  );
  await add.click();
  await add.evaluate((button) => button.blur());
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.planner.state.objects.filter(
            (object) => object.userData.objectName === 'defaultMouse',
          ).length,
      ),
    )
    .toBe(2);
  // Loading a catalog item selects it through the application's own callback.
  expect(
    await page.evaluate(
      () => window.planner.view.transformControls.object?.userData.objectName,
    ),
  ).toBe('defaultMouse');
  await page.keyboard.press('r');
  expect(
    await page.evaluate(() => window.planner.view.transformControls.getMode()),
  ).toBe('rotate');
  const selected = await page.evaluate(
    () => window.planner.view.transformControls.object.name,
  );
  await page.keyboard.press('Delete');
  await expect
    .poll(() => page.evaluate(() => window.planner.state.objects.length))
    .toBe(6);
  expect(
    await page.evaluate(
      (name) => window.planner.view.scene.getObjectByName(name) === undefined,
      selected,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => window.planner.view.transformControls.object === undefined,
    ),
  ).toBe(true);
});

test('retained pages are served at their original URLs', async ({
  request,
}) => {
  for (const name of [
    'index.html',
    'about.html',
    'contact.html',
    'services.html',
    'services - Copy.html',
    'mainApp.html',
    'mainAppMobile.html',
    'mainAppOld.html',
    'testHTMLfile.html',
  ]) {
    const response = await request.get(name);
    expect(response.status(), name).toBe(200);
    expect(await response.text(), name).toMatch(/<html/i);
  }
  expect((await request.get('GLTFs/does-not-exist.glb')).status()).toBe(404);
});

test('Bootstrap 5 tutorial carousel advances and closes without losing the scene', async ({
  page,
}) => {
  await page.goto('mainApp.html');
  await ready(page);
  await page.locator('[data-bs-target="#tutorialModal"]').first().click();
  await expect(page.locator('#tutorialModal')).toBeVisible();
  // Disable timed cycling so this specifically verifies the next-button interaction.
  await page.evaluate(() =>
    window.bootstrap.Carousel.getOrCreateInstance(
      '#carouselExampleControls',
    ).pause(),
  );
  const slides = page.locator('#carouselExampleControls .carousel-item');
  await expect(slides.nth(0)).toHaveClass(/active/);
  await page.locator('#tutorialModal .carousel-control-next').click();
  await expect(slides.nth(1)).toHaveClass(/active/);
  await expect(slides.nth(0)).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      slides
        .nth(1)
        .evaluate((slide) =>
          Math.round(
            slide.getBoundingClientRect().left -
              slide.parentElement.getBoundingClientRect().left,
          ),
        ),
    )
    .toBe(0);
  await page
    .locator('#tutorialModal [data-bs-dismiss="modal"]')
    .first()
    .click();
  await expect(page.locator('#tutorialModal')).toBeHidden();
  expect(await page.evaluate(() => window.planner.state.objects.length)).toBe(
    6,
  );
});

test('maintained animations reveal content and responsive navigation opens', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto('./');
  const heading = page
    .locator('.probootstrap-cover .probootstrap-stagger')
    .first();
  await expect(heading).toHaveCSS('opacity', '1');
  await expect(page.locator('#probootstrap-loader')).not.toHaveClass(/show/);
  expect(await page.evaluate(() => window.jQuery)).toBeUndefined();
  await page.locator('.navbar-toggler').click();
  await expect(page.locator('#probootstrap-nav')).toHaveClass(/show/);
  await expect(
    page.locator('#probootstrap-nav a[href="mainApp.html"]'),
  ).toBeVisible();
  await page.locator('.navbar-toggler').click();
  await expect(page.locator('#probootstrap-nav')).not.toHaveClass(/show/);
  expect(errors).toEqual([]);
});

test('Popper 2 positions mobile planner tooltips using the retained theme', async ({
  page,
}) => {
  await page.goto('mainAppMobile.html');
  await ready(page);
  const link = page.locator('[data-bs-toggle="tooltip"]').first();
  // Open the relevant accordion via its data API before hovering the affiliate link.
  const panel = await link.evaluate(
    (element) => element.closest('.collapse').id,
  );
  await page.locator(`[data-bs-target="#${panel}"]`).first().click();
  await link.hover();
  const tooltip = page.locator('.tooltip.show');
  await expect(tooltip).toContainText('Purchase on Amazon');
  await expect(tooltip).toHaveAttribute('x-placement', /top|bottom|left|right/);
  await expect(tooltip.locator('.tooltip-arrow.arrow')).toBeAttached();
  const box = await tooltip.boundingBox();
  expect(box.width).toBeGreaterThan(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
});

test('unrelated and malformed setup queries retain a usable default scene', async ({
  page,
}) => {
  for (const query of [
    '?utm_source=test',
    '?hasOwnProperty=x&customSetup=%5B%20',
    '?customSetup=%',
  ]) {
    await page.goto(`mainApp.html${query}`);
    await ready(page);
    expect(
      (await snapshot(page)).find((object) => object.product === 'modernDesk'),
    ).toBeDefined();
  }
});

async function openProduct(page, attribute, id, replace = false) {
  const button = page.locator(
    `[data-action="add"][data-${attribute}="${id}"]${replace ? '[data-replace]' : ':not([data-replace])'}`,
  );
  const panel = await button.evaluate(
    (element) => element.closest('.collapse').id,
  );
  if (!(await page.locator(`#${panel}`).isVisible())) {
    await page.locator(`[data-bs-target="#${panel}"]`).first().click();
    await expect(page.locator(`#${panel}`)).toBeVisible();
  }
  return button;
}

const records = (page) =>
  page.evaluate(() =>
    window.planner.sharing
      .snapshot()
      .sort((a, b) => a.product.localeCompare(b.product)),
  );

async function expectProduct(page, product) {
  await expect
    .poll(async () =>
      (await records(page)).some((record) => record.product === product),
    )
    .toBe(true);
}

test('monitor stands and keyboard colors resolve through catalog configuration and replacement', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('mainApp.html');
  await ready(page);
  const addMonitor = await openProduct(page, 'family', 'small16x9Monitor');
  await page.locator('#small16x9MonitorForm').selectOption('24');
  await page.locator('#small16x9MonitorStand').check();
  await addMonitor.click();
  await expectProduct(page, 'small16x9Monitor24NoStand');
  const replace = await openProduct(
    page,
    'family',
    'default60PercentKeyboard',
    true,
  );
  await page.locator('#default60PercentKeyboardForm').selectOption('AllWhite');
  await expect(page.locator('#default60PercentKeyboardImage')).toHaveAttribute(
    'src',
    'Model thumbnails/default60PercentKeyboardAllWhite.jpg',
  );
  await replace.click();
  await expectProduct(page, 'default60PercentKeyboardAllWhite');
  const current = await records(page);
  expect(current).toHaveLength(7);
  expect(
    current.some((record) => record.product === 'small16x9Monitor24NoStand'),
  ).toBe(false);
  expect(
    current.find(
      (record) => record.product === 'default60PercentKeyboardAllWhite',
    ).position[2],
  ).toBe(-57);
  expect(await page.evaluate(() => window.objectsArr)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('custom desks, primitive dimensions and materials survive sharing and restoration', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('mainApp.html');
  await ready(page);
  const before = await records(page);
  const desk = await openProduct(page, 'product', 'customDesk');
  await page.locator('#customDeskL').fill('50');
  await page.locator('#customDeskW').fill('20');
  await page.locator('#customDeskForm').selectOption('italianOak');
  await expect(page.locator('#customDeskImage')).toHaveAttribute(
    'src',
    'Model thumbnails/customDeskItalianOak.jpg',
  );
  await desk.click();
  await expectProduct(page, 'customDesk');
  expect(
    (await records(page)).find((item) => item.product === 'defaultMouse')
      .position[1],
  ).toBe(
    before.find((item) => item.product === 'defaultMouse').position[1] - 0.5,
  );
  const box = await openProduct(page, 'product', 'referenceBox');
  await page.locator('#referenceBoxL').fill('5');
  await page.locator('#referenceBoxW').fill('5');
  await page.locator('#referenceBoxH').fill('10');
  await box.click();
  await expectProduct(page, 'referenceBox');
  // Input typing must not delete or rotate the selected scene object.
  await page.locator('#referenceBoxL').focus();
  await page.keyboard.press('d');
  await page.keyboard.press('r');
  expect(await records(page)).toHaveLength(7);
  expect(
    await page.evaluate(() => window.planner.view.transformControls.getMode()),
  ).toBe('translate');
  const sphere = await openProduct(page, 'product', 'referenceSphere');
  await page.locator('#referenceSphereRadius').fill('2');
  await sphere.click();
  await expectProduct(page, 'referenceSphere');
  const expected = await records(page);
  expect(expected.find((item) => item.product === 'customDesk')).toMatchObject({
    dimensions: [50, 1, 20],
    texture: 'italianOak',
  });
  expect(
    expected.find((item) => item.product === 'referenceBox'),
  ).toMatchObject({ dimensions: [5, 5, 10], position: [0, 33.2, -57] });
  expect(
    expected.find((item) => item.product === 'referenceSphere'),
  ).toMatchObject({ dimensions: [2, -1, -1] });
  await page.locator('#saveModalButton').click();
  const link = await page.locator('#customLinkForm').inputValue();
  await page.goto(link);
  await ready(page, 8);
  expect(await records(page)).toEqual(expected);
  expect(errors).toEqual([]);
});

test('failed model replacement reports an error and preserves the selected object', async ({
  page,
}) => {
  await page.goto('mainApp.html');
  await ready(page);
  const add = await openProduct(page, 'product', 'defaultMouse');
  await add.click();
  await expect.poll(async () => (await records(page)).length).toBe(7);
  const before = await records(page);
  await page.route(
    /GLTFs\/mice(?:%20| )and(?:%20| )mousepads\/mouse(?:%20| )2/,
    (route) => route.abort(),
  );
  const replace = await openProduct(page, 'product', 'MXMaster3', true);
  await replace.click();
  await expect(page.locator('.planner-feedback')).toContainText(
    'Could not load',
  );
  expect(await records(page)).toEqual(before);
});

test('the camera orbits and resets; object translation and rotation use the live gizmo', async ({
  page,
}) => {
  await page.goto('mainApp.html');
  await ready(page);
  const cameraPose = () =>
    page.evaluate(() => window.planner.view.camera.position.toArray());
  const initialCamera = await cameraPose();
  const canvas = page.locator('#threeCanvas');
  const bounds = await canvas.boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width * 0.75,
    bounds.y + bounds.height * 0.4,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.85,
    bounds.y + bounds.height * 0.45,
    { steps: 10 },
  );
  await page.mouse.up();
  expect(await cameraPose()).not.toEqual(initialCamera);
  await page.locator('[data-action="reset-camera"]').last().click();
  await expect.poll(cameraPose).toEqual(initialCamera);

  const box = await openProduct(page, 'product', 'referenceBox');
  await box.click();
  await expectProduct(page, 'referenceBox');
  await box.evaluate((element) => element.blur());
  // Locate an actual visible X-axis handle from the pinned engine, then drag it.
  const handle = await page.evaluate(() => {
    const { camera, transformControls } = window.planner.view;
    transformControls.updateMatrixWorld(true);
    const gizmo = transformControls.children.find((child) => child.gizmo);
    const arrow = gizmo.gizmo.translate.children.find(
      (child) =>
        child.name === 'X' &&
        child.visible &&
        child.type === 'Mesh' &&
        child.tag === 'fwd',
    );
    arrow.geometry.computeBoundingBox();
    const point = arrow.geometry.boundingBox.getCenter(arrow.position.clone());
    arrow.localToWorld(point);
    point.project(camera);
    const rect = document.getElementById('threeCanvas').getBoundingClientRect();
    return {
      x: rect.left + ((point.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - point.y) * rect.height) / 2,
    };
  });
  const original = (await records(page)).find(
    (item) => item.product === 'referenceBox',
  );
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 45, handle.y, { steps: 12 });
  await page.mouse.up();
  const moved = (await records(page)).find(
    (item) => item.product === 'referenceBox',
  );
  expect(moved.position[0]).not.toBe(original.position[0]);
  await page.keyboard.press('r');
  expect(
    await page.evaluate(() => window.planner.view.transformControls.getMode()),
  ).toBe('rotate');
  const ring = await page.evaluate(() => {
    const { camera, transformControls } = window.planner.view;
    transformControls.updateMatrixWorld(true);
    const gizmo = transformControls.children.find((child) => child.gizmo);
    const ring = gizmo.picker.rotate.children.find(
      (child) => child.name === 'Y',
    );
    const point = ring.position.clone().set(0.7, 0, 0.7);
    ring.localToWorld(point);
    point.project(camera);
    const rect = document.getElementById('threeCanvas').getBoundingClientRect();
    return {
      x: rect.left + ((point.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - point.y) * rect.height) / 2,
    };
  });
  await page.mouse.move(ring.x, ring.y);
  await page.mouse.down();
  await page.mouse.move(ring.x + 30, ring.y + 15, { steps: 12 });
  await page.mouse.up();
  expect(
    (await records(page)).find((item) => item.product === 'referenceBox')
      .rotation[1],
  ).not.toBe(original.rotation[1]);
});

test('remaining product categories add and delete through their catalog buttons', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('mainApp.html');
  await ready(page);
  for (const product of [
    'QCKMedium',
    'audioInterface',
    'modernLaptop13',
    'miniITXTower',
    'simpleChair',
    'basicLamp',
  ]) {
    const button = await openProduct(page, 'product', product);
    await button.click();
    await expectProduct(page, product);
    await button.evaluate((element) => element.blur());
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await records(page)).length).toBe(6);
  }
  expect(errors).toEqual([]);
});

test('desktop restores historical mobile primitive delimiters', async ({
  page,
}) => {
  const setup =
    '[ *FurniturePrimitiveBoxDeskNoSelect|customDesk|0,30.2,-53,|0,0,0,|50,1,20,|italianOak|* *PrimitiveBox|referenceBox|-12.456730542942143,33.2,-54.65369349806694,|0,0.906999410493721,0,|5,5,10,|null|* FurnitureChair|modernOfficeChair|0,2.8,-50,|0,4.71238898038469,0,| *PrimitiveSphere|referenceSphere|1,32,-57,|0,0,0,|2,-1,-1,|null|* ]';
  await page.goto(`mainApp.html?customSetup=${encodeURIComponent(setup)}`);
  await ready(page, 4);
  const current = await records(page);
  expect(current.find((item) => item.product === 'referenceBox')).toMatchObject(
    {
      position: [-12.456730542942143, 33.2, -54.65369349806694],
      rotation: [0, 0.906999410493721, 0],
      dimensions: [5, 5, 10],
    },
  );
  expect(
    current.find((item) => item.product === 'referenceSphere'),
  ).toMatchObject({ dimensions: [2, -1, -1], texture: 'null' });
});
