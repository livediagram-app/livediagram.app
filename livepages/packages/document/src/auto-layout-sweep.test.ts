import { describe, it, expect } from 'vitest';
import { sweepEdgelessNodes } from './auto-layout-sweep';
import { isBoxed, type BoxedElement, type Element } from './index';

const boxes = (els: Element[]) => els.filter(isBoxed);
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;

describe('sweepEdgelessNodes', () => {
  const shape = (id: string, x = 0, y = 0): Element => ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 120,
    height: 120,
    label: id,
  });

  it('moves edgeless nodes out of the origin pile into non-overlapping rows', () => {
    const els = sweepEdgelessNodes([shape('a'), shape('b'), shape('c')]);
    const placed = boxes(els);
    const keys = new Set(placed.map((e) => `${e.x},${e.y}`));
    expect(keys.size).toBe(3);
  });

  it('places them below the connected content and leaves exempt ids alone', () => {
    const connected: Element[] = [
      shape('a', 0, 0),
      shape('b', 0, 300),
      {
        id: 'arr',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'a', anchor: 's' },
        to: { kind: 'pinned', elementId: 'b', anchor: 'n' },
      },
    ];
    const els = sweepEdgelessNodes(
      [...connected, shape('loose', 0, 0), shape('fixed', 10, 10)],
      new Set(['fixed']),
    );
    expect(byId(els, 'loose').y).toBeGreaterThan(byId(els, 'b').y + 120);
    expect(byId(els, 'fixed')).toMatchObject({ x: 10, y: 10 });
  });
});
