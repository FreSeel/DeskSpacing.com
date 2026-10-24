// Bootstrap 5 behavior with the existing Bootstrap 4 visual theme.
for (const element of document.querySelectorAll('[data-bs-toggle="tooltip"]')) {
  new window.bootstrap.Tooltip(element, {
    template:
      '<div class="tooltip" role="tooltip"><div class="tooltip-arrow arrow"></div><div class="tooltip-inner"></div></div>',
    popperConfig(config) {
      return {
        ...config,
        modifiers: [
          ...config.modifiers,
          {
            name: 'legacyThemePlacement',
            enabled: true,
            phase: 'write',
            fn({ state }) {
              state.elements.popper.setAttribute(
                'x-placement',
                state.placement,
              );
            },
          },
        ],
      };
    },
  });
}
for (const element of document.querySelectorAll('.starterModal')) {
  window.bootstrap.Modal.getOrCreateInstance(element).show();
}
