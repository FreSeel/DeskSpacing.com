import { createPanelOverlay } from './panelOverlay.js';

export function bindResponsivePanels({ document, host, transformControls }) {
  const root = document.querySelector('.editor-shell');
  const library = document.getElementById('libraryPanel');
  const inspector = document.getElementById('selectionPanel');
  const canvas = document.getElementById('threeCanvas');
  const open = document.getElementById('openLibrary');
  const selected = document.getElementById('openSelection');
  const expand = document.getElementById('toggleSelectionPanel');
  const backdrop = document.getElementById('panelBackdrop');
  const desktop = host.matchMedia('(min-width: 1280px)');
  const docked = host.matchMedia('(min-width: 1024px)');
  const phone = host.matchMedia('(max-width: 767px)');
  const mode = () =>
    desktop.matches
      ? 'desktop'
      : docked.matches
        ? 'compact'
        : phone.matches
          ? 'phone'
          : 'tablet';
  let layout = mode();
  let libraryOpen = layout === 'desktop' || layout === 'compact';
  let dock = 'library';
  let surface = null;
  let selectionVisible = false;
  let queued = false;
  let disposed = false;
  let epoch = 0;
  let returnTo = open;
  let viewportFrame = 0;
  const pointers = new Set();
  const cleanup = [];
  const touchLayout = () => layout === 'phone' || layout === 'tablet';
  const listen = (node, event, handler) => {
    node.addEventListener(event, handler);
    cleanup.push(() => node.removeEventListener(event, handler));
  };
  const modal = createPanelOverlay({
    document,
    dismiss: () => setSurface(null),
  });
  function setSurface(next, trigger = document.activeElement) {
    epoch++;
    surface = next;
    if (next) returnTo = trigger;
    schedule();
  }
  function flush() {
    queued = false;
    if (disposed || transformControls.dragging || pointers.size) return;
    const next = mode();
    if (next !== layout) {
      layout = next;
      epoch++;
      surface = null;
      dock = selectionVisible ? 'selection' : 'library';
      libraryOpen = !touchLayout();
    }
    if (!selectionVisible && surface === 'selection') surface = null;
    if (!selectionVisible && dock === 'selection') dock = 'library';
    const showLibrary = touchLayout()
      ? surface === 'library'
      : libraryOpen && (layout === 'desktop' || dock === 'library');
    const showSelection =
      selectionVisible && (layout !== 'compact' || dock === 'selection');
    // Release inert before moving focus out of a closing sheet.
    if (!surface) modal.close();
    root.dataset.layout = layout;
    root.dataset.hasSelection = String(selectionVisible);
    library.hidden = !showLibrary;
    inspector.hidden = !showSelection;
    if (
      surface === 'selection' &&
      !inspector.classList.contains('panel-expanded')
    )
      root.style.setProperty(
        '--selection-row-height',
        `${inspector.getBoundingClientRect().height}px`,
      );
    else if (surface !== 'selection')
      root.style.removeProperty('--selection-row-height');
    inspector.classList.toggle('panel-expanded', surface === 'selection');
    backdrop.hidden = !surface;
    selected.hidden = layout !== 'compact' || !selectionVisible;
    selected.setAttribute('aria-expanded', String(showSelection));
    expand.hidden = !touchLayout();
    expand.textContent = surface === 'selection' ? 'Done' : 'Controls';
    expand.setAttribute('aria-expanded', String(surface === 'selection'));
    open.setAttribute('aria-expanded', String(showLibrary));
    if (surface)
      modal.show(surface === 'library' ? library : inspector, returnTo);
    else if (
      (!showSelection && inspector.contains(document.activeElement)) ||
      (touchLayout() &&
        !inspector.classList.contains('panel-expanded') &&
        inspector.contains(document.activeElement) &&
        !document.activeElement.getClientRects().length)
    )
      canvas.focus({ preventScroll: true });
    else if (!showLibrary && library.contains(document.activeElement))
      open.focus({ preventScroll: true });
    else if (
      root.contains(document.activeElement) &&
      !document.activeElement.getClientRects().length
    )
      canvas.focus({ preventScroll: true });
  }
  function schedule() {
    if (!queued) {
      queued = true;
      host.queueMicrotask(flush);
    }
  }
  listen(document.getElementById('closeLibrary'), 'click', () => {
    if (touchLayout()) setSurface(null);
    else {
      libraryOpen = false;
      schedule();
    }
  });
  listen(open, 'click', () => {
    if (touchLayout())
      setSurface(surface === 'library' ? null : 'library', open);
    else {
      libraryOpen =
        !libraryOpen || (layout === 'compact' && dock !== 'library');
      dock = 'library';
      schedule();
    }
  });
  listen(selected, 'click', () => {
    dock = 'selection';
    schedule();
  });
  listen(expand, 'click', () =>
    setSurface(surface === 'selection' ? null : 'selection', expand),
  );
  listen(backdrop, 'click', () => setSurface(null));
  listen(document, 'show.bs.modal', () => {
    setSurface(null);
  });
  listen(canvas, 'pointerdown', (event) => {
    pointers.add(event.pointerId);
  });
  const release = (event) => {
    if (pointers.delete(event.pointerId)) schedule();
  };
  listen(host, 'pointerup', release);
  listen(host, 'pointercancel', release);
  listen(canvas, 'lostpointercapture', release);
  listen(host, 'blur', () => {
    pointers.clear();
    schedule();
  });
  listen(transformControls, 'dragging-changed', schedule);
  [desktop, docked, phone].forEach((query) =>
    listen(query, 'change', schedule),
  );
  // Visual viewport bounds keep focused fields reachable above a software keyboard.
  const viewport = host.visualViewport;
  function syncViewport() {
    viewportFrame = 0;
    root.dataset.shortViewport = String(viewport.height < 500);
    root.style.setProperty('--visual-height', `${viewport.height}px`);
    root.style.setProperty('--visual-top', `${viewport.offsetTop}px`);
    root.style.setProperty(
      '--visual-bottom',
      `${Math.max(0, host.innerHeight - viewport.height - viewport.offsetTop)}px`,
    );
    if (surface && document.activeElement.matches('input, select'))
      document.activeElement.scrollIntoView({ block: 'nearest' });
  }
  if (viewport) {
    const queueViewport = () => {
      if (!viewportFrame)
        viewportFrame = host.requestAnimationFrame(syncViewport);
    };
    listen(viewport, 'resize', queueViewport);
    listen(viewport, 'scroll', queueViewport);
    syncViewport();
  }
  flush();
  return {
    setSelectionVisible(visible) {
      selectionVisible = visible;
      if (visible && pointers.size && layout === 'compact') dock = 'selection';
      schedule();
    },
    beginCatalogAction() {
      return { epoch, phone: layout === 'phone', surface };
    },
    finishCatalogAction(token) {
      if (
        !disposed &&
        token.phone &&
        token.epoch === epoch &&
        token.surface === 'library' &&
        surface === 'library'
      )
        setSurface(null);
    },
    dispose() {
      disposed = true;
      host.cancelAnimationFrame(viewportFrame);
      modal.dispose();
      cleanup.forEach((remove) => remove());
    },
  };
}
