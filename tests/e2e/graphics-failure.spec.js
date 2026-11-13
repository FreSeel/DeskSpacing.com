import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
});

test('normal startup keeps the editor and renderer available', async ({
  page,
}) => {
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  const ready = await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    await app.ready;
    return Boolean(app.view.renderer.getContext());
  });
  expect(ready).toBe(true);
  await expect(page.locator('#graphicsFailure')).toBeHidden();
  await expect(page.locator('#threeCanvas')).toHaveAttribute(
    'aria-busy',
    'false',
  );
});

test('WebGL2 unavailable shows a keyboard-accessible reload state', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = globalThis.HTMLCanvasElement.prototype.getContext;
    globalThis.HTMLCanvasElement.prototype.getContext = function (
      kind,
      ...args
    ) {
      if (kind === 'webgl2') return null;
      return getContext.call(this, kind, ...args);
    };
  });
  await page.goto('mainApp.html');
  const failure = page.locator('#graphicsFailure');
  await expect(failure).toBeVisible();
  await expect(failure).toBeFocused();
  await expect(failure).toContainText('WebGL2 graphics support');
  await expect(
    failure.getByRole('button', { name: 'Reload editor' }),
  ).toBeVisible();
  await expect(page.locator('.editor-shell')).toHaveAttribute('inert', '');
  expect(
    await page.evaluate(async () => (await import('./src/main.js')).app),
  ).toBeNull();
});

test('renderer construction error uses the same safe state', async ({
  page,
}) => {
  await page.addInitScript(() => {
    globalThis.HTMLCanvasElement.prototype.getContext = () => {
      throw new Error('Simulated renderer exception');
    };
  });
  await page.goto('mainApp.html');
  await expect(page.locator('#graphicsFailure')).toBeVisible();
  await expect(page.locator('#graphicsFailure')).not.toContainText(
    'Simulated renderer exception',
  );
});

test('partial scene initialization releases renderer listeners', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const added = new Map();
    const removed = new Map();
    const add = globalThis.HTMLCanvasElement.prototype.addEventListener;
    const remove = globalThis.HTMLCanvasElement.prototype.removeEventListener;
    globalThis.HTMLCanvasElement.prototype.addEventListener = function (
      name,
      ...rest
    ) {
      if (name.startsWith('webglcontext'))
        added.set(name, (added.get(name) || 0) + 1);
      return add.call(this, name, ...rest);
    };
    globalThis.HTMLCanvasElement.prototype.removeEventListener = function (
      name,
      ...rest
    ) {
      if (name.startsWith('webglcontext'))
        removed.set(name, (removed.get(name) || 0) + 1);
      return remove.call(this, name, ...rest);
    };
    globalThis.graphicsListeners = { added, removed };
    globalThis.ResizeObserver = class {
      observe() {
        throw new Error('Simulated partial startup failure');
      }
      disconnect() {
        globalThis.observerDisconnected = true;
      }
    };
  });
  await page.goto('mainApp.html');
  await expect(page.locator('#graphicsFailure')).toBeVisible();
  const result = await page.evaluate(() => ({
    added: [...globalThis.graphicsListeners.added],
    removed: [...globalThis.graphicsListeners.removed],
    disconnected: globalThis.observerDisconnected,
  }));
  expect(
    result.removed.filter(([name]) => name.startsWith('webglcontext')),
  ).toEqual(result.added.filter(([name]) => name.startsWith('webglcontext')));
  expect(result.disconnected).toBe(true);
});

test('later startup failure tears down the created scene and UI services', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const added = new Map();
    const removed = new Map();
    const add = globalThis.HTMLCanvasElement.prototype.addEventListener;
    const remove = globalThis.HTMLCanvasElement.prototype.removeEventListener;
    globalThis.HTMLCanvasElement.prototype.addEventListener = function (
      name,
      ...rest
    ) {
      added.set(name, (added.get(name) || 0) + 1);
      return add.call(this, name, ...rest);
    };
    globalThis.HTMLCanvasElement.prototype.removeEventListener = function (
      name,
      ...rest
    ) {
      removed.set(name, (removed.get(name) || 0) + 1);
      return remove.call(this, name, ...rest);
    };
    globalThis.canvasListeners = { added, removed };
  });
  await page.route('**/mainApp.html', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        'id="redoTransform"',
        'id="missingRedo"',
      ),
    });
  });
  await page.goto('mainApp.html');
  await expect(page.locator('#graphicsFailure')).toBeVisible();
  const result = await page.evaluate(() => ({
    added: [...globalThis.canvasListeners.added],
    removed: [...globalThis.canvasListeners.removed],
    feedback: document.querySelectorAll('.planner-feedback').length,
  }));
  expect(
    result.removed.filter(([name]) => name.startsWith('webglcontext')),
  ).toEqual(result.added.filter(([name]) => name.startsWith('webglcontext')));
  expect(result.feedback).toBe(0);
});

test('simulated context loss pauses editing and clears only after a restored frame', async ({
  page,
}) => {
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => (await import('./src/main.js')).app.ready);
  await page.locator('#threeCanvas').evaluate((canvas) => {
    canvas.dispatchEvent(
      new globalThis.Event('webglcontextlost', { cancelable: true }),
    );
  });
  await expect(page.locator('#graphicsFailure')).toBeVisible();
  await expect(page.locator('.editor-shell')).toHaveAttribute('inert', '');
  await page.locator('#threeCanvas').evaluate((canvas) => {
    canvas.dispatchEvent(new globalThis.Event('webglcontextrestored'));
  });
  await expect(page.locator('#graphicsFailure')).toBeHidden();
  await expect(page.locator('.editor-shell')).not.toHaveAttribute('inert');
  await expect(page.locator('#threeCanvas')).toBeFocused();
  const count = await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    await app.actions.add('defaultMouse');
    return app.state.objects.length;
  });
  expect(count).toBe(1);
});

test('context loss keeps recovery controls reachable while a dialog is open', async ({
  page,
}) => {
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => (await import('./src/main.js')).app.ready);
  await page.locator('#moreMenu summary').click();
  await page.locator('#moreMenu [data-bs-target="#projectsModal"]').click();
  await expect(page.locator('#projectsModal')).toBeVisible();
  await page.locator('#threeCanvas').evaluate((canvas) => {
    canvas.dispatchEvent(
      new globalThis.Event('webglcontextlost', { cancelable: true }),
    );
  });
  await expect(page.locator('#graphicsFailure')).toBeVisible();
  await expect(page.locator('#graphicsFailure')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#retryGraphics')).toBeFocused();
});

test('visibility changes do not resume rendering before context restoration', async ({
  page,
}) => {
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    await app.ready;
    const renderer = app.view.renderer;
    const render = renderer.render.bind(renderer);
    window.renderCount = 0;
    renderer.render = (...args) => {
      window.renderCount++;
      return render(...args);
    };
    const canvas = document.getElementById('threeCanvas');
    canvas.dispatchEvent(
      new globalThis.Event('webglcontextlost', { cancelable: true }),
    );
    window.renderCount = 0;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new globalThis.Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new globalThis.Event('visibilitychange'));
    app.view.invalidateScene();
    await new Promise((resolve) =>
      globalThis.requestAnimationFrame(() =>
        globalThis.requestAnimationFrame(resolve),
      ),
    );
  });
  expect(await page.evaluate(() => window.renderCount)).toBe(0);
  await page.locator('#threeCanvas').evaluate((canvas) => {
    canvas.dispatchEvent(new globalThis.Event('webglcontextrestored'));
  });
  await expect(page.locator('#graphicsFailure')).toBeHidden();
  expect(await page.evaluate(() => window.renderCount)).toBeGreaterThan(0);
});

test('restored event keeps failure visible while the context still reports lost', async ({
  page,
}) => {
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => {
    const { app } = await import('./src/main.js');
    await app.ready;
    const originalGetContext = app.view.renderer.getContext.bind(
      app.view.renderer,
    );
    window.graphicsRecoveryBlocked = true;
    app.view.renderer.getContext = () => ({
      isContextLost: () => window.graphicsRecoveryBlocked,
    });
    window.restoreRendererContext = () => {
      app.view.renderer.getContext = originalGetContext;
      app.view.invalidateScene();
    };
  });
  await page.locator('#threeCanvas').evaluate((canvas) => {
    canvas.dispatchEvent(
      new globalThis.Event('webglcontextlost', { cancelable: true }),
    );
    canvas.dispatchEvent(new globalThis.Event('webglcontextrestored'));
  });
  await expect(page.locator('#graphicsFailure')).toBeVisible();
  await page.evaluate(() => window.restoreRendererContext());
  await expect(page.locator('#graphicsFailure')).toBeHidden();
});
