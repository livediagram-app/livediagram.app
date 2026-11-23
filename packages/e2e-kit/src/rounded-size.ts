import { expect } from '@playwright/test';

/** A length in CSS pixels, to the nearest whole pixel (never down): a 44 px row laid out at a fractional device scale reads 43.99997. */
export const roundedPx = (px: number): number => Math.round(px);

/**
 * Asserts a measured length (a row's or a touch target's height or width) is at least `min` CSS pixels once rounded to
 * the nearest pixel. Rounding to the nearest keeps a real 1 px shortfall (43 for 44) failing.
 */
export function expectAtLeastPx(measured: number, min: number, label?: string): void {
  expect(roundedPx(measured), label).toBeGreaterThanOrEqual(min);
}
