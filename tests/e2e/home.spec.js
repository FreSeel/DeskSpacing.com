import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
});

for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['laptop', 1280, 720],
  ['tablet', 834, 1112],
  ['phone', 390, 844],
  ['small-phone', 320, 568],
]) {
  test(`home navigation and previews work at ${name} size`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    const failed = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (
        response.url().startsWith('http://127.0.0.1:4173/') &&
        response.status() >= 400
      )
        failed.push(response.url());
    });
    await page.setViewportSize({ width, height });
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open Setup Creator' }),
    ).toBeVisible();
    await expect(page.locator('#setupPreview')).toHaveJSProperty(
      'complete',
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`home-${name}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);

    const menu = page.locator('#siteMenu');
    const summary = menu.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('open', '');
    await expect(
      menu.getByRole('link', { name: 'Beginner Tutorial' }),
    ).toBeVisible();
    const bounds = await menu.locator('.menu-popover').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: testInfo.outputPath(`menu-${name}.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveAttribute('open');
    await expect(summary).toBeFocused();
    await summary.click();
    await page.getByRole('heading', { level: 2 }).click();
    await expect(menu).not.toHaveAttribute('open');

    for (let index = 1; index <= 5; index++) {
      const button = page.getByRole('button', {
        name: `Show setup ${index}:`,
        exact: false,
      });
      await button.focus();
      await page.keyboard.press('Space');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.locator('.example-controls [aria-pressed="true"]'),
      ).toHaveCount(1);
      await expect
        .poll(() =>
          page
            .locator('#setupPreview')
            .evaluate((img) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      await expect(page.locator('#setupCaption')).toContainText(`0${index} /`);
    }
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
}

test('home destinations retain project paths and help opens existing editor dialogs', async ({
  page,
  request,
}) => {
  await page.goto('index.html');
  // Check local destinations as served, including deployment subpaths and images.
  const links = await page
    .locator('a')
    .evaluateAll((items) => items.map((a) => a.href));
  for (const url of new Set(
    links.filter((url) => url.startsWith('http://127.0.0.1:4173/')),
  )) {
    expect(url).toContain('/DeskSpacing.com/');
    expect((await request.get(url)).status(), url).toBe(200);
  }
  for (const destination of [
    'mailto:deskspacing@gmail.com',
    'https://github.com/cooperlappenbusch/DeskSpacing.com',
    'https://twitter.com/DeskSpacing',
    'https://uicookies.com/',
    'https://unsplash.com/',
  ])
    expect(links).toContain(destination);
  const newTabLinks = page.locator('a[target="_blank"]');
  for (const link of await newTabLinks.all())
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

  await page
    .getByRole('link', { name: 'Contact', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/DeskSpacing.com\/about.html$/);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  for (const [label, dialog] of [
    ['Beginner Tutorial', '#tutorialModal'],
    ['Controls / Keybinds', '#exampleModal'],
  ]) {
    await page.locator('#siteMenu summary').click();
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator(dialog)).toBeVisible();
    await page.locator(`${dialog} [data-bs-dismiss="modal"]`).first().click();
    await expect(page.locator(dialog)).toBeHidden();
    await expect(page.locator('#helpMenu summary')).toBeFocused();
    await page.locator('.editor-brand').click();
    await expect(page).toHaveURL(/\/DeskSpacing.com\/index.html$/);
  }
});

test('home remains readable with reduced motion, zoom and without JavaScript', async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.goto('./');
  // A 1280px window at 200% zoom has a 640px CSS viewport.
  await expect(
    page.getByRole('link', { name: 'Open Setup Creator' }),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
  const creator = page.getByRole('link', { name: 'Open Setup Creator' });
  const background = () =>
    creator.evaluate((link) => window.getComputedStyle(link).backgroundColor);
  const resting = await background();
  await creator.hover();
  const hovered = await background();
  expect(hovered).not.toBe(resting);
  await page.mouse.down();
  expect(await background()).not.toBe(hovered);
  // Release outside the link so checking its pressed state does not navigate.
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/DeskSpacing.com\/#main$/);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const staticPage = await context.newPage();
  await staticPage.goto('http://127.0.0.1:4173/DeskSpacing.com/');
  await staticPage.locator('#siteMenu summary').click();
  await expect(
    staticPage.locator('#siteMenu').getByRole('link', { name: 'Contact' }),
  ).toBeVisible();
  await expect(
    staticPage.getByRole('link', { name: 'Open Setup Creator' }),
  ).toHaveAttribute('href', 'mainApp.html');
  await context.close();
});
