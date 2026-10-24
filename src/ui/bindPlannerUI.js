import { bindCatalogPreviews, readProductChoice } from './catalogPanel.js';

export function bindPlannerUI({
  document,
  actions,
  selection,
  resetCamera,
  sharing,
  feedback,
}) {
  const cleanup = [];
  function listen(element, event, callback) {
    element.addEventListener(event, callback);
    cleanup.push(() => element.removeEventListener(event, callback));
  }
  for (const button of document.querySelectorAll('[data-action="add"]')) {
    listen(button, 'click', async () => {
      if (button.disabled) return;
      const label = button.textContent;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Loading…';
      feedback.clear();
      try {
        const { product, options } = readProductChoice(button, document);
        await actions.add(product, options);
      } catch (error) {
        feedback.error(error);
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = label;
      }
    });
  }
  for (const button of document.querySelectorAll(
    '[data-action="reset-camera"]',
  )) {
    listen(button, 'click', resetCamera);
  }
  for (const input of document.querySelectorAll('[data-disable-picking]')) {
    listen(input, 'click', () => {
      selection.pickEnabled = false;
    });
  }
  for (const input of document.querySelectorAll('[data-numeric]')) {
    listen(input, 'keypress', (event) => {
      if (event.key.length === 1 && !/[0-9.]/.test(event.key))
        event.preventDefault();
    });
  }
  listen(document.getElementById('saveModalButton'), 'click', () => {
    try {
      document.getElementById('customLinkForm').value = sharing.createLink();
    } catch (error) {
      feedback.error(error);
    }
  });
  bindCatalogPreviews(document, listen);
  return () => cleanup.forEach((remove) => remove());
}
