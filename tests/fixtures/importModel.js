export function triangleBytes() {
  const bytes = new ArrayBuffer(36);
  const view = new DataView(bytes);
  [0, 0, 0, 0.254, 0, 0, 0, 0.127, 0.254].forEach((value, index) =>
    view.setFloat32(index * 4, value, true),
  );
  return bytes;
}

export function modelJson(uri) {
  return {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 2] }],
    nodes: [
      { translation: [2, 3, 4], children: [1] },
      { mesh: 0, scale: [2, 1, 1] },
      { name: 'Empty' },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36, ...(uri ? { uri } : {}) }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        type: 'VEC3',
        count: 3,
        min: [0, 0, 0],
        max: [0.254, 0.127, 0.254],
      },
    ],
  };
}

export function selfContainedGltf() {
  const encoded = globalThis.btoa(
    String.fromCharCode(...new Uint8Array(triangleBytes())),
  );
  return modelJson(`data:application/octet-stream;base64,${encoded}`);
}

// Original mathematical fixtures; no downloaded model data (see notices).
export function indexedGltf(count = 6) {
  const bytes = new Uint8Array(36 + count * 2);
  bytes.set(new Uint8Array(triangleBytes()));
  const indices = new DataView(bytes.buffer, 36);
  for (let index = 0; index < count; index++)
    indices.setUint16(index * 2, index % 3, true);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const json = modelJson(
    `data:application/octet-stream;base64,${globalThis.btoa(binary)}`,
  );
  json.buffers[0].byteLength = bytes.length;
  json.bufferViews.push({ buffer: 0, byteOffset: 36, byteLength: count * 2 });
  json.accessors.push({
    bufferView: 1,
    componentType: 5123,
    type: 'SCALAR',
    count,
  });
  json.meshes[0].primitives[0].indices = 1;
  return json;
}

export function triangleGlb() {
  const json = new globalThis.TextEncoder().encode(JSON.stringify(modelJson()));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const binary = new Uint8Array(triangleBytes());
  const bytes = new Uint8Array(28 + paddedLength + binary.length);
  const header = new DataView(bytes.buffer);
  [0x46546c67, 2, bytes.length, paddedLength, 0x4e4f534a].forEach(
    (value, index) => header.setUint32(index * 4, value, true),
  );
  bytes.fill(0x20, 20, 20 + paddedLength);
  bytes.set(json, 20);
  header.setUint32(20 + paddedLength, binary.length, true);
  header.setUint32(24 + paddedLength, 0x004e4942, true);
  bytes.set(binary, 28 + paddedLength);
  return bytes;
}
