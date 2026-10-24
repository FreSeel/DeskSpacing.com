import { families, resolveProduct } from '../catalog/configuration.js';

// Form naming is confined to this DOM adapter; model/state code only receives data.
export function readProductChoice(element, document) {
  const { product, family, replace } = element.dataset;
  const value = (id) => document.getElementById(id).value;
  const options = { replace: replace === 'true' };
  let id = product;
  if (family) {
    const noStand = families[family].stand && value(`${family}Stand`) === 'on';
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
    if (config.stand) {
      const checkbox = document.getElementById(`${id}Stand`);
      listen(checkbox, 'click', () => {
        checkbox.value = checkbox.value === 'off' ? 'on' : 'off';
      });
    }
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
