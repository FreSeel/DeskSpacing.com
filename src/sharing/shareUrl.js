export function createShareUrl(setup, location) {
  const url = new URL(location);
  url.search = '';
  url.hash = '';
  url.searchParams.set('customSetup', setup);
  return url.href;
}

// URLSearchParams safely decodes malformed escapes and keeps first-value semantics.
export function readSetupParameter(location) {
  return new URL(location).searchParams.get('customSetup');
}
