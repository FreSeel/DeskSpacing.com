import { expect, test } from '@playwright/test';

// Observe the existing globals without introducing a production-only test API.
const snapshot = (page) =>
  page.evaluate(() =>
    window.objectsArr
      .map((object) => ({
        product: object.userData.objectName,
        type: object.userData.type,
        position: object.position.toArray(),
        rotation: object.rotation.toArray().slice(0, 3),
      }))
      .sort((a, b) => a.product.localeCompare(b.product)),
  );

async function ready(page) {
  await expect(page.locator('#starterModal')).toBeVisible();
  await page
    .locator('#starterModal .modal-footer [data-bs-dismiss=modal]')
    .click();
  await expect(page.locator('#starterModal')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.objectsArr?.length))
    .toBe(6);
  await expect
    .poll(() =>
      page.evaluate(() => window.renderer?.info.render.triangles ?? 0),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => window.renderer.getContext().isContextLost()),
  ).toBe(false);
  expect(
    await page.evaluate(() =>
      window.objectsArr.every((object) =>
        window.scene.children.includes(object),
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
      window.objectsArr
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
    "[onclick=\"addDefault('Mouse','defaultMouse',false)\"]",
  );
  await add.click();
  await add.evaluate((button) => button.blur());
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.objectsArr.filter(
            (object) => object.userData.objectName === 'defaultMouse',
          ).length,
      ),
    )
    .toBe(2);
  // Loading a catalog item selects it through the application's own callback.
  expect(
    await page.evaluate(
      () => window.transformControls.object?.userData.objectName,
    ),
  ).toBe('defaultMouse');
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.transformControls.getMode())).toBe(
    'rotate',
  );
  const selected = await page.evaluate(
    () => window.transformControls.object.name,
  );
  await page.keyboard.press('Delete');
  await expect
    .poll(() => page.evaluate(() => window.objectsArr.length))
    .toBe(6);
  expect(
    await page.evaluate(
      (name) => window.scene.getObjectByName(name) === undefined,
      selected,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.transformControls.object === undefined),
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
  expect(await page.evaluate(() => window.objectsArr.length)).toBe(6);
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

test('unrelated and malformed setup queries retain a usable default scene', async ({ page }) => {
  for (const query of ['?utm_source=test', '?hasOwnProperty=x&customSetup=%5B%20', '?customSetup=%']) {
    await page.goto(`mainApp.html${query}`);
    await ready(page);
    expect((await snapshot(page)).find((object) => object.product === 'modernDesk')).toBeDefined();
  }
});
