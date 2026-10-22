import { describe, expect, it } from 'vitest';
import { noteStickyColours } from './sticky-colour';

describe('noteStickyColours', () => {
  it("lands draw.io's standard swatches on their kin", () => {
    const fills = ['#fff2cc', '#dae8fc', '#d5e8d4', '#f8cecc', '#e1d5e7', '#ffe6cc'].map(
      (hex) => noteStickyColours(hex)?.fillColor,
    );
    expect(fills).toEqual(['#fde68a', '#bae6fd', '#bbf7d0', '#fecdd3', '#e9d5ff', '#fed7aa']);
  });

  it('keeps grey and white notes neutral, with dark ink', () => {
    expect(noteStickyColours('#f5f5f5')).toEqual({ fillColor: '#ffffff', textColor: '#0f172a' });
    expect(noteStickyColours('#e0e0e0')).toEqual({ fillColor: '#e2e8f0', textColor: '#0f172a' });
  });

  it('reads nothing into a value that is no colour', () => {
    expect(noteStickyColours('nope')).toBeNull();
  });
});
