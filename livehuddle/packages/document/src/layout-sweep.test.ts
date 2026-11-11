import { describe, expect, it } from 'vitest';
import { LAYER_GAP, SIBLING_GAP, sweepEdgelessNodes } from './layout-sweep';
import type { Element } from './index';

// docs/specs/024-agents/blueprints/edit-operations.md EO38: with no arrow joining anything, the edit operations'
// `layout` sweeps every box into rows.

const box = (id: string, x: number, y: number, width = 100, height = 60): Element => ({
  id,
  type: 'shape',
  shape: 'focus-button',
  x,
  y,
  width,
  height,
});

const storedArrow = {
  id: 'arrow',
  type: 'arrow',
  from: { kind: 'free', x: 5, y: 5 },
  to: { kind: 'free', x: 50, y: 50 },
} as Element;

const at = (els: Element[], id: string) => {
  const el = els.find((e) => e.id === id) as { x: number; y: number };
  return { x: el.x, y: el.y };
};

describe('sweepEdgelessNodes', () => {
  it('hands back the same list when there is nothing loose to place', () => {
    const els = [storedArrow];
    expect(sweepEdgelessNodes(els)).toBe(els);
    const placed = [box('a', 10, 10)];
    expect(sweepEdgelessNodes(placed, new Set(['a']))).toBe(placed);
  });

  it('rows boxes from the origin, wrapping at 600, and never moves a stored arrow', () => {
    const els = [
      box('a', 900, 900, 250),
      box('b', 900, 900, 250),
      box('c', 900, 900, 250, 120),
      storedArrow,
    ];
    const out = sweepEdgelessNodes(els);
    expect(at(out, 'a')).toEqual({ x: 0, y: 0 });
    expect(at(out, 'b')).toEqual({ x: 250 + SIBLING_GAP, y: 0 });
    // A third 250 wide box would end past 600: it wraps under the first row's tallest box.
    expect(at(out, 'c')).toEqual({ x: 0, y: 60 + SIBLING_GAP });
    expect(out[3]).toBe(storedArrow);
  });

  it('places the loose boxes under the exempt block, as wide as it, and leaves the block alone', () => {
    const els = [
      box('left', 100, 100, 400, 200),
      box('right', 600, 100, 400, 200),
      box('x', 0, 0, 250),
      box('y', 0, 0, 250),
      box('z', 0, 0, 250),
      box('w', 0, 0, 250),
    ];
    const out = sweepEdgelessNodes(els, new Set(['left', 'right']));
    expect(out[0]).toBe(els[0]);
    expect(out[1]).toBe(els[1]);
    const top = 100 + 200 + LAYER_GAP;
    // The block spans x 100 to 1000, so three 250 wide boxes fit a row and the fourth wraps.
    expect(at(out, 'x')).toEqual({ x: 100, y: top });
    expect(at(out, 'y')).toEqual({ x: 100 + 250 + SIBLING_GAP, y: top });
    expect(at(out, 'z')).toEqual({ x: 100 + 2 * (250 + SIBLING_GAP), y: top });
    expect(at(out, 'w')).toEqual({ x: 100, y: top + 60 + SIBLING_GAP });
  });

  it('keeps a row at least 600 wide under a narrow block', () => {
    const els = [box('tiny', 0, 0, 20, 20), box('a', 0, 0, 250), box('b', 0, 0, 250)];
    const out = sweepEdgelessNodes(els, new Set(['tiny']));
    expect(at(out, 'b').y).toBe(at(out, 'a').y);
  });
});
