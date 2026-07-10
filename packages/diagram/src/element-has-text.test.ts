import { describe, expect, it } from 'vitest';
import { elementHasText, elementSupportsText } from './index';
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

// elementSupportsText is the CAPABILITY check behind the toolbar's
// "Edit text" / "Add text" button: true for label-bearing kinds even with
// no label yet, false for kinds the inline editor refuses.
describe('elementSupportsText', () => {
  const el = (partial: Record<string, unknown>) => partial as unknown as Element;

  it('is true for an unlabelled shape / sticky / arrow', () => {
    expect(elementSupportsText(el({ type: 'shape', shape: 'square' }))).toBe(true);
    expect(elementSupportsText(el({ type: 'sticky' }))).toBe(true);
    expect(elementSupportsText(el({ type: 'arrow' }))).toBe(true);
  });

  it('is false for the self-drawing data shapes', () => {
    expect(elementSupportsText(el({ type: 'shape', shape: 'progress-bar' }))).toBe(false);
    expect(elementSupportsText(el({ type: 'shape', shape: 'pie-chart' }))).toBe(false);
  });

  it('is false for label-less kinds (table / image / annotation)', () => {
    expect(elementSupportsText(el({ type: 'table' }))).toBe(false);
    expect(elementSupportsText(el({ type: 'image' }))).toBe(false);
    expect(elementSupportsText(el({ type: 'annotation' }))).toBe(false);
  });
});
