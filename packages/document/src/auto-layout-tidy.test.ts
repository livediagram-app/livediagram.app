import { describe, expect, it } from 'vitest';
import { autoLayoutElements } from './auto-layout';
import { clearPlacement, tidyDirection, tidyMindmapFits } from './auto-layout-tidy';
import { createPinnedArrow, createText } from './factories';
import { createShape } from './shape-factory';
import { arrowPathPolyline } from './arrow-path';
import { endpointPosition } from './geometry';
import type { Anchor, ArrowElement, BoxedElement, Element, ShapeElement, ShapeKind } from './index';

// docs/specs/008-canvas/layout-cleanup.md "Tidy Up keeps a flowchart a flowchart" and "What moves together".

function box(
  id: string,
  x: number,
  y: number,
  w = 220,
  h = 70,
  kind: ShapeKind = 'square',
): ShapeElement {
  return { ...createShape(kind, x, y), id, width: w, height: h, label: id };
}
function link(
  from: string,
  fa: Anchor,
  to: string,
  ta: Anchor,
  extra: Partial<ArrowElement> = {},
): ArrowElement {
  return { ...createPinnedArrow(from, fa, to, ta), id: `${from}>${to}`, ...extra };
}
const find = (out: Element[], id: string) => out.find((e) => e.id === id) as BoxedElement;
const cx = (b: BoxedElement) => b.x + b.width / 2;
const cy = (b: BoxedElement) => b.y + b.height / 2;
const tidy = (els: Element[], extra: Parameters<typeof autoLayoutElements>[1] = {}) =>
  autoLayoutElements(els, { tidy: true, ...extra });

// The checkout template's flow, drawn as a person would: a title above, a spine of mixed widths, two
// decisions whose No exits step aside, a retry loop back up the side and a back-order rejoining.
function checkout(): Element[] {
  const title = {
    ...createText(100, 20),
    id: 'title',
    width: 600,
    height: 40,
    label: 'Checkout flow',
  };
  return [
    title,
    box('start', 141, 115, 220, 64, 'stadium'),
    box('card', 126, 222, 250, 72, 'parallelogram'),
    box('charge', 141, 338, 220, 72),
    box('paid', 146, 454, 210, 120, 'diamond'),
    box('stock', 146, 618, 210, 120, 'diamond'),
    box('receipt', 141, 782, 220, 84, 'document'),
    box('end', 141, 910, 220, 64, 'stadium'),
    box('error', 486, 478, 220, 72),
    box('backorder', 486, 642, 220, 72),
    link('start', 's', 'card', 'n'),
    link('card', 's', 'charge', 'n'),
    link('charge', 's', 'paid', 'n'),
    link('paid', 's', 'stock', 'n', { label: 'Yes' }),
    link('paid', 'e', 'error', 'w', { label: 'No' }),
    link('error', 'n', 'card', 'e', { label: 'Try again', arrowStyle: 'angled' }),
    link('stock', 's', 'receipt', 'n', { label: 'Yes' }),
    link('stock', 'e', 'backorder', 'w', { label: 'No' }),
    link('backorder', 's', 'receipt', 'e', { arrowStyle: 'angled' }),
    link('receipt', 's', 'end', 'n'),
  ];
}
const SPINE = ['start', 'card', 'charge', 'paid', 'stock', 'receipt', 'end'];

// Points along an arrow as drawn, every few px, to test what it passes through.
function drawnPoints(a: ArrowElement, els: Element[]) {
  const from = endpointPosition(a.from, els);
  const to = endpointPosition(a.to, els);
  return arrowPathPolyline(
    a.arrowStyle ?? 'straight',
    from,
    to,
    a.from,
    a.to,
    a.curveOffset,
    a.elbowOffset,
    a.curvePoints,
  );
}
function crossesBox(points: { x: number; y: number }[], b: BoxedElement): boolean {
  for (let i = 0; i + 1 < points.length; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    for (let t = 0; t <= 1; t += 0.05) {
      const x = p.x + (q.x - p.x) * t;
      const y = p.y + (q.y - p.y) * t;
      if (x > b.x + 2 && x < b.x + b.width - 2 && y > b.y + 2 && y < b.y + b.height - 2)
        return true;
    }
  }
  return false;
}

describe('Tidy Up on a flowchart', () => {
  for (const style of [{}, { style: 'flow' as const, direction: 'TB' as const }]) {
    const label = 'direction' in style ? 'Flowchart Down' : 'Smart';
    it(`${label} keeps the spine in one straight column, sizes as drawn`, () => {
      const out = tidy(checkout(), style);
      const spine = SPINE.map((id) => find(out, id));
      for (const b of spine) expect(cx(b)).toBe(cx(spine[0]!));
      for (let i = 1; i < spine.length; i++)
        expect(spine[i]!.y).toBeGreaterThan(spine[i - 1]!.y + spine[i - 1]!.height);
      // A decision stays the wide diamond it was drawn as.
      expect(find(out, 'paid')).toMatchObject({ width: 210, height: 120 });
      expect(find(out, 'card')).toMatchObject({ width: 250, height: 72 });
    });

    it(`${label} keeps each No step level beside its decision`, () => {
      const out = tidy(checkout(), style);
      for (const [step, gate] of [
        ['error', 'paid'],
        ['backorder', 'stock'],
      ] as const) {
        expect(cy(find(out, step))).toBe(cy(find(out, gate)));
        expect(find(out, step).x).toBeGreaterThan(find(out, gate).x + find(out, gate).width);
      }
    });

    it(`${label} routes every arrow square, through no box but its own two`, () => {
      const out = tidy(checkout(), style);
      const boxes = out.filter((e): e is BoxedElement => e.type !== 'arrow');
      for (const a of out.filter((e): e is ArrowElement => e.type === 'arrow')) {
        const pts = drawnPoints(a, out);
        for (let i = 0; i + 1 < pts.length; i++) {
          const horizontal = Math.abs(pts[i]!.y - pts[i + 1]!.y) < 1;
          const vertical = Math.abs(pts[i]!.x - pts[i + 1]!.x) < 1;
          expect(horizontal || vertical, `${a.id} leg ${i}`).toBe(true);
        }
        const own = [a.from, a.to].map((e) => (e.kind === 'pinned' ? e.elementId : ''));
        for (const b of boxes)
          if (!own.includes(b.id))
            expect(crossesBox(pts, b), `${a.id} crosses ${b.id}`).toBe(false);
      }
    });

    it(`${label} leaves the title alone and stays clear of it`, () => {
      const els = checkout();
      const out = tidy(els, style);
      expect(find(out, 'title')).toBe(find(els, 'title'));
      expect(find(out, 'start').y).toBeGreaterThanOrEqual(60);
    });

    it(`${label} is settled: tidying the result changes nothing`, () => {
      const once = tidy(checkout(), style);
      const twice = tidy(once, style);
      for (const id of [...SPINE, 'error', 'backorder'])
        expect(find(twice, id)).toMatchObject({ x: find(once, id).x, y: find(once, id).y });
    });
  }

  it('reads the drawing as top to bottom though the loop arrows run wide', () => {
    const els = checkout();
    const centres = new Map(
      els
        .filter((e): e is BoxedElement => e.type !== 'arrow')
        .map((b) => [b.id, { x: cx(b), y: cy(b) }]),
    );
    const edges = els
      .filter((e): e is ArrowElement => e.type === 'arrow')
      .map((a) => ({
        from: (a.from as { elementId: string }).elementId,
        to: (a.to as { elementId: string }).elementId,
      }));
    expect(tidyDirection(centres, edges)).toBe('TB');
  });

  it('keeps a yes / no tree drawn with both answers below a tree', () => {
    const els = [
      box('q', 300, 0, 200, 110, 'diamond'),
      box('no', 0, 220),
      box('yes', 560, 220),
      link('q', 'w', 'no', 'n', { label: 'No' }),
      link('q', 'e', 'yes', 'n', { label: 'Yes' }),
    ];
    const out = tidy(els);
    expect(find(out, 'no').y).toBe(find(out, 'yes').y);
    expect(find(out, 'no').y).toBeGreaterThan(find(out, 'q').y + find(out, 'q').height);
  });
});

describe('what moves together', () => {
  it('moves a panel and everything in it as one rigid block', () => {
    const els: Element[] = [
      box('ceo', 400, 0),
      box('panel', 0, 400, 300, 400),
      box('head', 40, 440),
      box('report', 40, 560),
      box('other', 800, 300),
      link('ceo', 's', 'head', 'n'),
      link('head', 's', 'report', 'n'),
      link('ceo', 's', 'other', 'n'),
    ];
    const out = tidy(els);
    const dx = find(out, 'panel').x - 0;
    const dy = find(out, 'panel').y - 400;
    expect(find(out, 'head')).toMatchObject({ x: 40 + dx, y: 440 + dy });
    expect(find(out, 'report')).toMatchObject({ x: 40 + dx, y: 560 + dy });
    // The arrow inside the panel is left as drawn; the one into it is pinned to the shape inside.
    expect(out.find((e) => e.id === 'head>report')).toBe(els.find((e) => e.id === 'head>report'));
    const into = out.find((e) => e.id === 'ceo>head') as ArrowElement;
    expect(into.to).toMatchObject({ kind: 'pinned', elementId: 'head' });
  });

  it('carries a badge with the shape it sits on', () => {
    const badge = box('badge', 600, 390, 24, 24);
    const els: Element[] = [box('a', 0, 0), box('b', 400, 400), badge, link('a', 's', 'b', 'n')];
    const out = tidy(els);
    const b = find(out, 'b');
    expect(find(out, 'badge').x - b.x).toBe(600 - 400);
    expect(find(out, 'badge').y - b.y).toBe(390 - 400);
  });

  it('routes a dashed arrow without letting it shape the layout', () => {
    const els: Element[] = [
      box('boss', 300, 0),
      box('a', 0, 200),
      box('b', 600, 200),
      link('boss', 's', 'a', 'n'),
      link('boss', 's', 'b', 'n'),
      link('a', 'e', 'b', 'w', { strokeStyle: 'dashed' }),
    ];
    const out = tidy(els);
    expect(find(out, 'a').y).toBe(find(out, 'b').y);
  });
});

describe('placement clear of what stays put', () => {
  it('stays put when nothing is in the way', () => {
    expect(clearPlacement([{ x: 0, y: 0, width: 100, height: 100 }], [], 5, 7)).toEqual([5, 7]);
  });

  it('steps down rather than up past a box above-ish', () => {
    const [dx, dy] = clearPlacement(
      [{ x: 0, y: 0, width: 100, height: 100 }],
      [{ x: 0, y: -10, width: 100, height: 40 }],
      0,
      0,
    );
    expect(dx).toBe(0);
    expect(dy).toBeGreaterThan(0);
  });
});

describe('tidyMindmapFits', () => {
  it('fits branches, not loops', () => {
    const tree = [
      box('r', 0, 0),
      box('a', 300, 0),
      box('b', 0, 300),
      link('r', 'e', 'a', 'w'),
      link('r', 's', 'b', 'n'),
    ];
    expect(tidyMindmapFits(tree)).toBe(true);
    expect(tidyMindmapFits([...tree, link('a', 's', 'b', 'e')])).toBe(false);
  });
});
