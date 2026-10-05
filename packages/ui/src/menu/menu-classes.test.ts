import { describe, expect, it } from 'vitest';
import { menuRadioRowClass } from './menu-classes';

describe('menuRadioRowClass', () => {
  it('tints the checked row', () => {
    expect(menuRadioRowClass(true)).toContain('bg-brand-100');
    expect(menuRadioRowClass(false)).not.toContain('bg-brand-100');
  });

  it('sets the label in medium always, or only on the checked row', () => {
    expect(menuRadioRowClass(false)).toContain('font-medium');
    expect(menuRadioRowClass(false, { weight: 'checked' })).not.toContain('font-medium');
    expect(menuRadioRowClass(true, { weight: 'checked' })).toContain('font-medium');
  });
});
