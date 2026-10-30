import { describe, expect, it } from 'vitest';
import { shade } from './colour';

describe('shade', () => {
  it('darkens a colour toward black by the amount', () => {
    expect(shade('#ffffff', 0)).toBe('#ffffff');
    expect(shade('#ffffff', 0.5)).toBe('#808080');
    expect(shade('#f97316', 1)).toBe('#000000');
  });

  it('leaves anything that is not #rrggbb as it is', () => {
    expect(shade('red', 0.5)).toBe('red');
  });
});
