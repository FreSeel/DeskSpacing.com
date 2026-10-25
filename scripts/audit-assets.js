import { siteSourcePath } from './site-layout.js';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { products, textures } from '../src/catalog/products.js';

const models = [];
for (const file of [
  ...new Set(
    Object.values(products)
      .map((product) => product.modelPath)
      .filter(Boolean),
  ),
]) {
  let bytes;
  try {
    bytes = await readFile(siteSourcePath(file));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    models.push({ path: file, missing: true });
    continue;
  }
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  const images = [];
  for (const image of json.images || []) {
    const view = json.bufferViews[image.bufferView];
    const data = bytes.subarray(
      binaryStart + (view.byteOffset || 0),
      binaryStart + (view.byteOffset || 0) + view.byteLength,
    );
    const { width, height, format } = await sharp(data).metadata();
    images.push({ width, height, format, bytes: data.length });
  }
  models.push({
    path: file,
    bytes: bytes.length,
    triangles: json.meshes.reduce(
      (count, mesh) =>
        count +
        mesh.primitives.reduce(
          (sum, primitive) =>
            sum +
            json.accessors[primitive.indices ?? primitive.attributes.POSITION]
              .count /
              3,
          0,
        ),
      0,
    ),
    roots: json.scenes[json.scene || 0].nodes.length,
    skins: json.skins?.length || 0,
    extensions: json.extensionsUsed || [],
    images,
  });
}
const images = [];
for (const file of [
  ...new Set([
    ...Object.values(textures),
    ...(await readdir(siteSourcePath('Model thumbnails'))).map((name) =>
      path.join('Model thumbnails', name),
    ),
    ...(await readdir(siteSourcePath('Click Through Tutorial'))).map((name) =>
      path.join('Click Through Tutorial', name),
    ),
  ]),
]) {
  if (!/\.(png|jpe?g|gif|webp)$/i.test(file)) continue;
  const bytes = await readFile(siteSourcePath(file));
  const { width, height, format, pages } = await sharp(bytes).metadata();
  images.push({
    path: file,
    bytes: bytes.length,
    width,
    height,
    format,
    pages: pages || 1,
  });
}
await mkdir('docs/performance', { recursive: true });
await writeFile(
  'docs/performance/assets.json',
  JSON.stringify({ models, images }, null, 2) + '\n',
);
console.log(
  `${models.length} catalog paths; ${models.filter((model) => model.missing).length} missing; ${models.reduce((n, model) => n + (model.bytes || 0), 0)} original GLB bytes`,
);
