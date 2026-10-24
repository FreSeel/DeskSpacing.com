// Classic-script bridge: retain inline handlers until the planner is modularized.
(function () {
  window.DeskSpacingURLs = {
    create(setup, location = window.location.href) {
      const url = new URL(location);
      url.search = '';
      url.hash = '';
      url.searchParams.set('customSetup', setup);
      return url.href;
    },
  };
})();
