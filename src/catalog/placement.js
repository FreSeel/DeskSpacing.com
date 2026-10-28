import { isDesk } from './configuration.js';

// Support eligibility is a product semantic, never inferred from an arbitrary
// mesh name or bounding box. The current catalog has no shelf products.
export function supportKind(product) {
  if (product === 'floor') return 'floor';
  if (isDesk(product)) return 'desk';
  return null;
}
