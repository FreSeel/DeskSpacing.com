import { expect, test } from '@playwright/test';

async function start(page) {
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
async function options(page, id, category) {
  await page.locator('#catalogCategory').selectOption(category);
  const button = page.locator(`[data-options="${id}"]`);
  if ((await button.getAttribute('aria-expanded')) !== 'true')
    await button.click();
}
const count = (page) =>
  page.evaluate(() => window.planner.state.objects.length);
const pickMouse = (page) =>
  page.evaluate(() =>
    window.planner.selection.pick(
      window.planner.state.objects.find(
        (o) => o.userData.objectName === 'defaultMouse',
      ),
    ),
  );

test('all categories filter locally; variation search retains choices and scene', async ({
  page,
}) => {
  await start(page);
  const before = await page.evaluate(() => window.planner.sharing.createLink());
  const categoryCounts = {
    desks: 6,
    monitors: 7,
    keyboards: 4,
    mice: 2,
    mousepads: 4,
    audio: 6,
    laptops: 3,
    towers: 3,
    shapes: 2,
    chairs: 3,
    miscellaneous: 5,
  };
  for (const [category, total] of Object.entries(categoryCounts)) {
    await page.locator('#catalogCategory').selectOption(category);
    await expect(page.locator('[data-card]:visible')).toHaveCount(total);
  }
  await options(page, 'default60PercentKeyboard', 'keyboards');
  await page.locator('#default60PercentKeyboardForm').selectOption('AllWhite');
  await page.locator('#catalogSearch').fill('sunset');
  await expect(page.locator('[data-card]:visible')).toHaveCount(3);
  await expect(
    page.locator('[data-card="default60PercentKeyboard"] .search-match'),
  ).toContainText('Sunset');
  await expect(page.locator('#default60PercentKeyboardForm')).toHaveValue(
    'AllWhite',
  );
  await page.locator('#catalogSearch').fill('no such item');
  await expect(page.locator('#catalogEmpty')).toBeVisible();
  await page.locator('#clearFilters').click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(45);
  await expect(page.locator('#catalogSearch')).toBeFocused();
  await options(page, 'default60PercentKeyboard', 'keyboards');
  await expect(page.locator('#default60PercentKeyboardForm')).toHaveValue(
    'AllWhite',
  );
  expect(await page.evaluate(() => window.planner.sharing.createLink())).toBe(
    before,
  );
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      return ids.length === new Set(ids).size;
    }),
  ).toBe(true);
});

test('inspector commands, focus and shortcuts follow actual selection', async ({
  page,
}) => {
  await start(page);
  await page.locator('#catalogCategory').selectOption('mice');
  const add = page.locator('[data-product="defaultMouse"]:not([data-replace])');
  await add.click();
  await expect.poll(() => count(page)).toBe(7);
  await expect(page.locator('#selectionTitle')).toHaveText('DeathAdder Mouse');
  await expect(add).toBeFocused();
  await page.locator('[data-command="rotate"]').click();
  await expect(page.locator('[data-command="rotate"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('r');
  await expect(page.locator('[data-command="translate"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#selectionTransforms summary').click();
  await page.locator('[data-command="y"]').click();
  await expect(page.locator('[data-command="y"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('y');
  await expect(page.locator('[data-command="y"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.locator('#catalogSearch').fill('desk');
  await page.keyboard.press('d');
  expect(await count(page)).toBe(7);
  await page.locator('#helpMenu summary').click();
  await page.locator('[data-bs-target="#exampleModal"]').click();
  await expect(page.locator('#exampleModal')).toBeFocused();
  await page.keyboard.press('Delete');
  expect(await count(page)).toBe(7);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await expect(page.locator('#helpMenu summary')).toBeFocused();
  await page.locator('#removeObject').click();
  await expect.poll(() => count(page)).toBe(6);
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await expect(page.locator('#selectionEmpty')).toBeVisible();
  await expect(page.locator('#threeCanvas')).toBeFocused();
  await page.locator('#catalogSearch').fill('');
  await expect(page.locator('[data-replace]:visible').first()).toBeDisabled();
});

test('panels resize the same canvas and pointer picking works after each resize', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    window.originalRenderer = window.planner.view.renderer;
    window.originalPose = window.planner.view.camera.position.toArray();
    window.planner.selection.unselectPickedObject();
  });
  async function sized() {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.getElementById('threeCanvas');
          const host = document.getElementById('rightSideContainer');
          return (
            Math.abs(canvas.clientWidth - host.clientWidth) +
            Math.abs(canvas.clientHeight - host.clientHeight) +
            Math.abs(
              window.planner.view.camera.aspect -
                host.clientWidth / host.clientHeight,
            )
          );
        }),
      )
      .toBeLessThan(0.01);
    expect(
      await page.evaluate(
        () => window.originalRenderer === window.planner.view.renderer,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => window.planner.view.camera.position.toArray()),
    ).toEqual(await page.evaluate(() => window.originalPose));
  }
  async function pickMonitor() {
    const point = await page.evaluate(() => {
      const root = window.planner.state.objects.find(
        (o) => o.userData.objectName === 'small16x9Monitor28',
      );
      root.updateWorldMatrix(true, true);
      let mesh;
      root.traverse((o) => {
        if (o.isMesh && !mesh) mesh = o;
      });
      mesh.geometry.computeBoundingBox();
      const point = mesh.geometry.boundingBox.getCenter(mesh.position.clone());
      mesh.localToWorld(point);
      point.project(window.planner.view.camera);
      const rect = document
        .getElementById('threeCanvas')
        .getBoundingClientRect();
      return {
        x: rect.x + ((point.x + 1) * rect.width) / 2,
        y: rect.y + ((1 - point.y) * rect.height) / 2,
      };
    });
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#selectionTitle')).toHaveText('16:9 Monitor');
    await expect(page.locator('#selectionPanel')).toBeVisible();
  }
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await sized();
    await pickMonitor();
    await sized();
    await page.locator('#deselectObject').click();
    await expect(page.locator('#selectionPanel')).toBeHidden();
    await sized();
    const openWidth = (await page.locator('#threeCanvas').boundingBox()).width;
    await page.locator('#closeLibrary').click();
    await expect(page.locator('#libraryPanel')).toBeHidden();
    await sized();
    expect(
      (await page.locator('#threeCanvas').boundingBox()).width,
    ).toBeGreaterThan(openWidth);
    await pickMonitor();
    await sized();
    await page.locator('#deselectObject').click();
    await page.locator('#openLibrary').click();
    await expect(page.locator('#libraryPanel')).toBeVisible();
    await sized();
  }
});

test('NoSelect identity remains visible and layout waits for a gizmo drag to end', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() =>
    window.planner.selection.pick(
      window.planner.state.objects.find(
        (o) => o.userData.objectName === 'modernDesk',
      ),
    ),
  );
  await expect(page.locator('#selectionTitle')).toHaveText('Modern Desk');
  await expect(page.locator('#selectionTransforms')).toBeHidden();
  await expect(page.locator('#selectionLocked')).toBeVisible();
  await pickMouse(page);
  await page.evaluate(() => {
    window.planner.view.transformControls.dragging = true;
    window.planner.selection.unselectPickedObject();
  });
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await page.locator('#closeLibrary').click();
  await expect(page.locator('#libraryPanel')).toBeVisible();
  await page.evaluate(() => {
    window.planner.view.transformControls.dragging = false;
  });
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await expect(page.locator('#selectionEmpty')).toBeVisible();
  await expect(page.locator('#libraryPanel')).toBeHidden();
  await pickMouse(page);
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await page.locator('[data-command="translate"]').focus();
  await page.keyboard.press('c');
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await expect(page.locator('#selectionEmpty')).toBeVisible();
  await expect(page.locator('#threeCanvas')).toBeFocused();
  expect(await count(page)).toBe(6);
  await pickMouse(page);
  await page.locator('#removeObject').click();
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await expect(page.locator('#selectionEmpty')).toBeVisible();
  await expect(page.locator('#threeCanvas')).toBeFocused();
  expect(await count(page)).toBe(5);
});

test('dimension validation retains input and unequal box axes round-trip through sharing', async ({
  page,
}) => {
  await start(page);
  await options(page, 'referenceBox', 'shapes');
  const add = page.locator('[data-product="referenceBox"]:not([data-replace])');
  await page.locator('#referenceBoxL').fill('-2');
  await add.click();
  await expect(page.locator('#referenceBoxL')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.locator('#referenceBoxL')).toBeFocused();
  expect(await count(page)).toBe(6);
  // Preserve the codec's positive-size range, without inventing a UI minimum.
  await page.locator('#referenceBoxL').fill('0.0001');
  await page.locator('#referenceBoxW').fill('7');
  await page.locator('#referenceBoxH').fill('11');
  await add.click();
  await expect.poll(() => count(page)).toBe(7);
  const record = await page.evaluate(() =>
    window.planner.sharing.snapshot().find((o) => o.product === 'referenceBox'),
  );
  expect(record.dimensions).toEqual([0.0001, 7, 11]);
  await page.locator('#saveModalButton').click();
  const url = await page.locator('#customLinkForm').inputValue();
  await page.goto(url);
  await page.evaluate(async () => {
    window.planner = (
      await import(new URL('./src/main.js', window.location.href))
    ).app;
    await window.planner.ready;
  });
  expect(
    await page.evaluate(() =>
      window.planner.sharing
        .snapshot()
        .find((o) => o.product === 'referenceBox'),
    ),
  ).toEqual(record);
});

test('reduced-motion tutorial is text-first, has seven topics and restores focus', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const gifs = [];
  page.on('request', (request) => {
    if (request.url().includes('.gif')) gifs.push(request.url());
  });
  await start(page);
  await page.locator('#helpMenu summary').click();
  const trigger = page.locator('[data-bs-target="#tutorialModal"]');
  await trigger.click();
  await expect(page.locator('#tutorialModal')).toBeVisible();
  for (let i = 0; i < 7; i++) {
    await expect(
      page.locator('#tutorialModal .carousel-item.active .eyebrow'),
    ).toHaveText(`${i + 1} / 7`);
    await expect(
      page.locator('#tutorialModal .carousel-item.active .tutorial-copy'),
    ).toBeVisible();
    if (i < 6)
      await page.locator('#tutorialModal .carousel-control-next').click();
  }
  expect(gifs).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await expect(page.locator('#helpMenu summary')).toBeFocused();
});

test('pending card actions stay isolated and discarded replacements leave no stale inspector', async ({
  page,
}) => {
  await start(page);
  await pickMouse(page);
  await page.locator('#catalogCategory').selectOption('mice');
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(
    /GLTFs\/mice(?:%20| )and(?:%20| )mousepads\/mouse(?:%20| )2/,
    async (route) => {
      await barrier;
      await route.continue();
    },
  );
  const card = page.locator('[data-card="MXMaster3"]');
  await card.locator('[data-replace]').click();
  await expect(card).toHaveAttribute('aria-busy', 'true');
  await expect(card.locator('[data-action="add"]').first()).toBeDisabled();
  await expect(
    page.locator('[data-product="defaultMouse"]:not([data-replace])'),
  ).toBeEnabled();
  await page.locator('#removeObject').click();
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await expect(page.locator('#selectionEmpty')).toBeVisible();
  release();
  await expect(card).not.toHaveAttribute('aria-busy', 'true');
  expect(await count(page)).toBe(5);
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await expect(page.locator('#selectionEmpty')).toBeVisible();
  await expect(card.locator('.card-error')).toBeHidden();
  await expect(card.locator('[data-replace]')).toBeDisabled();
});
