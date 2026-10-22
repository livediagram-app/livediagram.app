import { describe, expect, it } from 'vitest';
import { IMPORT_COORD_MAX, withinImportReach } from './import-coords';

describe('withinImportReach', () => {
  it('takes numbers up to the limit either side of zero', () => {
    expect(withinImportReach(0, IMPORT_COORD_MAX, -IMPORT_COORD_MAX, 12.5)).toBe(true);
  });

  it('refuses anything past the limit, infinite or NaN', () => {
    for (const n of [IMPORT_COORD_MAX + 1, -1e308, Infinity, Number.NaN]) {
      expect(withinImportReach(0, n)).toBe(false);
    }
  });
});
