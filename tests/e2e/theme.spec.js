import { expect, test } from '@playwright/test';

const key = 'deskspacing.theme';
const theme = (page) => page.locator('html');
async function choose(page, value, menu = '#siteMenu') {
  if ((await page.locator(menu).getAttribute('open')) === null)
    await page.locator(`${menu} summary`).click();
  await page.getByLabel('Appearance', { exact: true }).selectOption(value);
}
async function editor(page) {
  await page.goto('mainApp.html');
  await page.evaluate(async () => {
    window.planner = (await import('./src/main.js')).app;
    await window.planner.ready;
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
});

test('system follows OS changes; manual preference persists across reload and navigation', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
  await expect(theme(page)).toHaveCSS('color-scheme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(theme(page)).toHaveAttribute('data-theme', 'light');
  await choose(page, 'dark');
  await expect(page.locator('#themeStatus')).toHaveText('Using dark theme');
  await page.reload();
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'Open Setup Creator' }).click();
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await choose(page, 'light', '#moreMenu');
  await expect(theme(page)).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(theme(page)).toHaveAttribute('data-theme', 'light');
  await choose(page, 'system', '#moreMenu');
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate((key) => window.localStorage.getItem(key), key),
  ).toBeNull();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(theme(page)).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  await page.locator('.editor-brand').click();
  await expect(theme(page)).toHaveAttribute('data-theme-preference', 'system');
});

test('saved choices synchronize with another open page, including returning to system', async ({
  page,
  context,
}) => {
  await page.goto('./');
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: 'light' });
  await other.goto('./');
  await choose(page, 'dark');
  await expect(theme(other)).toHaveAttribute('data-theme', 'dark');
  await choose(page, 'system');
  await expect(theme(other)).toHaveAttribute('data-theme', 'light');
  await other.close();
});

for (const route of ['index.html', 'mainApp.html']) {
  test(`dark theme is initialized before body parsing without waiting for modules: ${route}`, async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'dark');
      const observer = new window.MutationObserver(() => {
        if (!document.body) return;
        window.themeAtBody = document.documentElement.dataset.theme;
        observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    }, key);
    await page.route(/\/src\/(?:main|home)\.js$/, (route) => route.abort());
    await page.goto(route);
    expect(await page.evaluate(() => window.themeAtBody)).toBe('dark');
    await expect(theme(page)).toHaveCSS('color-scheme', 'dark');
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(28, 32, 31)',
    );
    await choose(
      page,
      'light',
      route === 'index.html' ? '#siteMenu' : '#moreMenu',
    );
    await expect(theme(page)).toHaveAttribute('data-theme', 'light');
  });
}

test('unavailable storage and invalid saved values fall back safely', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage denied');
      },
    });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
  await choose(page, 'light');
  await expect(theme(page)).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(theme(page)).toHaveAttribute('data-theme', 'light');
  await choose(page, 'system');
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('invalid preferences use system; quota failures keep the current choice', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, 'invalid');
    window.Storage.prototype.setItem = () => {
      throw new Error('Quota exceeded');
    };
  }, key);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  await expect(theme(page)).toHaveAttribute('data-theme-preference', 'system');
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
  await choose(page, 'light');
  await expect(theme(page)).toHaveAttribute('data-theme', 'light');
});

test('theme changes preserve scene identity, selection, materials, transforms and idle rendering', async ({
  page,
}) => {
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_FAILED'))
      consoleErrors.push(message.text());
  });
  await editor(page);
  await page.evaluate(() => {
    const { view, state, selection, sharing } = window.planner;
    selection.pick(
      state.objects.find((o) => o.userData.objectName === 'defaultMouse'),
    );
    const materials = [];
    view.scene.traverse((object) => {
      if (object.isMesh) materials.push(object.material);
    });
    window.beforeTheme = {
      renderer: view.renderer,
      scene: view.scene,
      objects: [...state.objects],
      selection: selection.pickedObject,
      camera: view.camera.position.toArray(),
      materials,
      link: sharing.createLink(),
      fog: view.scene.fog.color.getHex(),
    };
    const render = view.renderer.render.bind(view.renderer);
    window.themeFrames = 0;
    view.renderer.render = (...args) => {
      window.themeFrames++;
      render(...args);
    };
  });
  await choose(page, 'dark', '#moreMenu');
  await expect
    .poll(() =>
      page.evaluate(() => window.planner.view.scene.background.getHexString()),
    )
    .toBe('303733');
  const unchanged = await page.evaluate(() => {
    const { view, state, selection, sharing } = window.planner;
    const before = window.beforeTheme;
    const materials = [];
    view.scene.traverse((object) => {
      if (object.isMesh) materials.push(object.material);
    });
    return (
      before.renderer === view.renderer &&
      before.scene === view.scene &&
      before.objects.every(
        (object, index) => object === state.objects[index],
      ) &&
      before.selection === selection.pickedObject &&
      before.link === sharing.createLink() &&
      before.materials.every(
        (material, index) => material === materials[index],
      ) &&
      before.fog === view.scene.fog.color.getHex() &&
      JSON.stringify(before.camera) ===
        JSON.stringify(view.camera.position.toArray())
    );
  });
  expect(unchanged).toBe(true);
  await page.waitForTimeout(250);
  const frames = await page.evaluate(() => window.themeFrames);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.themeFrames)).toBe(frames);
  await page.keyboard.press('Escape');
  await page.locator('[data-command="rotate"]').click();
  expect(
    await page.evaluate(() => window.planner.view.transformControls.mode),
  ).toBe('rotate');
  // Real camera input remains connected after changing the background.
  const canvas = await page.locator('#threeCanvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width * 0.8, canvas.y + 100);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + 120, {
    steps: 4,
  });
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.planner.view.camera.position.toArray()),
  ).not.toEqual(await page.evaluate(() => window.beforeTheme.camera));
  await choose(page, 'light', '#moreMenu');
  await expect
    .poll(() =>
      page.evaluate(() => window.planner.view.scene.background.getHexString()),
    )
    .toBe('e7e7e1');
  await page.evaluate(() => window.planner.dispose());
  await choose(page, 'dark', '#moreMenu');
  expect(
    await page.evaluate(() =>
      window.planner.view.scene.background.getHexString(),
    ),
  ).toBe('e7e7e1');
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

for (const colorScheme of ['light', 'dark']) {
  test(`${colorScheme} semantic text, focus and input borders meet contrast thresholds`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('./');
    const ratios = await page.evaluate(() => {
      const probe = document.createElement('span');
      document.body.append(probe);
      function luminance(token) {
        probe.style.color = `var(${token})`;
        const values = window
          .getComputedStyle(probe)
          .color.match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
        const linear = values.map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      }
      const pairs = [];
      for (const surface of [
        'bg',
        'surface',
        'card',
        'surface-muted',
        'elevated',
        'workspace',
      ])
        for (const text of ['text', 'text-secondary', 'text-muted', 'accent'])
          pairs.push([text, surface, 4.5]);
      for (const surface of ['primary', 'primary-hover', 'primary-active'])
        pairs.push(['on-primary', surface, 4.5]);
      pairs.push(
        ['danger', 'danger-bg', 4.5],
        ['danger', 'danger-surface', 4.5],
        ['on-tooltip', 'tooltip', 4.5],
        ['thumbnail-text', 'thumbnail', 4.5],
      );
      for (const surface of [
        'bg',
        'surface',
        'card',
        'workspace',
        'input',
        'elevated',
      ])
        pairs.push(['focus', surface, 3]);
      pairs.push(['border-control', 'input', 3]);
      const results = pairs.map(([fg, bg, minimum]) => {
        const a = luminance(`--color-${fg}`),
          b = luminance(`--color-${bg}`);
        return {
          fg,
          bg,
          minimum,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
      probe.remove();
      return results;
    });
    for (const { fg, bg, minimum, ratio } of ratios)
      expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(minimum);
    await page.locator('#siteMenu summary').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Appearance', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Appearance', { exact: true })).toHaveCSS(
      'outline-style',
      'solid',
    );
  });

  for (const [size, width, height] of [
    ['desktop', 1440, 900],
    ['phone', 390, 844],
  ]) {
    test(`${colorScheme} ${size} home, menus, library, inspector and dialogs visual regression`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height });
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready);
      // Native-font approved baselines are platform-specific, like the existing suite.
      async function visual(locator, name) {
        if (process.platform === 'darwin')
          await expect(locator).toHaveScreenshot(
            `${colorScheme}-${size}-${name}.png`,
          );
        else
          await locator.screenshot({
            path: testInfo.outputPath(`${name}.png`),
          });
      }
      await visual(page.locator('body'), 'home');
      await page.locator('#siteMenu summary').click();
      await visual(page.locator('#siteMenu .menu-popover'), 'menu');
      await editor(page);
      if (size === 'phone') await page.locator('#openLibrary').click();
      await page.locator('#catalogCategory').selectOption('mice');
      await expect
        .poll(() =>
          page
            .locator('[data-card="defaultMouse"] img')
            .evaluate((img) => img.complete),
        )
        .toBe(true);
      await visual(page.locator('#libraryPanel'), 'library');
      await page
        .locator('[data-product="defaultMouse"]:not([data-replace])')
        .click();
      await expect(page.locator('#selectionTitle')).toHaveText(
        'DeathAdder Mouse',
      );
      if (size === 'phone') await page.locator('#toggleSelectionPanel').click();
      await visual(page.locator('#selectionPanel'), 'inspector');
      if (size === 'phone') await page.keyboard.press('Escape');
      await page.screenshot({ path: testInfo.outputPath('workspace.png') });
      for (const id of [
        'saveModal',
        'exampleModal',
        'starterModal',
        'tutorialModal',
      ]) {
        if (id !== 'saveModal') await page.locator('#helpMenu summary').click();
        await page.locator(`[data-bs-target="#${id}"]`).click();
        await expect(page.locator(`#${id}`)).toBeVisible();
        if (id === 'saveModal') {
          // Model load completion order can change the serialized URL. Keep
          // the visual fixture stable; sharing behavior is tested separately.
          await page.locator('#customLinkForm').evaluate((input) => {
            const url = new URL(input.value);
            url.searchParams.set('customSetup', '[ ]');
            input.value = url.href;
          });
        }
        await visual(page.locator(`#${id} .modal-content`), id);
        await page.keyboard.press('Escape');
        await expect(page.locator(`#${id}`)).toBeHidden();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });
  }
}

for (const colorScheme of ['light', 'dark']) {
  test(`${colorScheme} loading, errors, missing thumbnails and small-screen menus stay readable`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.route(
      /Model(?:%20| )thumbnails\/.*\.(?:png|jpe?g|webp)/i,
      (route) => route.abort(),
    );
    let release;
    const barrier = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(/\.glb(?:\?.*)?$/, async (route) => {
      await barrier;
      await route.continue();
    });
    await page.goto('mainApp.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.planner-loading')).toBeVisible();
    const surface =
      colorScheme === 'dark' ? 'rgb(35, 40, 38)' : 'rgb(250, 250, 247)';
    await expect(page.locator('.planner-loading')).toHaveCSS(
      'background-color',
      surface,
    );
    release();
    await page.evaluate(async () => {
      window.planner = (await import('./src/main.js')).app;
      await window.planner.ready;
    });
    await page.locator('#moreMenu summary').click();
    await expect(
      page.getByLabel('Appearance', { exact: true }),
    ).toBeInViewport();
    const menu = await page.locator('#moreMenu .menu-popover').boundingBox();
    expect(menu.y + menu.height).toBeLessThanOrEqual(568);
    await page.keyboard.press('Escape');
    await page.locator('#openLibrary').click();
    await page.locator('#catalogCategory').selectOption('shapes');
    await page.locator('[data-options="referenceBox"]').click();
    await page.locator('#referenceBoxL').fill('-2');
    await page
      .locator('[data-product="referenceBox"]:not([data-replace])')
      .click();
    await expect(page.locator('#referenceBoxError')).toBeVisible();
    await expect(page.locator('#referenceBoxError')).toHaveCSS(
      'background-color',
      colorScheme === 'dark' ? 'rgb(71, 45, 41)' : 'rgb(255, 243, 240)',
    );
    const fallback = page.locator(
      '[data-card="referenceBox"] .thumbnail-fallback',
    );
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveCSS(
      'color',
      colorScheme === 'dark' ? 'rgb(36, 39, 35)' : 'rgb(98, 103, 94)',
    );
    await page
      .locator('#libraryPanel')
      .screenshot({ path: testInfo.outputPath('validation.png') });
    await page.locator('#closeLibrary').click();
    await page.evaluate(() => window.planner.actions.reset());
    await expect(page.locator('.planner-empty')).toHaveCSS(
      'background-color',
      surface,
    );
    await page.goto('mainApp.html?customSetup=invalid');
    await expect(page.locator('.planner-feedback')).toBeVisible();
    await expect(page.locator('.planner-feedback')).toHaveCSS(
      'background-color',
      colorScheme === 'dark' ? 'rgb(71, 45, 41)' : 'rgb(255, 243, 240)',
    );
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.locator('#openLibrary').click();
    await expect(page.locator('#libraryPanel')).toBeInViewport();
    await expect(page.locator('#libraryPanel')).toHaveCSS(
      'background-color',
      surface,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(834);
  });
}
