// One scene unit is one inch, including primitive dimensions and legacy links.
// Conversion belongs at the UI boundary, never in geometry or serialization.
export const centimetersPerInch = 2.54;
export const defaultUnit = 'in';
export const normalizeUnit = (unit) => (unit === 'cm' ? 'cm' : defaultUnit);
export const fromInches = (value, unit) =>
  unit === 'cm' ? value * centimetersPerInch : value;
export const toInches = (value, unit) =>
  unit === 'cm' ? value / centimetersPerInch : value;

export function formatMeasurement(inches, unit) {
  const value = fromInches(inches, unit);
  const rounded = Number(value.toFixed(2));
  // Valid very small dimensions must not become zero in an input or annotation.
  return String(rounded === 0 && value !== 0 ? value : rounded);
}

// Authored catalog copy uses double quotes for inches. Always format the source,
// not the previously formatted text; product IDs and option values stay intact.
export function formatMeasurementText(text = '', unit) {
  return text
    .replace(
      /(\d+(?:\.\d+)?)"/g,
      (_match, value) => `${formatMeasurement(Number(value), unit)} ${unit}`,
    )
    .replace('(inches)', `(${unit})`);
}
