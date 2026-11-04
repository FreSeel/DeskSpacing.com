import { describeProduct } from '../catalog/presentation.js';

export function describeObject(object) {
  const { asset, missingAsset, objectName } = object.userData;
  if (!asset) return describeProduct(objectName);
  return {
    name: asset.filename,
    variation: missingAsset ? 'Missing model' : 'Imported model',
    description:
      missingAsset ||
      [asset.attribution, asset.license].filter(Boolean).join(' · '),
  };
}
