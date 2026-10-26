import { bindResponsivePanels } from './responsivePanels.js';

export function bindEditorShell({ document, host, transformControls }) {
  const panels = bindResponsivePanels({ document, host, transformControls });
  let disposed = false;
  const cleanup = [];
  const listen = (node, event, handler) => {
    node.addEventListener(event, handler);
    cleanup.push(() => node.removeEventListener(event, handler));
  };
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
    document.querySelector('.editor-shell').inert = true;
    document.querySelector('.skip-link').inert = true;
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
    document.querySelector('.editor-shell').inert = false;
    document.querySelector('.skip-link').inert = false;
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
    ...panels,
    dispose() {
      disposed = true;
      panels.dispose();
      cleanup.forEach((remove) => remove());
    },
  };
}
