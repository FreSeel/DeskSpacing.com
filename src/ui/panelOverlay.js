// One modal panel, using the existing form subtree. No scene state lives here.
export function createPanelOverlay({ document, dismiss }) {
  let active = null;
  let restore = null;
  let inert = [];
  const focusable = () =>
    [
      ...active.querySelectorAll(
        'button, input, select, summary, a[href], [tabindex]',
      ),
    ].filter(
      (node) =>
        !node.disabled && node.tabIndex >= 0 && node.getClientRects().length,
    );
  function close({ returnFocus = true } = {}) {
    if (!active) return;
    active.removeAttribute('role');
    active.removeAttribute('aria-modal');
    active.removeAttribute('tabindex');
    active = null;
    inert.forEach(([node, previous]) => {
      node.inert = previous;
    });
    inert = [];
    if (returnFocus && restore?.isConnected && restore.getClientRects().length)
      restore.focus({ preventScroll: true });
    restore = null;
  }
  function keydown(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    } else if (event.key === 'Tab') {
      const items = focusable();
      const first = items[0] || active;
      const last = items.at(-1) || active;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === active)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === active)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  function focusin(event) {
    if (active && !active.contains(event.target))
      (focusable()[0] || active).focus({ preventScroll: true });
  }
  document.addEventListener('keydown', keydown);
  document.addEventListener('focusin', focusin);
  return {
    show(panel, trigger) {
      if (active === panel) return;
      close({ returnFocus: false });
      active = panel;
      restore = trigger;
      active.setAttribute('role', 'dialog');
      active.setAttribute('aria-modal', 'true');
      active.tabIndex = -1;
      inert = [
        ...document.querySelectorAll(
          '.editor-header, .skip-link, #rightSideContainer, #libraryPanel, #selectionPanel',
        ),
      ]
        .filter((node) => node !== panel)
        .map((node) => [node, node.inert]);
      inert.forEach(([node]) => {
        node.inert = true;
      });
      (focusable()[0] || active).focus({ preventScroll: true });
    },
    close,
    dispose() {
      close({ returnFocus: false });
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
    },
  };
}
