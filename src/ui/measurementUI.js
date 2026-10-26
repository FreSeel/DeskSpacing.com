import {
  formatMeasurement,
  formatMeasurementText,
  fromInches,
  toInches,
} from '../measurements/units.js';
import { limits } from '../sharing/legacyCodec.js';

export function bindMeasurementUI({ document, measurements }) {
  const selector = document.getElementById('measurementUnit');
  const fields = [...document.querySelectorAll('[data-measurement-input]')];
  const copy = [...document.querySelectorAll('[data-measurement-text]')].map(
    (element) => [element, element.textContent],
  );
  // These are unsaved form drafts, not scene state. Only user input updates the
  // canonical draft; switching units never reads back a rounded display value.
  const drafts = new Map(fields.map((input) => [input, Number(input.value)]));
  const readInches = (input) => drafts.get(input);
  const errorMessage = () =>
    `Enter a dimension greater than zero and no more than ${formatMeasurement(limits.dimension, measurements.unit)} ${measurements.unit}.`;
  function inputChanged(event) {
    const input = event.target;
    drafts.set(
      input,
      input.value === ''
        ? NaN
        : toInches(Number(input.value), measurements.unit),
    );
  }
  fields.forEach((input) => input.addEventListener('input', inputChanged));
  const choices = [...selector.querySelectorAll('input[type="radio"]')];
  const changeUnit = (event) => measurements.setUnit(event.target.value);
  selector.addEventListener('change', changeUnit);
  const unsubscribe = measurements.subscribe((unit) => {
    choices.forEach((choice) => {
      choice.checked = choice.value === unit;
    });
    for (const input of fields) {
      const value = drafts.get(input);
      input.value = Number.isFinite(value)
        ? formatMeasurement(value, unit)
        : '';
      input.max = String(fromInches(limits.dimension, unit));
      document.querySelector(`label[for="${input.id}"]`).textContent =
        `${input.dataset.measurementInput} (${unit})`;
      if (input.getAttribute('aria-invalid') === 'true')
        document.getElementById(
          input.getAttribute('aria-describedby'),
        ).textContent = errorMessage();
    }
    for (const [element, source] of copy)
      element.textContent = formatMeasurementText(source, unit);
    document.querySelector('.library-footer').textContent =
      `11 categories · Configure sizes in ${unit}`;
  });
  return {
    readInches,
    errorMessage,
    dispose() {
      unsubscribe();
      selector.removeEventListener('change', changeUnit);
      fields.forEach((input) =>
        input.removeEventListener('input', inputChanged),
      );
    },
  };
}
