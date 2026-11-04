const supportedExtensions = new Set([
  'KHR_materials_unlit',
  'KHR_texture_transform',
  'KHR_mesh_quantization',
  'KHR_materials_clearcoat',
  'KHR_materials_ior',
  'KHR_materials_specular',
  'KHR_materials_sheen',
  'KHR_materials_transmission',
  'KHR_materials_volume',
  'KHR_materials_emissive_strength',
  'KHR_materials_iridescence',
  'KHR_materials_anisotropy',
  'KHR_materials_dispersion',
]);

function requireModel(condition, message) {
  if (!condition) throw new Error(message);
}

const validInt = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;

function validateExtensions(names) {
  for (const name of names)
    requireModel(
      supportedExtensions.has(name),
      `Unsupported glTF extension: ${name}.`,
    );
}

export function readGltf(bytes, format) {
  let jsonBytes = new Uint8Array(bytes);
  let binary;
  if (format === 'glb') {
    const header = new DataView(bytes);
    requireModel(
      bytes.byteLength >= 20 &&
        header.getUint32(0, true) === 0x46546c67 &&
        header.getUint32(4, true) === 2 &&
        header.getUint32(8, true) === bytes.byteLength,
      'Invalid GLB header.',
    );
    let offset = 12;
    let json;
    while (offset < bytes.byteLength) {
      requireModel(offset + 8 <= bytes.byteLength, 'Truncated GLB chunk.');
      const size = header.getUint32(offset, true);
      const type = header.getUint32(offset + 4, true);
      const end = offset + 8 + size;
      requireModel(
        size % 4 === 0 && end <= bytes.byteLength,
        'Invalid GLB chunk size.',
      );
      if (offset === 12) {
        requireModel(type === 0x4e4f534a, 'GLB must start with a JSON chunk.');
        json = jsonBytes.subarray(offset + 8, end);
      } else if (type === 0x004e4942) {
        requireModel(
          !binary && offset === 20 + json.length,
          'Invalid GLB binary chunk.',
        );
        binary = bytes.slice(offset + 8, end);
      }
      offset = end;
    }
    jsonBytes = json;
  }
  const json = JSON.parse(
    new globalThis.TextDecoder('utf-8', { fatal: true }).decode(jsonBytes),
    (key, value) => {
      requireModel(
        !['__proto__', 'constructor', 'prototype'].includes(key),
        'Invalid glTF property.',
      );
      // Extras can populate Object3D.userData. Keep planner metadata under our control.
      if (key === 'extras') return undefined;
      requireModel(
        typeof value !== 'number' || Number.isFinite(value),
        'Non-finite glTF value.',
      );
      if (key === 'extensions') validateExtensions(Object.keys(value));
      return value;
    },
  );
  requireModel(
    json?.asset?.version === '2.0' &&
      [undefined, '2.0'].includes(json.asset.minVersion),
    'Expected a glTF 2.0 asset.',
  );
  validateExtensions(json.extensionsUsed || []);
  validateExtensions(json.extensionsRequired || []);
  return { json, binary };
}

const componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function validateGltf(json, limits) {
  for (const key of [
    'scenes',
    'nodes',
    'meshes',
    'buffers',
    'bufferViews',
    'accessors',
    'images',
    'textures',
    'samplers',
    'materials',
  ]) {
    const entries = json[key] ?? [];
    requireModel(
      Array.isArray(entries) &&
        entries.length <= limits.maxEntries &&
        entries.every(
          (entry) =>
            entry && typeof entry === 'object' && !Array.isArray(entry),
        ),
      `Invalid or excessive glTF ${key}.`,
    );
    json[key] = entries;
  }
  requireModel(
    !json.skins?.length,
    'Skinned meshes are unsupported for model imports.',
  );
  const scene = json.scenes[json.scene ?? 0];
  requireModel(
    Array.isArray(scene?.nodes) && scene.nodes.length > 0,
    'The model has no scene objects.',
  );
  // Load the default scene as static geometry, without lighting/camera side effects.
  json.scenes = [scene];
  json.scene = 0;
  delete json.animations;
  delete json.cameras;

  for (const image of json.images)
    requireModel(
      image.bufferView === undefined ||
        validInt(image.bufferView, 0, json.bufferViews.length - 1),
      'Invalid glTF image buffer view.',
    );
  for (const texture of json.textures)
    requireModel(
      validInt(texture.source, 0, json.images.length - 1),
      'A glTF texture is missing its image.',
    );

  for (const buffer of json.buffers)
    requireModel(
      validInt(buffer.byteLength, 1, limits.maxBytes),
      'Invalid or excessive glTF buffer size.',
    );
  let viewBytes = 0;
  for (const view of json.bufferViews) {
    const buffer = json.buffers[view.buffer];
    requireModel(
      buffer &&
        validInt(view.byteOffset ?? 0, 0, buffer.byteLength) &&
        validInt(
          view.byteLength,
          1,
          buffer.byteLength - (view.byteOffset ?? 0),
        ),
      'A glTF buffer view extends past its buffer.',
    );
    viewBytes += view.byteLength;
    requireModel(
      viewBytes <= limits.maxBytes,
      'The model exceeds the buffer view budget.',
    );
  }

  for (const accessor of json.accessors) {
    const component = componentBytes[accessor.componentType];
    const width = components[accessor.type] * component;
    requireModel(
      Number.isFinite(width) && validInt(accessor.count, 1, limits.maxVertices),
      'Invalid or excessive glTF accessor.',
    );
    requireModel(!accessor.sparse, 'Sparse glTF accessors are unsupported.');
    const view = json.bufferViews[accessor.bufferView];
    const offset = accessor.byteOffset ?? 0;
    const stride = view?.byteStride ?? width;
    requireModel(
      view &&
        validInt(stride, width, 252) &&
        validInt(offset, 0, view.byteLength) &&
        offset + (accessor.count - 1) * stride + width <= view.byteLength,
      'A glTF accessor extends past its buffer view.',
    );
  }

  function validateMaterial(value, depth) {
    if (!value || typeof value !== 'object') return;
    requireModel(depth <= 16, 'Invalid glTF material.');
    if (Object.hasOwn(value, 'index'))
      requireModel(
        validInt(value.index, 0, json.textures.length - 1),
        'Invalid glTF material texture reference.',
      );
    for (const property of Object.values(value))
      validateMaterial(property, depth + 1);
  }
  for (const material of json.materials) validateMaterial(material, 0);

  const meshCosts = json.meshes.map(({ primitives }) => {
    requireModel(
      Array.isArray(primitives) &&
        primitives.length > 0 &&
        primitives.length <= limits.maxEntries,
      'Invalid glTF mesh primitives.',
    );
    return primitives.map(
      ({ attributes, indices, material, mode, targets }) => {
        requireModel(
          material === undefined ||
            validInt(material, 0, json.materials.length - 1),
          'Invalid glTF material reference.',
        );
        const position = json.accessors[attributes?.POSITION];
        requireModel(
          (mode ?? 4) === 4 && !targets?.length,
          'Only static glTF triangle meshes are supported.',
        );
        requireModel(
          position?.type === 'VEC3' && position.count >= 3,
          'A glTF mesh has no triangle positions.',
        );
        const attributesUsed = Object.values(attributes);
        requireModel(
          attributesUsed.length <= 16 &&
            attributesUsed.every(
              (index) => json.accessors[index]?.count === position.count,
            ),
          'Invalid glTF vertex attributes.',
        );
        const index = indices === undefined ? null : json.accessors[indices];
        requireModel(
          indices === undefined ||
            (index?.type === 'SCALAR' &&
              [5121, 5123, 5125].includes(index.componentType) &&
              !index.normalized),
          'Invalid glTF triangle indices.',
        );
        const count = index?.count ?? position.count;
        requireModel(
          count >= 3 && count % 3 === 0,
          'Incomplete glTF triangle.',
        );
        return { vertices: position.count, indices: count };
      },
    );
  });

  let vertices = 0;
  let indices = 0;
  let primitives = 0;
  const visited = new Set();
  function visit(index, depth) {
    requireModel(
      validInt(index, 0, json.nodes.length - 1) &&
        !visited.has(index) &&
        depth <= 64,
      'Invalid or excessively nested glTF scene graph.',
    );
    visited.add(index);
    const node = json.nodes[index];
    requireModel(
      node.skin === undefined && !node.weights,
      'Skins and morph targets are unsupported.',
    );
    delete node.camera;
    for (const [key, length] of Object.entries({
      translation: 3,
      rotation: 4,
      scale: 3,
      matrix: 16,
    })) {
      const vector = node[key];
      requireModel(
        vector === undefined ||
          (Array.isArray(vector) &&
            vector.length === length &&
            vector.every(
              (value) => Number.isFinite(value) && Math.abs(value) <= 1e8,
            )),
        'Invalid glTF node transform.',
      );
    }
    if (node.mesh !== undefined) {
      const costs = meshCosts[node.mesh];
      requireModel(Array.isArray(costs), 'Invalid glTF mesh reference.');
      primitives += costs.length;
      for (const cost of costs) {
        vertices += cost.vertices;
        indices += cost.indices;
      }
      requireModel(
        vertices <= limits.maxVertices &&
          indices <= limits.maxIndices &&
          primitives <= limits.maxPrimitives,
        'The model exceeds the geometry budget.',
      );
    }
    requireModel(
      node.children === undefined || Array.isArray(node.children),
      'Invalid glTF child list.',
    );
    for (const child of node.children || []) visit(child, depth + 1);
  }
  for (const index of scene.nodes) visit(index, 0);
  requireModel(primitives > 0, 'The model contains no renderable meshes.');
}
