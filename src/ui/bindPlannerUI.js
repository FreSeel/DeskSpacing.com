import {
  bindCatalogPreviews,
  bindCatalogDiscovery,
  readProductChoice,
} from './catalogPanel.js';
import { limits } from '../sharing/legacyCodec.js';
import { cards, categories } from '../catalog/presentation.js';

export function bindPlannerUI({
  document,
  measurements,
  measurementUI,
  actions,
  selection,
  resetCamera,
  sharing,
  feedback,
  shell,
}) {
  const cleanup = [];
  const pending = new Set();
  let disposed = false;
  function listen(element, event, callback) {
    element.addEventListener(event, callback);
    cleanup.push(() => element.removeEventListener(event, callback));
  }
  function updateButtons() {
    for (const button of document.querySelectorAll('[data-action="add"]')) {
      button.disabled =
        pending.has(button.dataset.cardId) ||
        (button.dataset.replace === 'true' && !selection.pickedObject);
    }
    document.getElementById('replacementHint').hidden = Boolean(
      selection.pickedObject,
    );
  }
  cleanup.push(selection.subscribe(updateButtons));
  for (const button of document.querySelectorAll('[data-action="add"]')) {
    listen(button, 'click', async () => {
      if (button.disabled) return;
      const card = button.closest('[data-card]');
      const errorText = card.querySelector('.card-error');
      errorText.hidden = true;
      for (const input of card.querySelectorAll('input[type="number"]')) {
        input.removeAttribute('aria-invalid');
        if (
          !input.validity.valid ||
          !Number.isFinite(measurementUI.readInches(input)) ||
          measurementUI.readInches(input) <= 0 ||
          measurementUI.readInches(input) > limits.dimension
        ) {
          input.setAttribute('aria-invalid', 'true');
          errorText.textContent = measurementUI.errorMessage();
          errorText.hidden = false;
          input.focus();
          return;
        }
      }
      const label = button.textContent;
      const token = shell.beginCatalogAction();
      pending.add(button.dataset.cardId);
      updateButtons();
      card.setAttribute('aria-busy', 'true');
      button.textContent = 'Loading…';
      feedback.clear();
      try {
        const { product, options } = readProductChoice(
          button,
          document,
          measurementUI.readInches,
        );
        const object = await actions.add(product, options);
        if (object && !disposed) shell.finishCatalogAction(token);
        // A null result is a discarded stale operation, never a success toast.
      } catch (error) {
        if (disposed) return;
        errorText.textContent = `${error.message || 'The object could not be loaded.'} Please try again.`;
        errorText.hidden = false;
      } finally {
        if (!disposed) {
          pending.delete(button.dataset.cardId);
          card.removeAttribute('aria-busy');
          button.textContent = label;
          updateButtons();
        }
      }
    });
  }
  for (const button of document.querySelectorAll(
    '[data-action="reset-camera"]',
  ))
    listen(button, 'click', resetCamera);
  listen(document.getElementById('saveModalButton'), 'click', () => {
    try {
      document.getElementById('customLinkForm').value = sharing.createLink();
    } catch (error) {
      feedback.error(error);
    }
  });
  listen(document.getElementById('customLinkForm'), 'click', (event) =>
    event.target.select(),
  );
  bindCatalogPreviews(document, listen);
  cleanup.push(
    bindCatalogDiscovery({ document, cards, categories, listen, measurements }),
  );
  return () => {
    disposed = true;
    cleanup.forEach((remove) => remove());
  };
}
