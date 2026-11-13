import { describe, it, expect } from 'vitest';
import type { ArrowElement, Element } from './element';
import { buildTabWith } from './tab-builders';

const buildTab = (
  ...args: [string, string, Element[], 'auto' | 'preserve' | undefined, string | undefined]
) =>
  buildTabWith(
    { coerceShapeKind: (shape) => (typeof shape === 'string' ? shape : 'square') },
    ...args,
  );

describe("buildTab bends an agent's facing angled arrows", () => {
  it('gives a bottom-to-top arrow into a lower box two bends', () => {
    const els = [
      { id: 'p', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 },
      { id: 'c', type: 'shape', shape: 'square', x: 300, y: 200, width: 100, height: 60 },
      {
        id: 'a',
        type: 'arrow',
        arrowStyle: 'angled',
        from: { kind: 'pinned', elementId: 'p', anchor: 's' },
        to: { kind: 'pinned', elementId: 'c', anchor: 'n' },
      },
    ] as Element[];
    const tab = buildTab('t', 'T', els, 'preserve', undefined);
    expect((tab.elements[2] as ArrowElement).curvePoints).toHaveLength(2);
  });
});

describe('buildTab', () => {
  it('coerces shape kinds, settles, and paints the theme onto the tab', () => {
    const els = [
      { id: 'p', type: 'shape', shape: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
    ] as Element[];
    const tab = buildTabWith(
      {
        coerceShapeKind: () => 'square',
        settle: (list) => list.map((el) => ({ ...el, label: 'settled' })),
      },
      't',
      'T',
      els,
      'preserve',
      undefined,
    );
    expect(tab.elements[0]).toMatchObject({ shape: 'square', label: 'settled' });
    expect(tab.theme).toBe('brand');
  });

  it('lays out a pile of nodes when asked or when they look unplaced', () => {
    const pile = ['a', 'b', 'c'].map((id): Element => ({
      id,
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    }));
    const arrows = [
      {
        id: 'ab',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
      },
      {
        id: 'bc',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'b', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'c', anchor: 'w' },
      },
    ] as Element[];
    const tab = buildTab('t', 'T', [...pile, ...arrows], undefined, undefined);
    const spots = tab.elements
      .filter((el) => el.type === 'shape')
      .map((el) => `${(el as { x: number }).x},${(el as { y: number }).y}`);
    expect(new Set(spots).size).toBe(3);
  });
});
