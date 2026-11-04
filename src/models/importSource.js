export function modelFormat(name) {
  const format = /\.(glb|gltf)$/i.exec(name)?.[1].toLowerCase();
  if (!format)
    throw new Error('Choose a .glb or .gltf file or direct model URL.');
  return format;
}

export function httpAssetUrl(value, base) {
  const url = new URL(value, base);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      'Model resources require HTTP or HTTPS URLs without credentials.',
    );
  url.hash = '';
  return url;
}

export function remoteModelSource(value) {
  if (typeof value !== 'string' || value.length > 4096)
    throw new Error('Enter a direct model URL.');
  const url = httpAssetUrl(value.trim());
  const filename = decodeURIComponent(url.pathname.split('/').at(-1));
  return {
    kind: 'remote',
    url: url.href,
    filename,
    format: modelFormat(filename),
  };
}

export function localModelSource(file) {
  if (typeof file?.name !== 'string' || typeof file.arrayBuffer !== 'function')
    throw new Error('Choose a local model file.');
  return { kind: 'local', filename: file.name, format: modelFormat(file.name) };
}
