export function initializePage(host) {
  host.dataLayer = host.dataLayer || [];
  function track() {
    host.dataLayer.push(arguments);
  }
  track('js', new Date());
  track('config', 'UA-172455339-1');
  function mobileNotice() {
    if (
      /Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(
        host.navigator.userAgent,
      )
    ) {
      host.alert(
        'Welcome to DeskSpacing! Unfortunately DeskSpacing is an experience for users on desktop only for now. If you are interested in a mobile version of the app, let us know at deskspacing@gmail.com . Sorry for the inconvenience! ',
      );
    }
  }
  if (host.document.readyState === 'complete') mobileNotice();
  else host.addEventListener('load', mobileNotice, { once: true });
  return () => host.removeEventListener('load', mobileNotice);
}
