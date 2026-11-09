import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import fixtures from '../fixtures/legacy-setups.json' with { type: 'json' };
import { decodeSetup } from '../../src/sharing/legacyCodec.js';
import { patchLegacyThree } from '../../scripts/legacy-three-security.js';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
});

for (const route of ['mainAppMobile.html', 'mainAppOld.html']) {
  for (const [fixture, setup] of Object.entries({
    defaults: null,
    ...fixtures,
  })) {
    test(`${route} renders ${fixture} with r116 models and materials`, async ({
      page,
    }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(
        route + (setup ? `?customSetup=${encodeURIComponent(setup)}` : ''),
      );
      const expected = setup ? decodeSetup(setup) : null;
      await expect
        .poll(() => page.evaluate(() => window.objectsArr?.length))
        .toBe(expected?.length ?? 6);
      await expect
        .poll(() =>
          page.evaluate(() => window.renderer?.info.render.triangles ?? 0),
        )
        .toBeGreaterThan(0);
      const result = await page.evaluate(() => {
        const colors = [];
        let maps = 0;
        for (const object of window.objectsArr)
          object.traverse((node) => {
            if (!node.isMesh) return;
            for (const material of [node.material].flat()) {
              if (material.color) colors.push(material.color.toArray());
              if (material.map) maps++;
            }
          });
        return {
          revision: window.THREE.REVISION,
          records: window.objectsArr.map((object) => ({
            product: object.userData.objectName,
            position: object.position.toArray(),
            rotation: object.rotation.toArray().slice(0, 3),
          })),
          colors,
          maps,
        };
      });
      expect(result.revision).toBe('116');
      expect(result.colors.length).toBeGreaterThan(0);
      expect(result.colors.flat().every(Number.isFinite)).toBe(true);
      expect(result.maps).toBeGreaterThan(0);
      if (expected)
        for (const record of expected) {
          expect(
            result.records.find((item) => item.product === record.product),
          ).toEqual({
            product: record.product,
            position: record.position,
            rotation: record.rotation,
          });
        }
      expect(errors).toEqual([]);
    });
  }

  test(`${route} keeps shared metadata and unrelated URL colors out of setStyle`, async ({
    page,
  }) => {
    // Test-only instrumentation installed before the inline app executes.
    await page.route('**/three.min.js', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          `
        window.colorStyles = [];
        const originalSetStyle = THREE.Color.prototype.setStyle;
        THREE.Color.prototype.setStyle = function (style) {
          window.colorStyles.push(style);
          return originalSetStyle.call(this, style);
        };`,
      });
    });
    const sentinel = 'rgb(1,2,3)';
    const setup = `[ *PrimitiveBox|${sentinel}|0,0,0,|0,0,0,|1,2,3,|null|* ]`;
    await page.goto(
      `${route}?color=${encodeURIComponent(sentinel)}&customSetup=${encodeURIComponent(setup)}#${sentinel}`,
    );
    await expect
      .poll(() => page.evaluate(() => window.objectsArr?.length))
      .toBe(1);
    expect(
      await page.evaluate(() => window.objectsArr[0].userData.objectName),
    ).toBe(sentinel);
    expect(await page.evaluate(() => window.colorStyles)).not.toContain(
      sentinel,
    );
    expect(
      await page.evaluate(() =>
        window.objectsArr[0].children[0].material.color.getHex(),
      ),
    ).toBe(0x202020);
  });
}

test('prototype renders its fixed GLBs and services loads the classic engine', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('testHTMLfile.html');
  await expect
    .poll(() =>
      page.evaluate(() => window.renderer?.info.render.triangles ?? 0),
    )
    .toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.testArr?.length)).toBe(1);
  expect(await page.evaluate(() => window.THREE.REVISION)).toBe('116');
  await page.goto('services.html');
  expect(await page.evaluate(() => window.THREE.REVISION)).toBe('116');
  expect(errors).toEqual([]);
});

test('both historical engine URLs publish the backport and the module executes', async ({
  page,
  request,
}) => {
  for (const name of ['three.min.js', 'three.module.js']) {
    const response = await request.get(name);
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe(
      patchLegacyThree(
        name,
        readFileSync(`node_modules/three-legacy/build/${name}`),
      ),
    );
  }
  await page.goto('about.html');
  expect(
    await page.evaluate(async () => {
      const { Color, REVISION } = await import(
        new URL('three.module.js', window.location.href).href
      );
      return [REVISION, new Color('rgb( 255,0,0)').getHex()];
    }),
  ).toEqual(['116', 0xff0000]);
});
