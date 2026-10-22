import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livedesign/document';
import { aiContextElements } from './ai-context';

const els = (n: number): Element[] =>
  Array.from({ length: n }, (_, i) => ({ ...createShape('square', 0, 0), id: `e${i}` }));

// docs/specs/007-editor/ai-assistance.md: the api takes up to AI_MAX_ELEMENTS elements of context.
describe('aiContextElements', () => {
  it('sends the whole tab while it is within the cap', () => {
    const r = aiContextElements(els(3), ['e1'], 5);
    expect(r.ok && r.elements.map((e) => e.id)).toEqual(['e0', 'e1', 'e2']);
  });

  it('sends only the selection when the tab is over the cap', () => {
    const r = aiContextElements(els(10), ['e2', 'e7'], 5);
    expect(r.ok && r.elements.map((e) => e.id)).toEqual(['e2', 'e7']);
  });

  it('asks for a selection, or a smaller one, rather than failing with a generic error', () => {
    const none = aiContextElements(els(10), [], 5);
    expect(!none.ok && none.message).toMatch(/more than 5 elements\. Select up to 5/);
    const big = aiContextElements(els(10), ['e0', 'e1', 'e2', 'e3', 'e4', 'e5'], 5);
    expect(!big.ok && big.message).toMatch(/up to 5 elements at a time/);
  });
});
