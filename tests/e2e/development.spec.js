import { expect, test } from '@playwright/test';
import { createServer } from 'vite';

test('development mounts preserve pages, CSS-relative fonts and model URLs under a subpath', async ({
  page,
}) => {
  const server = await createServer({
    base: '/LayoutCheck/',
    server: { host: '127.0.0.1', port: 5176 },
  });
  const errors = [];
  const failed = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      response.url().startsWith('http://127.0.0.1:5176/') &&
      response.status() >= 400
    )
      failed.push(response.url());
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:5176\/)/, (route) =>
    route.abort(),
  );
  try {
    await server.listen();
    for (const route of ['index.html', 'about.html', 'mainApp.html']) {
      await page.goto(`http://127.0.0.1:5176/LayoutCheck/${route}`);
      await page.evaluate(() => document.fonts.ready);
    }
    const state = await page.evaluate(async () => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href).href
      );
      await app.ready;
      return {
        count: app.state.objects.length,
        link: app.sharing.createLink(),
      };
    });
    expect(state.count).toBe(6);
    expect(state.link).toContain(
      'http://127.0.0.1:5176/LayoutCheck/mainApp.html?',
    );
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  } finally {
    await page.goto('about:blank');
    await server.close();
  }
});
