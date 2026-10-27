// Physical distances use the same canonical inches as scene transforms.
export const spacingLimits = Object.freeze({ min: 0.1 / 2.54, max: 100 });
export const defaultSnapping = Object.freeze({
  enabled: false,
  grid: Object.freeze({ spacing: 1 }),
});

export function validSpacing(value) {
  return (
    Number.isFinite(value) &&
    value >= spacingLimits.min &&
    value <= spacingLimits.max
  );
}

export function normalizeSnapping(value) {
  return Object.freeze({
    enabled: value?.enabled === true,
    grid: Object.freeze({
      spacing: validSpacing(value?.grid?.spacing)
        ? value.grid.spacing
        : defaultSnapping.grid.spacing,
    }),
  });
}
