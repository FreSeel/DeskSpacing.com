import fs from 'node:fs';
import sharp from 'sharp';
const median = (a) => a.toSorted((a, b) => a - b)[Math.floor(a.length / 2)];
const results = {};
const labels = [process.argv[2] || 'baseline', process.argv[3] || 'after'];
for (const label of labels) {
  const path = `docs/performance/${label}.json`;
  const d = JSON.parse(fs.readFileSync(path));
  const field = (f) => ({
    median: median(d.results.map(f)),
    values: d.results.map(f),
  });
  results[label] = {
    landing: field((r) => r.landingLoadMs),
    load: field((r) => r.startup.navigation.loadEventEnd),
    ready: field((r) => r.startup.editorReadyMs),
    scene: field((r) => r.startup.sceneInitMs),
    requests: field((r) => r.startup.resources.length),
    encoded: field((r) =>
      r.startup.resources.reduce((n, x) => n + x.encoded, 0),
    ),
    transfer: field((r) =>
      r.startup.resources.reduce((n, x) => n + x.transfer, 0),
    ),
    js: field((r) => r.scripts.reduce((n, x) => n + x.bytes, 0)),
    gz: field((r) => r.scripts.reduce((n, x) => n + x.gzipBytes, 0)),
    idle: field((r) => r.idle.samples.length),
    orbitFps: field(
      (r) => (r.orbit.samples.length / r.orbit.durationMs) * 1000,
    ),
    renderCpu: field((r) => median(r.orbit.samples.map((s) => s.cpuMs))),
    renderFrameGap: field((r) =>
      median(
        r.orbit.samples
          .slice(1)
          .map((s, i) => s.time - r.orbit.samples[i].time),
      ),
    ),
    calls: field((r) => r.idle.resources.render.calls),
    triangles: field((r) => r.idle.resources.render.triangles),
    geometry: field((r) => r.beforeDuplicates.memory.geometries),
    textures: field((r) => r.beforeDuplicates.memory.textures),
    heap: field((r) => r.beforeDuplicates.heapBytes),
    dupGeometry: field((r) => r.duplicates.resources.memory.geometries),
    dupHeap: field((r) => r.duplicates.resources.heapBytes),
    dupTime: field((r) => r.duplicates.durationMs),
    deleteHeap: field((r) => r.afterDelete.heapBytes),
    disposed: d.results.map((r) => r.disposed),
    errors: d.results.map((r) => r.errors),
  };
}
const [before, after] = await Promise.all(
  labels.map((label) =>
    sharp(`docs/performance/${label}-default.png`)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ),
);
if (
  before.info.width !== after.info.width ||
  before.info.height !== after.info.height
)
  throw new Error('Screenshot dimensions must match.');
let sum = 0,
  changed = 0,
  over5 = 0,
  over20 = 0,
  maximum = 0;
for (let i = 0; i < before.data.length; i += 3) {
  let pixel = 0;
  for (let c = 0; c < 3; c++) {
    const difference = Math.abs(before.data[i + c] - after.data[i + c]);
    sum += difference;
    pixel = Math.max(pixel, difference);
    maximum = Math.max(maximum, difference);
  }
  if (pixel) changed++;
  if (pixel > 5) over5++;
  if (pixel > 20) over20++;
}
const pixels = before.info.width * before.info.height;
const scenes = labels.map(
  (label) =>
    JSON.parse(fs.readFileSync(`docs/performance/${label}.json`)).results[0]
      .idle.resources,
);
results.visual = {
  width: before.info.width,
  height: before.info.height,
  pixels,
  meanAbsoluteChannelDifference: sum / before.data.length,
  changedPixels: changed,
  pixelsOver5: over5,
  percentOver5: (over5 / pixels) * 100,
  pixelsOver20: over20,
  maxChannelDifference: maximum,
  sameTransforms:
    JSON.stringify(
      scenes[0].objects.toSorted((a, b) => a.product.localeCompare(b.product)),
    ) ===
    JSON.stringify(
      scenes[1].objects.toSorted((a, b) => a.product.localeCompare(b.product)),
    ),
  sameCamera:
    JSON.stringify(scenes[0].camera) === JSON.stringify(scenes[1].camera),
};
fs.writeFileSync(
  `docs/performance/${labels.join('-vs-')}.json`,
  JSON.stringify(results, null, 2) + '\n',
);
console.log(JSON.stringify(results, null, 2));
