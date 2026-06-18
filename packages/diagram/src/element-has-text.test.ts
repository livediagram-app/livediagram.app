import { describe, expect, it } from 'vitest';
import { elementHasText } from './index';
import type { Element } from './index';

// Minimal element stubs — elementHasText only reads `label`.
const withLabel = (label?: string) =>
  ({ type: 'shape', shape: 'square', label }) as unknown as Element;

describe('elementHasText', () => {
  it('is true for a non-empty label', () => {
    expect(elementHasText(withLabel('Hello'))).toBe(true);
  });

  it('is false for a missing label', () => {
    expect(elementHasText(withLabel(undefined))).toBe(false);
  });

  it('is false for an empty or whitespace-only label', () => {
    expect(elementHasText(withLabel(''))).toBe(false);
    expect(elementHasText(withLabel('   '))).toBe(false);
  });

  it('is false for label-less kinds (table / image / annotation)', () => {
    expect(elementHasText({ type: 'table', cells: [['a']] } as unknown as Element)).toBe(false);
    expect(elementHasText({ type: 'image', alt: 'a photo' } as unknown as Element)).toBe(false);
    expect(elementHasText({ type: 'annotation', note: 'hi' } as unknown as Element)).toBe(false);
  });

  it('reads the label on an arrow', () => {
    expect(elementHasText({ type: 'arrow', label: 'flows to' } as unknown as Element)).toBe(true);
  });
});
