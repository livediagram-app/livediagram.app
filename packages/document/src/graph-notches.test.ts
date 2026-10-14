import { describe, expect, it } from 'vitest';
import { graphFromMermaid, layoutGraph } from './graph-input';
import { placeElbowLabels } from './graph-look';
import { withoutNotches } from './graph-notches';
import type { ArrowElement, Element } from './index';

const box = (id: string, x: number, y: number, width = 200, height = 60): Element =>
  ({ id, type: 'shape', shape: 'square', x, y, width, height }) as Element;

// An elbow down from a to b, its middle run at the half height, ends where the boxes' anchors put them.
const elbow = (id: string, from: string, to: string, dx: number): Element =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 's' },
    to: { kind: 'pinned', elementId: to, anchor: 'n' },
    arrowStyle: 'angled',
    curvePoints: [
      { dx: -dx / 2, dy: 0 },
      { dx: dx / 2, dy: 0 },
    ],
  }) as Element;

const arrowOf = (els: Element[], id: string) => els.find((e) => e.id === id) as ArrowElement;

describe('withoutNotches', () => {
  it('draws straight an elbow whose ends sit a pixel or two off one line', () => {
    // b's centre is 2 px left of a's, as boxes of different widths centred apart.
    const els = withoutNotches([box('a', 0, 0), box('b', 0, 200, 196), elbow('x', 'a', 'b', -2)]);
    expect(arrowOf(els, 'x').arrowStyle).toBe('straight');
    expect(arrowOf(els, 'x').curvePoints).toBeUndefined();
  });

  it('keeps an elbow whose ends are further apart, a curve, and one joining a bus', () => {
    const far = withoutNotches([box('a', 0, 0), box('b', 40, 200), elbow('x', 'a', 'b', 40)]);
    expect(arrowOf(far, 'x').arrowStyle).toBe('angled');
    const curved = { ...elbow('x', 'a', 'b', -2), arrowStyle: 'curved' } as Element;
    expect(
      arrowOf(withoutNotches([box('a', 0, 0), box('b', 0, 200, 196), curved]), 'x').arrowStyle,
    ).toBe('curved');
    const bus = withoutNotches([
      box('a', 0, 0),
      box('c', 300, 0),
      box('b', 0, 200, 196),
      elbow('x', 'a', 'b', -2),
      elbow('y', 'c', 'b', -300),
    ]);
    expect(arrowOf(bus, 'x').arrowStyle).toBe('angled');
    const straight = withoutNotches([
      box('a', 0, 0),
      box('b', 0, 200),
      { ...elbow('x', 'a', 'b', 0), arrowStyle: 'angled', curvePoints: undefined } as Element,
    ]);
    expect(arrowOf(straight, 'x').arrowStyle).toBe('angled');
  });

  it('keeps the bends of an elbow routed round a box its straight line would cross', () => {
    // a above b, a box between them; the route goes out right and round it, with a short jog where it comes back.
    // a's south anchor is at (100, 60), b's north at (98, 400): the middle of the line is (99, 230).
    const at = (x: number, y: number) => ({ dx: x - 99, dy: y - 230 });
    const round = {
      ...elbow('x', 'a', 'b', 0),
      curvePoints: [
        at(100, 140),
        at(300, 140),
        at(300, 330),
        at(102, 330),
        at(102, 336),
        at(98, 336),
      ],
    } as Element;
    const els = withoutNotches([box('a', 0, 0), box('m', 0, 200), box('b', 0, 400, 196), round]);
    expect(arrowOf(els, 'x').arrowStyle).toBe('angled');
  });

  it('runs before labels are placed, so a straightened line keeps a label placed for it', () => {
    // An eval's bookstore model: two of its elbows are drawn straight.
    const g = graphFromMermaid(
      [
        '---',
        'title: Bookstore data model',
        '---',
        'erDiagram',
        '  direction LR',
        '  AUTHOR ||--o{ BOOK_AUTHOR : writes',
        "  BOOK ||--|{ BOOK_AUTHOR : 'written by'",
        '  PUBLISHER ||--o{ BOOK : publishes',
        '  CUSTOMER ||--o{ ORDER : places',
        '  ORDER ||--|{ ORDER_LINE : contains',
        "  BOOK ||--o{ ORDER_LINE : 'ordered as'",
        '  CUSTOMER ||--o{ REVIEW : writes',
        '  BOOK ||--o{ REVIEW : receives',
        '  BOOK {',
        '    uuid id PK',
        '    string isbn UK',
        '    string title',
        '    uuid publisher_id FK',
        '    date published_on',
        '    decimal price',
        '  }',
        '  AUTHOR {',
        '    uuid id PK',
        '    string name',
        '    string bio',
        '  }',
        '  BOOK_AUTHOR {',
        '    uuid book_id PK, FK',
        '    uuid author_id PK, FK',
        '    int author_order',
        '  }',
        '  PUBLISHER {',
        '    uuid id PK',
        '    string name',
        '    string country',
        '  }',
        '  CUSTOMER {',
        '    uuid id PK',
        '    string email UK',
        '    string name',
        '    string address',
        '  }',
        '  ORDER {',
        '    uuid id PK',
        '    uuid customer_id FK',
        '    datetime placed_at',
        '    string status',
        '    decimal total',
        '  }',
        '  ORDER_LINE {',
        '    uuid order_id PK, FK',
        '    uuid book_id PK, FK',
        '    int quantity',
        '    decimal unit_price',
        '  }',
        '  REVIEW {',
        '    uuid id PK',
        '    uuid book_id FK',
        '    uuid customer_id FK',
        '    int rating',
        '    string body',
        '    datetime created_at',
        '  }',
      ].join('\n'),
    );
    if (!g.ok) throw new Error(g.error);
    const els = layoutGraph(g.graph);
    const straight = els.filter(
      (e): e is ArrowElement => e.type === 'arrow' && e.arrowStyle === 'straight' && !!e.label,
    );
    expect(straight.length).toBeGreaterThan(0);
    // Placing the labels again on the lines as drawn moves none of them.
    const again = new Map(placeElbowLabels(els).map((e) => [e.id, e]));
    for (const a of straight)
      expect((again.get(a.id) as ArrowElement).labelOffset).toEqual(a.labelOffset);
  });
});
