import { limits, validateRecords } from '../sharing/legacyCodec.js';
import { modelFormat, remoteModelSource } from '../models/importSource.js';

export const importedType = 'ImportedModel';
const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireRecord(condition) {
  if (!condition) throw new Error('Invalid imported model record.');
}

export function validateProjectRecords(records) {
  if (!Array.isArray(records) || records.length > limits.objects)
    throw new Error('A project has too many objects.');
  const ids = new Set();
  const sources = new Map();
  for (const record of records) {
    if (record?.type !== importedType) {
      validateRecords([record]);
      continue;
    }
    const { objectId, asset, position, rotation, scale } = record;
    requireRecord(
      typeof objectId === 'string' &&
        idPattern.test(objectId) &&
        !ids.has(objectId),
    );
    requireRecord(
      record.product === undefined &&
        record.dimensions === undefined &&
        record.texture === undefined,
    );
    ids.add(objectId);
    requireRecord(
      asset &&
        typeof asset.id === 'string' &&
        idPattern.test(asset.id) &&
        typeof asset.filename === 'string' &&
        asset.filename.length <= 4096 &&
        modelFormat(asset.filename) === asset.format,
    );
    requireRecord(
      (asset.kind === 'local' && asset.url === undefined) ||
        (asset.kind === 'remote' &&
          remoteModelSource(asset.url).format === asset.format),
    );
    for (const key of ['attribution', 'license'])
      requireRecord(
        asset[key] === undefined ||
          (typeof asset[key] === 'string' && asset[key].length <= 2048),
      );
    const previous = sources.get(asset.id);
    requireRecord(
      !previous ||
        ['kind', 'url', 'filename', 'format', 'attribution', 'license'].every(
          (key) => previous[key] === asset[key],
        ),
    );
    sources.set(asset.id, asset);
    for (const values of [position, rotation, scale])
      requireRecord(
        Array.isArray(values) &&
          values.length === 3 &&
          values.every(
            (value) =>
              Number.isFinite(value) && Math.abs(value) <= limits.coordinate,
          ),
      );
    requireRecord(
      scale.every(
        (value) => Math.abs(value) >= 1e-6 && Math.abs(value) <= 10000,
      ),
    );
  }
  return records;
}
