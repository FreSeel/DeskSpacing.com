import { cards, categories } from '../catalog/presentation.js';
import { element, thumbnail } from './dom.js';
import { limits } from '../sharing/legacyCodec.js';

export function renderCatalog(document) {
  const grid = document.getElementById('catalogGrid');
  const category = document.getElementById('catalogCategory');
  grid.replaceChildren();
  while (category.options.length > 1) category.remove(1);
  document.getElementById('replacementHint')?.remove();
  for (const item of categories) {
    const option = element(document, 'option', '', item.label);
    option.value = item.id;
    category.append(option);
  }
  for (const card of cards) {
    const item = element(document, 'li', 'catalog-item');
    item.dataset.card = card.id;
    const article = element(document, 'article', 'product-card');
    const preview = thumbnail(
      document,
      card.thumbnail,
      categories.find((c) => c.id === card.category).label,
    );
    preview.querySelector('img').id = `${card.id}Image`;
    const heading = element(document, 'h2', '', card.name);
    article.append(preview, heading);
    const configurable = card.select || card.fields;
    const form = element(document, 'div', 'product-options');
    form.id = `${card.id}Options`;
    form.hidden = true;
    if (configurable) {
      const toggle = element(document, 'button', 'options-toggle', 'Options');
      toggle.type = 'button';
      toggle.dataset.options = card.id;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', form.id);
      toggle.setAttribute('aria-label', `${card.name} options`);
      article.append(toggle);
      form.append(element(document, 'h3', '', card.name));
    }
    const controls = configurable ? form : article;
    if (card.description) {
      controls.append(
        element(document, 'p', 'product-description', card.description),
      );
    }
    if (card.select) {
      const label = element(document, 'label', '', card.select.label);
      label.htmlFor = card.select.id;
      const select = element(document, 'select');
      select.id = card.select.id;
      for (const choice of card.select.options) {
        const option = element(document, 'option', '', choice.label);
        option.value = choice.value;
        if (choice.image) option.dataset.image = choice.image;
        select.append(option);
      }
      controls.append(label, select);
    }
    for (const field of card.fields || []) {
      const label = element(document, 'label', '', `${field.label} (inches)`);
      label.htmlFor = field.id;
      const input = element(document, 'input');
      input.id = field.id;
      input.type = 'number';
      input.min = '0';
      input.max = String(limits.dimension);
      input.step = 'any';
      input.required = true;
      input.value = field.value;
      input.setAttribute('aria-describedby', `${card.id}Error`);
      controls.append(label, input);
    }
    if (card.stand) {
      const label = element(document, 'label', 'checkbox-label');
      const input = element(document, 'input');
      input.type = 'checkbox';
      input.id = `${card.id}Stand`;
      label.append(input, document.createTextNode('No stand'));
      controls.append(label);
    }
    const buttons = element(document, 'div', 'product-actions');
    for (const replace of card.desk ? [false] : [false, true]) {
      const button = element(
        document,
        'button',
        replace ? 'replace-action' : 'add-action',
        replace ? 'Replace selected' : card.desk ? 'Use desk' : 'Add',
      );
      button.type = 'button';
      button.dataset.action = 'add';
      button.dataset.cardId = card.id;
      if (card.family) button.dataset.family = card.family;
      else button.dataset.product = card.product;
      if (replace) {
        button.dataset.replace = 'true';
        button.setAttribute('aria-describedby', 'replacementHint');
      }
      button.setAttribute('aria-label', `${button.textContent}: ${card.name}`);
      buttons.append(button);
    }
    controls.append(buttons);
    if (card.desk)
      controls.append(
        element(document, 'p', 'product-hint', 'Replaces the current desk.'),
      );
    const error = element(document, 'p', 'card-error');
    error.id = `${card.id}Error`;
    error.hidden = true;
    error.setAttribute('role', 'alert');
    controls.append(error);
    const match = element(document, 'p', 'search-match');
    match.hidden = true;
    article.append(match);
    item.append(article, form);
    grid.append(item);
  }
  const hint = element(
    document,
    'p',
    'muted',
    'Select an object in the workspace to replace it.',
  );
  hint.id = 'replacementHint';
  document.querySelector('.catalog-scroll').append(hint);
}
