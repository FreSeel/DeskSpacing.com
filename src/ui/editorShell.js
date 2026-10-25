export function bindEditorShell({ document, host, transformControls }) {
  const library = document.getElementById('libraryPanel');
  const inspector = document.getElementById('selectionPanel');
  const canvas = document.getElementById('threeCanvas');
  const open = document.getElementById('openLibrary');
  let libraryOpen = true;
  let selectionVisible = false;
  let queued = false;
  let disposed = false;
  const cleanup = [];
  const listen = (node, event, handler) => {
    node.addEventListener(event, handler);
    cleanup.push(() => node.removeEventListener(event, handler));
  };
  function flush() {
    queued = false;
    if (disposed || transformControls.dragging) return;
    if (!selectionVisible && inspector.contains(document.activeElement)) {
      canvas.focus({ preventScroll: true });
    } else if (!libraryOpen && library.contains(document.activeElement)) {
      open.focus({ preventScroll: true });
    }
    library.hidden = !libraryOpen;
    inspector.hidden = !selectionVisible;
    open.setAttribute('aria-expanded', String(libraryOpen));
  }
  function schedule() {
    if (!queued) {
      queued = true;
      host.queueMicrotask(flush);
    }
  }
  listen(document.getElementById('closeLibrary'), 'click', () => {
    libraryOpen = false;
    schedule();
  });
  listen(open, 'click', () => {
    libraryOpen = !libraryOpen;
    schedule();
  });
  listen(transformControls, 'dragging-changed', schedule);
  listen(canvas, 'pointercancel', schedule);
  const menus = [...document.querySelectorAll('.toolbar-menu')];
  for (const menu of menus) {
    listen(menu, 'toggle', () => {
      if (menu.open)
        menus
          .filter((other) => other !== menu)
          .forEach((other) => {
            other.open = false;
          });
    });
  }
  listen(document, 'pointerdown', (event) => {
    menus.forEach((menu) => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && !document.querySelector('.modal.show'))
      menus.forEach((menu) => {
        if (menu.open) {
          menu.open = false;
          menu.querySelector('summary').focus();
        }
      });
  });
  const returnFocus = new WeakMap();
  listen(document, 'show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    const menu = trigger?.closest('.toolbar-menu');
    returnFocus.set(
      event.target,
      menu ? menu.querySelector('summary') : trigger,
    );
    menus.forEach((item) => {
      item.open = false;
    });
  });
  listen(document, 'hidden.bs.modal', (event) => {
    const target = returnFocus.get(event.target);
    host.queueMicrotask(() => {
      if (!disposed && target?.isConnected)
        target.focus({ preventScroll: true });
    });
  });
  const motion = host.matchMedia('(prefers-reduced-motion: reduce)');
  const tutorial = document.getElementById('tutorialModal');
  const updateImages = () => {
    tutorial.querySelectorAll('[data-tutorial-src]').forEach((image) => {
      if (motion.matches || !tutorial.classList.contains('show')) {
        image.removeAttribute('src');
        image.hidden = true;
      } else {
        image.src = image.dataset.tutorialSrc;
        image.hidden = false;
      }
    });
  };
  listen(tutorial, 'shown.bs.modal', updateImages);
  listen(tutorial, 'hidden.bs.modal', updateImages);
  listen(motion, 'change', updateImages);
  return {
    setSelectionVisible(visible) {
      selectionVisible = visible;
      schedule();
    },
    dispose() {
      disposed = true;
      cleanup.forEach((remove) => remove());
    },
  };
}
