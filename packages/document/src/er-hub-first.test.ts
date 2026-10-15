// ER relationships hub first (docs/specs/020-import-export/mermaid.md "Hub first").
import { describe, expect, it } from 'vitest';
import { hubFirst, reversedArrow } from './er-hub-first';
import { arrowPolyline } from './arrow-path-hits';
import { elementIndexFor } from './geometry';
import { layoutGraph, resolveGraphInput } from './graph-input';
import type { ArrowElement } from './index';
import type { GraphEdge } from './graph-authoring';

const rel = (from: string, to: string): GraphEdge => ({
  from,
  to,
  ends: 'both',
  er: { from: 'one', to: 'zero-or-many' },
});

describe('hubFirst', () => {
  it('turns each cluster away from its own best-connected entity (the first declared on a tie), and leaves an unknown end alone', () => {
    const out = hubFirst(
      ['a', 'hub', 'b', 'c', 'x', 'y'],
      [rel('a', 'hub'), rel('b', 'hub'), rel('hub', 'c'), rel('y', 'x'), rel('ghost', 'c')],
    );
    expect(out.map((e) => `${e.from}>${e.to}`)).toEqual([
      'hub>a',
      'hub>b',
      'hub>c',
      'x>y',
      'ghost>c',
    ]);
    expect(out[0]!.er).toEqual({ from: 'zero-or-many', to: 'one' });
    expect(out[2]!.er).toEqual({ from: 'one', to: 'zero-or-many' });
  });
});

describe('turned back after layout', () => {
  const bookstore = [
    'erDiagram',
    '  AUTHOR ||--o{ BOOK_AUTHOR : writes',
    '  BOOK_AUTHOR }|--|| BOOK : credits',
    '  PUBLISHER ||--o{ BOOK : publishes',
    '  ORDER_LINE }o--|| BOOK : "is for"',
    '  BOOK ||--o{ REVIEW : receives',
  ].join('\n');

  it('stores each relationship the way it was written, its ends on the right tables', () => {
    const graph = resolveGraphInput({ mermaid: bookstore }).graph!;
    const arrows = layoutGraph(graph).filter((e): e is ArrowElement => e.type === 'arrow');
    const read = (label: string) => {
      const a = arrows.find((x) => x.label === label)!;
      const id = (end: ArrowElement['from']) => (end.kind === 'pinned' ? end.elementId : '');
      return [id(a.from), id(a.to), a.arrowheadStartShape ?? a.arrowheadShape, a.arrowheadShape];
    };
    expect(read('writes')).toEqual(['AUTHOR', 'BOOK_AUTHOR', 'one', 'zero-or-many']);
    expect(read('credits')).toEqual(['BOOK_AUTHOR', 'BOOK', 'one-or-many', 'one']);
    expect(read('publishes')).toEqual(['PUBLISHER', 'BOOK', 'one', 'zero-or-many']);
  });

  it('draws a reversed arrow as the same line, walked the other way', () => {
    const graph = resolveGraphInput({ mermaid: bookstore }).graph!;
    const laid = layoutGraph(graph);
    const index = elementIndexFor(laid);
    for (const a of laid.filter((e): e is ArrowElement => e.type === 'arrow')) {
      const back = reversedArrow(a);
      const swapped = laid.map((e) => (e.id === a.id ? back : e));
      expect(arrowPolyline(back, elementIndexFor(swapped))).toEqual(
        [...arrowPolyline(a, index)].reverse(),
      );
    }
  });
});
