import { Box3, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { centimetersPerInch } from '../measurements/units.js';
import { httpAssetUrl } from './importSource.js';
import { readGltf, validateGltf } from './gltfValidation.js';
import { disposeResources } from './resources.js';

export const importLimits = Object.freeze({
  maxBytes: 32 * 1024 * 1024,
  maxVertices: 250_000,
  maxIndices: 750_000,
  maxPrimitives: 512,
  maxEntries: 4096,
  maxImages: 32,
  maxTextureSide: 4096,
  maxTexturePixels: 16_777_216,
  timeoutMs: 30_000,
});

const inchesPerMeter = 100 / centimetersPerInch;

async function readResponse(response, limit) {
  if (!response.ok)
    throw new Error(`Model resource returned HTTP ${response.status}.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Model resource has no response body.');
  const chunks = [];
  let length = 0;
  try {
    if (Number(response.headers.get('content-length')) > limit)
      throw new Error('The model exceeds the download size limit.');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit)
        throw new Error('The model exceeds the download size limit.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function embeddedResource(uri, limit) {
  const encoded = /^data:[a-z0-9/+.-]*;base64,([a-z0-9+/=]+)$/i.exec(uri)?.[1];
  if (!encoded)
    throw new Error('Embedded glTF resources must use base64 data URIs.');
  if (encoded.length > Math.ceil(limit / 3) * 4)
    throw new Error('The model exceeds the decoded resource size limit.');
  const binary = globalThis.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

// Read dimensions before decoding so a tiny compressed file cannot request a
// huge bitmap allocation. Core glTF supports PNG and JPEG.
function imageHeader(bytes) {
  const view = new DataView(bytes);
  if (
    view.byteLength >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a &&
    view.getUint32(12) === 0x49484452
  )
    return ['image/png', view.getUint32(16), view.getUint32(20)];
  if (view.byteLength >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= view.byteLength && view.getUint8(offset) === 0xff) {
      const marker = view.getUint8(offset + 1);
      if (marker === 0xff) {
        offset++;
        continue;
      }
      const size = view.getUint16(offset + 2);
      if (size < 2 || offset + 2 + size > view.byteLength || marker === 0xda)
        break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8)
        return [
          'image/jpeg',
          view.getUint16(offset + 7),
          view.getUint16(offset + 5),
        ];
      offset += 2 + size;
    }
  }
  throw new Error(
    'The model has an invalid or unsupported texture. Use PNG or JPEG.',
  );
}

function parseGeometry(json, buffers, images, resources) {
  const pending = new Set();
  const track = (promise, collect) => {
    pending.add(promise);
    promise.then(collect, () => {}).finally(() => pending.delete(promise));
    return promise;
  };
  const loader = new GLTFLoader();
  loader.register((parser) => {
    // All bytes and decoded images have already passed the import boundary.
    // GLTFLoader only assembles geometry and materials here.
    parser.loadBuffer = async (index) => buffers[index];
    parser.loadImageSource = async (index) => {
      const image = images[index];
      if (!image) throw new Error('Missing glTF image.');
      const texture = new Texture(image);
      texture.needsUpdate = true;
      resources.add(texture);
      return texture;
    };
    const getDependency = parser.getDependency.bind(parser);
    parser.getDependency = (type, index) =>
      track(getDependency(type, index), (result) => {
        if (type === 'mesh' || result?.isMaterial || result?.isTexture)
          resources.add(result);
      });
    const loadGeometries = parser.loadGeometries.bind(parser);
    parser.loadGeometries = (primitives) =>
      track(loadGeometries(primitives), (geometries) =>
        geometries.forEach((geometry) => resources.add(geometry)),
      );
    return { name: 'DeskSpacingImport' };
  });
  return loader.parseAsync(json, '').finally(async () => {
    // A rejected parse may still have parallel mesh/material work in flight.
    while (pending.size) await Promise.allSettled([...pending]);
  });
}

function modelBounds(root) {
  const geometries = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    geometries.add(object.geometry);
  });
  for (const geometry of geometries) {
    const position = geometry.getAttribute('position');
    for (const attribute of Object.values(geometry.attributes)) {
      const data = attribute.array || attribute.data.array;
      if (!data.every(Number.isFinite))
        throw new Error('The model has non-finite vertex data.');
    }
    const indices = geometry.index;
    if (indices && indices.array.some((index) => index >= position.count))
      throw new Error('The model has out-of-range triangle indices.');
    geometry.computeBoundingBox();
  }
  const bounds = new Box3().setFromObject(root, true);
  const size = bounds.getSize(new Vector3()).multiplyScalar(inchesPerMeter);
  if (
    bounds.isEmpty() ||
    [...bounds.min.toArray(), ...bounds.max.toArray()].some(
      (value) => !Number.isFinite(value) || Math.abs(value) > 1e7,
    ) ||
    size.toArray().filter((value) => value > 1e-6).length < 2 ||
    Math.max(...size.toArray()) > 100_000
  )
    throw new Error('The model has empty, invalid, or excessive bounds.');
  const center = bounds.getCenter(new Vector3());
  center.y = bounds.min.y;
  return center.multiplyScalar(-inchesPerMeter).toArray();
}

export function createImportLoader({
  fetch = globalThis.fetch.bind(globalThis),
  decodeImage = (...args) => globalThis.createImageBitmap(...args),
  limits: overrides,
} = {}) {
  const limits = { ...importLimits, ...overrides };
  return async function load(source, blob, cancelSignal) {
    const signal = globalThis.AbortSignal.any([
      cancelSignal,
      globalThis.AbortSignal.timeout(limits.timeoutMs),
    ]);
    let base;
    let used = 0;
    let decodedPixels = 0;
    let root;
    const resources = new Set();
    const images = [];
    const dependencies = new Map();
    function charge(length) {
      used += length;
      if (used > limits.maxBytes)
        throw new Error('The model and its resources exceed the size limit.');
    }
    async function download(url) {
      const response = await fetch(url, {
        signal,
        mode: 'cors',
        credentials: 'omit',
      });
      return {
        bytes: await readResponse(response, limits.maxBytes - used),
        url: response.url || url,
      };
    }
    async function resource(uri) {
      if (typeof uri !== 'string' || !uri)
        throw new Error('A glTF resource URI is missing.');
      const embedded = uri.startsWith('data:');
      if (!embedded && !base)
        throw new Error(
          'This local model references external files. Export it as a self-contained .gltf or .glb.',
        );
      const key = embedded ? uri : httpAssetUrl(uri, base).href;
      if (!dependencies.has(key)) {
        const bytes = embedded
          ? embeddedResource(uri, limits.maxBytes)
          : (await download(key)).bytes;
        charge(bytes.byteLength);
        dependencies.set(key, bytes);
      }
      return dependencies.get(key);
    }
    try {
      signal.throwIfAborted();
      let bytes;
      if (source.kind === 'local') {
        if (!blob)
          throw new Error(
            'The local model file is missing. Choose the original file to recover it.',
          );
        if (blob.size > limits.maxBytes)
          throw new Error('The model file exceeds the size limit.');
        bytes = await blob.arrayBuffer();
      } else {
        const response = await download(httpAssetUrl(source.url).href);
        bytes = response.bytes;
        base = httpAssetUrl(response.url).href;
      }
      signal.throwIfAborted();
      charge(bytes.byteLength);
      const { json, binary } = readGltf(bytes, source.format);
      validateGltf(json, limits);
      if (json.images.length > limits.maxImages)
        throw new Error('The model has too many textures.');
      const buffers = [];
      for (const [index, buffer] of json.buffers.entries()) {
        const embedded = index === 0 && buffer.uri === undefined && binary;
        const data = embedded || (await resource(buffer.uri));
        if (
          data.byteLength < buffer.byteLength ||
          data.byteLength - buffer.byteLength > (embedded ? 3 : 0)
        )
          throw new Error('A glTF buffer does not match its declared size.');
        buffers.push(data);
      }
      for (const image of json.images) {
        signal.throwIfAborted();
        const view = json.bufferViews[image.bufferView];
        if (
          (image.bufferView !== undefined && !view) ||
          (image.bufferView !== undefined && image.uri !== undefined)
        )
          throw new Error('Invalid glTF texture source.');
        const offset = view?.byteOffset ?? 0;
        const data = view
          ? buffers[view.buffer].slice(offset, offset + view.byteLength)
          : await resource(image.uri);
        const [mimeType, width, height] = imageHeader(data);
        decodedPixels += width * height;
        if (
          !width ||
          !height ||
          width > limits.maxTextureSide ||
          height > limits.maxTextureSide ||
          decodedPixels > limits.maxTexturePixels
        )
          throw new Error('The model exceeds the decoded texture size limit.');
        if (image.mimeType && image.mimeType !== mimeType)
          throw new Error('Invalid glTF texture type.');
        images.push(
          await decodeImage(new globalThis.Blob([data], { type: mimeType }), {
            colorSpaceConversion: 'none',
            premultiplyAlpha: 'none',
          }),
        );
      }
      signal.throwIfAborted();
      ({ scene: root } = await parseGeometry(json, buffers, images, resources));
      signal.throwIfAborted();
      const offset = modelBounds(root);
      return {
        root,
        offset,
        scale: inchesPerMeter,
        dispose: () => disposeResources(root, resources, images),
      };
    } catch (cause) {
      disposeResources(root, resources, images);
      if (signal.aborted) {
        if (signal.reason.name === 'TimeoutError')
          throw new Error('Model import timed out. Try again.', { cause });
        throw signal.reason;
      }
      const message =
        cause instanceof TypeError && source.kind === 'remote'
          ? 'Could not load the remote model or a dependency. Check the direct URL and server CORS settings.'
          : cause instanceof SyntaxError
            ? 'The model contains invalid glTF JSON.'
            : cause.message;
      throw new Error(message || 'Could not import the model.', { cause });
    }
  };
}
