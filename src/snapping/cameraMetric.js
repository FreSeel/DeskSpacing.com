import { Vector3 } from 'three';

// CSS-pixel correction at the object's depth, with actual perspective/zoom.
// Reused scratch vectors keep candidate scoring independent of GPU resources.
export function createCameraMetric(camera, canvas) {
  const a = new Vector3(),
    b = new Vector3();
  return (position, delta) => {
    if (!canvas.clientWidth || !canvas.clientHeight) return Infinity;
    a.set(position.x, position.y, position.z).project(camera);
    b.set(
      position.x + delta.x,
      position.y + (delta.y || 0),
      position.z + delta.z,
    ).project(camera);
    if (
      ![a.x, a.y, a.z, b.x, b.y, b.z].every(Number.isFinite) ||
      a.z < -1 ||
      a.z > 1 ||
      b.z < -1 ||
      b.z > 1
    )
      return Infinity;
    return Math.hypot(
      ((b.x - a.x) * canvas.clientWidth) / 2,
      ((b.y - a.y) * canvas.clientHeight) / 2,
    );
  };
}
