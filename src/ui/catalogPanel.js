import { families, resolveProduct } from '../catalog/configuration.js';

// Form naming is confined to this DOM adapter; model/state code only receives data.
export function readProductChoice(element, document) {
  const { product, family, replace } = element.dataset;
  const value = (id) => document.getElementById(id).value;
  const options = { replace: replace === 'true' };
  let id = product;
  if (family) {
    const noStand =
      families[family].stand &&
      document.getElementById(`${family}Stand`).checked;
    id = resolveProduct(family, value(`${family}Form`), noStand);
  }
  if (id === 'customDesk') {
    options.dimensions = [
      Number(value('customDeskL')),
      1,
      Number(value('customDeskW')),
    ];
    options.texture = value('customDeskForm');
  } else if (id === 'referenceBox') {
    // Legacy inputs map L/W/H to Three.js width/height/depth (in inches).
    options.dimensions = ['L', 'W', 'H'].map((axis) =>
      Number(value(`${id}${axis}`)),
    );
  } else if (id === 'referenceSphere') {
    options.dimensions = [Number(value(`${id}Radius`)), -1, -1];
  }
  return { product: id, options };
}

export function bindCatalogPreviews(document, listen) {
  for (const [id, config] of Object.entries(families)) {
    if (config.preview) {
      const form = document.getElementById(`${id}Form`);
      listen(form, 'change', () => {
        document.getElementById(`${id}Image`).src =
          `Model thumbnails/${id}${form.value}.jpg`;
      });
    }
  }
  const form = document.getElementById('customDeskForm');
  listen(form, 'change', () => {
    document.getElementById('customDeskImage').src =
      form.selectedOptions[0].dataset.image;
  });
}

export function bindCatalogDiscovery({ document, cards, categories, listen }) {
  const search = document.getElementById('catalogSearch');
  const category = document.getElementById('catalogCategory');
  const items = [...document.querySelectorAll('[data-card]')];
  let expanded = null;
  function setExpanded(id) {
    expanded = id;
    for (const item of items) {
      const active = item.dataset.card === expanded;
      item.classList.toggle('is-expanded', active);
      item.querySelector('.product-options').hidden = !active;
      item
        .querySelector('[data-options]')
        ?.setAttribute('aria-expanded', String(active));
    }
  }
  function filter() {
    const query = search.value.trim().toLowerCase();
    let count = 0;
    for (const [index, item] of items.entries()) {
      const card = cards[index];
      const variants = (card.select?.options || []).filter((option) =>
        `${option.label} ${card.id}${option.value}${card.stand ? 'NoStand no stand' : ''}`
          .toLowerCase()
          .includes(query),
      );
      const base =
        `${card.name} ${card.id} ${categories.find((c) => c.id === card.category).label}`
          .toLowerCase()
          .includes(query);
      const visible =
        (!category.value || category.value === card.category) &&
        (base || variants.length > 0);
      item.hidden = !visible;
      if (visible) count++;
      if (!visible && expanded === card.id) setExpanded(null);
      const match = item.querySelector('.search-match');
      match.hidden = !visible || !query || base || !variants.length;
      match.textContent = `Matches: ${variants.map((option) => option.label).join(', ')}`;
    }
    document.getElementById('catalogCount').textContent =
      `${count} ${count === 1 ? 'object' : 'objects'}`;
    document.getElementById('catalogEmpty').hidden = count > 0;
  }
  listen(search, 'input', filter);
  listen(category, 'change', filter);
  listen(document.getElementById('clearFilters'), 'click', () => {
    search.value = '';
    category.value = '';
    filter();
    search.focus();
  });
  listen(document.getElementById('catalogGrid'), 'click', (event) => {
    const toggle = event.target.closest('[data-options]');
    if (toggle)
      setExpanded(
        expanded === toggle.dataset.options ? null : toggle.dataset.options,
      );
  });
  filter();
}
