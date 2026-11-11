import { describe, expect, it } from 'vitest';
import { elementHasText, elementSupportsText } from './index';
import type { Element } from './index';

// Minimal element stubs — elementHasText only reads `label`.
const withLabel = (label?: string) =>
  ({ type: 'shape', shape: 'focus-button', label }) as unknown as Element;

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

  it('is true for an unlabelled shape / sticky', () => {
    expect(elementSupportsText(el({ type: 'shape', shape: 'focus-button' }))).toBe(true);
    expect(elementSupportsText(el({ type: 'sticky' }))).toBe(true);
  });

  // Retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4): no text to edit.
  it('is false for a stored arrow, drawing, path or annotation', () => {
    for (const type of ['arrow', 'freehand', 'path', 'annotation'])
      expect(elementSupportsText(el({ type })), type).toBe(false);
  });

  // A deleted shape kind (a stored Q&A Board) is still a shape, but takes no typed label either: the toolbar's
  // Add Text / Edit Text on it opened nothing.
  it('is false for a deleted shape kind', () => {
    expect(elementSupportsText(el({ type: 'shape', shape: 'qa-board' }))).toBe(false);
    expect(elementSupportsText(el({ type: 'shape', shape: 'no-such-kind' }))).toBe(false);
  });

  it('is false for the self-drawing shapes', () => {
    expect(elementSupportsText(el({ type: 'shape', shape: 'sticker' }))).toBe(false);
    expect(elementSupportsText(el({ type: 'shape', shape: 'plant' }))).toBe(false);
  });

  it('is false for label-less kinds (table / image / annotation / link-card)', () => {
    expect(elementSupportsText(el({ type: 'table' }))).toBe(false);
    expect(elementSupportsText(el({ type: 'image' }))).toBe(false);
    expect(elementSupportsText(el({ type: 'annotation' }))).toBe(false);
    // Link-cards render link metadata, never `label`; their double-click
    // opens the link picker, so the text button must not appear.
    expect(elementSupportsText(el({ type: 'link-card' }))).toBe(false);
  });
});
