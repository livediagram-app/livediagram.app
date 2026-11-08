import { describe, it, expect } from 'vitest';
import { type Element } from './index';
import { buildTab } from './tab-builders';

// Arrows are retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4): buildTab lays
// nothing out and bends nothing, whatever layout an agent asks for.
describe('buildTab', () => {
  const els = [
    { id: 'p', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 },
    { id: 'c', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 },
    {
      id: 'a',
      type: 'arrow',
      arrowStyle: 'angled',
      from: { kind: 'pinned', elementId: 'p', anchor: 's' },
      to: { kind: 'pinned', elementId: 'c', anchor: 'n' },
    },
  ] as Element[];

  it('keeps every box where it was given, even piled at one spot, and a stored arrow as stored', () => {
    for (const layout of ['auto', 'preserve', undefined] as const) {
      const tab = buildTab('t', 'T', els, layout, undefined);
      expect(tab.elements.map((el) => ('x' in el ? [el.x, el.y] : null))).toEqual([
        [0, 0],
        [0, 0],
        null,
      ]);
      expect(tab.elements[2]).toEqual(els[2]);
    }
  });
});
