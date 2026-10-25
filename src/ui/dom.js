// Small DOM helpers shared by the library and inspector. User text is never HTML.
export function element(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function thumbnail(document, source, label) {
  const well = element(document, 'div', 'thumbnail-well');
  const fallback = element(document, 'span', 'thumbnail-fallback', label);
  well.append(fallback);
  if (source) {
    const image = element(document, 'img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('load', () => {
      image.hidden = false;
      fallback.hidden = true;
    });
    image.addEventListener('error', () => {
      image.hidden = true;
      fallback.hidden = false;
    });
    image.src = source;
    well.append(image);
  }
  return well;
}
