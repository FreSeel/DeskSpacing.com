import { Vector3 } from 'three';

export function bindSnappingGuides({ document, view }) {
  const container = document.getElementById('rightSideContainer');
  const overlay = document.createElement('div');
  overlay.id = 'snappingGuides';
  overlay.className = 'snapping-guides';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.append(svg);
  const paths = Array.from({ length: 6 }, () => {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    svg.append(path);
    return path;
  });
  const markers = Array.from({ length: 4 }, () => {
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('r', '3.5');
    svg.append(circle);
    return circle;
  });
  const contact = document.createElementNS(svg.namespaceURI, 'path');
  contact.classList.add('surface-contact');
  svg.append(contact);
  container.append(overlay);
  const vector = new Vector3();
  let guidance = null;
  function project(point) {
    vector.set(point.x, point.y, point.z).project(view.camera);
    if (
      !Number.isFinite(vector.x + vector.y + vector.z) ||
      vector.z < -1 ||
      vector.z > 1
    )
      return null;
    return {
      x: ((vector.x + 1) * container.clientWidth) / 2,
      y: ((1 - vector.y) * container.clientHeight) / 2,
    };
  }
  function update() {
    overlay.hidden = guidance?.kind !== 'magnetic' && !guidance?.surface;
    if (overlay.hidden) return;
    view.camera.updateMatrixWorld();
    let visible = false;
    paths.forEach((path, index) => {
      const line = guidance.lines?.[index];
      const a = line && project(line[0]),
        b = line && project(line[1]);
      path.setAttribute('d', a && b ? `M ${a.x} ${a.y} L ${b.x} ${b.y}` : '');
      if (a && b) visible = true;
    });
    markers.forEach((marker, index) => {
      const point = guidance.points?.[index] && project(guidance.points[index]);
      marker.setAttribute('visibility', point ? 'visible' : 'hidden');
      if (point) {
        marker.setAttribute('cx', point.x);
        marker.setAttribute('cy', point.y);
        visible = true;
      }
    });
    const support = guidance.surface;
    const center = support && project(support.point);
    const footprint = support?.footprint.map(project) || [];
    let outline = '';
    if (footprint.length >= 3 && footprint.every(Boolean))
      outline =
        footprint.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') +
        ' Z';
    // A compact cross marks point/line contacts too (tilted or curved bases).
    if (center)
      outline += ` M ${center.x - 4} ${center.y} h 8 M ${center.x} ${center.y - 4} v 8`;
    contact.setAttribute('d', outline);
    overlay.hidden = !visible && !outline;
  }
  const unsubscribe = view.subscribeRender(update);
  return {
    show(value) {
      guidance = value;
      update();
    },
    dispose() {
      unsubscribe();
      guidance = null;
      overlay.remove();
    },
  };
}
