import { expect, it } from 'vitest';
import { parseTransformInput } from '../../src/ui/numericalTransformPanel.js';

it.each([
  ['-12.345678901234', -12.345678901234],
  ['+12.5', 12.5],
  ['.125', 0.125],
  ['-.125', -0.125],
  ['12.', 12],
  [' 0 ', 0],
  ['1.23456789e-8', 1.23456789e-8],
])('accepts complete decimal input %s without rounding', (text, value) => {
  expect(parseTransformInput(text)).toBe(value);
});

it.each([
  '',
  ' ',
  '-',
  '+',
  '.',
  '-.',
  '1e',
  '1e-',
  'NaN',
  'Infinity',
  '1e999',
  '0x10',
  '10 cm',
  '12,5',
  '1 2',
  '--1',
])('rejects incomplete or nondecimal input %s', (text) => {
  expect(parseTransformInput(text)).toBeNull();
});
