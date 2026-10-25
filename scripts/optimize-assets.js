import { siteSourcePath } from './site-layout.js';
// Deliberately limited to verified copies of the five startup models.
// No quantization, simplification, resizing, recentering or scene graph flattening.
import { NodeIO } from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  EXTTextureWebP,
} from '@gltf-transform/extensions';
import { weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { format } from 'prettier';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { products } from '../src/catalog/products.js';
import { defaults } from '../src/catalog/configuration.js';

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, EXTTextureWebP])
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
await mkdir(siteSourcePath('optimized-models'), { recursive: true });
await mkdir('docs/performance', { recursive: true });
const manifest = {};
const report = [];
const hash = (data) => createHash('sha256').update(data).digest('hex');

async function fingerprint(doc) {
  const root = doc.getRoot();
  const nodes = root.listNodes();
  const meshes = root.listMeshes();
  const materials = root.listMaterials();
  const textures = root.listTextures();
  return {
    scenes: root
      .listScenes()
      .map((scene) => scene.listChildren().map((node) => nodes.indexOf(node))),
    nodes: nodes.map((node) => ({
      name: node.getName(),
      matrix: node.getMatrix(),
      children: node.listChildren().map((child) => nodes.indexOf(child)),
      mesh: meshes.indexOf(node.getMesh()),
    })),
    meshes: meshes.map((mesh) =>
      mesh.listPrimitives().map((primitive) => {
        const indices = primitive.getIndices();
        const attributes = {};
        const vertexCount =
          indices?.getCount() ?? primitive.getAttribute('POSITION').getCount();
        const order = Uint32Array.from({ length: vertexCount }, (_, i) =>
          indices ? indices.getScalar(i) : i,
        );
        // Meshopt may cyclically rotate a triangle's corners. Canonicalize rotations
        // only: winding, triangle order and all per-corner attributes must still match.
        const compareVertices = (a, b) => {
          for (const semantic of primitive.listSemantics().sort()) {
            const attribute = primitive.getAttribute(semantic);
            const data = attribute.getArray();
            const size = attribute.getElementSize();
            for (let c = 0; c < size; c++) {
              const delta = data[a * size + c] - data[b * size + c];
              if (delta) return delta;
            }
          }
          return 0;
        };
        assert.equal(
          primitive.getMode(),
          4,
          'Only triangle lists are supported',
        );
        for (let t = 0; t < order.length; t += 3) {
          const triangle = Array.from(order.subarray(t, t + 3));
          let best = 0;
          for (let candidate = 1; candidate < 3; candidate++) {
            for (let corner = 0; corner < 3; corner++) {
              const comparison = compareVertices(
                triangle[(candidate + corner) % 3],
                triangle[(best + corner) % 3],
              );
              if (comparison < 0) best = candidate;
              if (comparison !== 0) break;
            }
          }
          for (let c = 0; c < 3; c++) order[t + c] = triangle[(best + c) % 3];
        }
        for (const semantic of primitive.listSemantics()) {
          const accessor = primitive.getAttribute(semantic);
          const data = accessor.getArray();
          const size = accessor.getElementSize();
          const count = indices?.getCount() ?? accessor.getCount();
          const expanded = new data.constructor(count * size);
          for (let i = 0; i < count; i++) {
            const index = order[i];
            expanded.set(
              data.subarray(index * size, (index + 1) * size),
              i * size,
            );
          }
          attributes[semantic] = {
            count,
            type: accessor.getType(),
            normalized: accessor.getNormalized(),
            hash: hash(expanded),
          };
        }
        return {
          mode: primitive.getMode(),
          material: materials.indexOf(primitive.getMaterial()),
          attributes,
        };
      }),
    ),
    materials: materials.map((material) => ({
      name: material.getName(),
      baseColor: material.getBaseColorFactor(),
      metallic: material.getMetallicFactor(),
      roughness: material.getRoughnessFactor(),
      emissive: material.getEmissiveFactor(),
      alpha: material.getAlphaMode(),
      cutoff: material.getAlphaCutoff(),
      doubleSided: material.getDoubleSided(),
      textures: [
        'BaseColor',
        'MetallicRoughness',
        'Normal',
        'Occlusion',
        'Emissive',
      ].map((slot) => textures.indexOf(material[`get${slot}Texture`]())),
    })),
    textures: await Promise.all(
      textures.map(async (texture) => {
        const { data, info } = await sharp(texture.getImage())
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        return { width: info.width, height: info.height, rgba: hash(data) };
      }),
    ),
  };
}

for (const { product } of defaults.filter(
  (item) => products[item.product]?.modelPath,
)) {
  const original = products[product].modelPath;
  const doc = await io.read(siteSourcePath(original));
  const before = await fingerprint(doc);
  await doc.transform(weld()); // Only bitwise-identical vertices merge.
  assert.deepEqual(
    await fingerprint(doc),
    before,
    `${product}: weld changed attributes`,
  );
  for (const texture of doc.getRoot().listTextures()) {
    const image = texture.getImage();
    const webp = await sharp(image)
      .webp({ lossless: true, effort: 6 })
      .toBuffer();
    // Some encoders canonicalize fully transparent RGB; keep the original if so.
    const raw = await sharp(image).ensureAlpha().raw().toBuffer();
    const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
    if (webp.length < image.length && raw.equals(decoded)) {
      texture.setImage(webp).setMimeType('image/webp');
      doc.createExtension(EXTTextureWebP).setRequired(true);
    }
  }
  // QUANTIZE selects the unfiltered codec. We intentionally DO NOT run quantize().
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
    });
  const target = `optimized-models/${product}.glb`;
  const encoded = await io.writeBinary(doc);
  const verified = await io.readBinary(encoded);
  assert.deepEqual(
    await fingerprint(verified),
    before,
    `${product}: visual/coordinate data changed`,
  );
  await writeFile(siteSourcePath(target), encoded);
  const source = await readFile(siteSourcePath(original));
  manifest[original] = target;
  report.push({
    product,
    original,
    target,
    originalBytes: source.length,
    optimizedBytes: encoded.length,
    originalSha256: hash(source),
    optimizedSha256: hash(encoded),
    verified:
      'Exact per-corner attributes, triangle order/winding (cyclic corner rotation allowed), node matrices/hierarchy, material factors and decoded RGBA pixels',
    textureDimensions: before.textures.map(({ width, height }) => [
      width,
      height,
    ]),
  });
  console.log(
    `${product}: ${source.length} -> ${encoded.length} bytes (verified)`,
  );
}
await writeFile(
  'src/catalog/optimizedModels.js',
  await format(
    `// Generated by npm run assets:optimize; original paths remain the source of truth.\nexport const optimizedModels = ${JSON.stringify(manifest, null, 2)};\n`,
    { parser: 'babel', singleQuote: true, trailingComma: 'all' },
  ),
);
await writeFile(
  'docs/performance/optimized-assets.json',
  JSON.stringify(report, null, 2) + '\n',
);
