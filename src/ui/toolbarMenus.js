// Native disclosures with shared dismissal and focus behavior.
export function bindToolbarMenus(document) {
  const menus = [...document.querySelectorAll('.toolbar-menu')];
  const cleanup = [];
  const listen = (node, event, handler) => {
    node.addEventListener(event, handler);
    cleanup.push(() => node.removeEventListener(event, handler));
  };
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
  return { menus, dispose: () => cleanup.forEach((remove) => remove()) };
}
