function collectMaterial(material, resources) {
  resources.add(material);
  for (const value of Object.values(material)) {
    if (value?.isTexture) resources.add(value);
  }
}

function collectResources(root, resources = new Set()) {
  root?.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    if (object.skeleton) resources.add(object.skeleton);
    for (const material of [object.material].flat().filter(Boolean)) {
      collectMaterial(material, resources);
    }
  });
  return resources;
}

export function estimateResourceBytes(root) {
  let bytes = 0;
  const arrays = new Set();
  const images = new Set();
  for (const resource of collectResources(root)) {
    if (resource.isBufferGeometry) {
      for (const attribute of [
        ...Object.values(resource.attributes),
        resource.index,
      ].filter(Boolean))
        arrays.add(attribute.array || attribute.data?.array);
    }
    if (resource.isTexture && resource.image) images.add(resource.image);
  }
  for (const array of arrays) bytes += array?.byteLength || 0;
  for (const image of images)
    bytes += ((image.width || 0) * (image.height || 0) * 4 * 4) / 3;
  return bytes;
}

export function disposeResources(root, additional = [], decodedImages = []) {
  const resources = collectResources(root);
  for (const resource of additional) {
    if (resource.isObject3D) collectResources(resource, resources);
    else if (resource.isMaterial) collectMaterial(resource, resources);
    else resources.add(resource);
  }
  const images = new Set(decodedImages.filter((image) => image.close));
  for (const resource of resources) {
    if (resource.isTexture && resource.image?.close) images.add(resource.image);
  }
  for (const resource of resources) resource.dispose();
  // Modern GLTFLoader uses ImageBitmap; texture.dispose() doesn't close it.
  for (const image of images) image.close();
}
