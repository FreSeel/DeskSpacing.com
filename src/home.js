import { bindToolbarMenus } from './ui/toolbarMenus.js';

const menus = bindToolbarMenus(document);
const preview = document.getElementById('setupPreview');
const caption = document.getElementById('setupCaption');
const examples = [...document.querySelectorAll('[data-example]')];
const cleanups = examples.map((button) => {
  const select = () => {
    preview.src = button.dataset.example;
    preview.alt = button.dataset.description;
    caption.textContent = button.dataset.caption;
    examples.forEach((item) =>
      item.setAttribute('aria-pressed', String(item === button)),
    );
  };
  button.addEventListener('click', select);
  return () => button.removeEventListener('click', select);
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    menus.dispose();
    cleanups.forEach((remove) => remove());
  });
