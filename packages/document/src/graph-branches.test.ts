import { describe, expect, it } from 'vitest';
import { branchExits, withExactEnds } from './graph-branches';
import { layoutGraph } from './graph-input';
import { frameHeadingRect } from './auto-layout-cluster-seats';
import { arrowRoutePoints } from './arrow-label-layout';
import type { Anchor, ArrowElement, BoxedElement, Element } from './index';

// docs/specs/015-api/mcp-server.md §4.7 "The graph look": trunks and buses, and a step's exits by side.

const box = (id: string, x: number, y: number, w = 100, h = 60): BoxedElement =>
  ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h }) as BoxedElement;
const arrow = (
  id: string,
  from: string,
  to: string,
  extra: Partial<ArrowElement> = {},
  anchors: [Anchor, Anchor] = ['s', 'n'],
): ArrowElement =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: anchors[0] },
    to: { kind: 'pinned', elementId: to, anchor: anchors[1] },
    ...extra,
  }) as ArrowElement;
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as ArrowElement;
const fromAnchor = (els: Element[], id: string) => {
  const a = byId(els, id);
  return a.from.kind === 'pinned' ? a.from.anchor : null;
};

describe('withExactEnds', () => {
  it('merges unlabelled ends, and labelled ones only where they all say the same in the same line', () => {
    const els = withExactEnds([
      arrow('u', 'a', 'bus'),
      arrow('p1', 'a', 'bus', { label: 'publish' }),
      arrow('p2', 'b', 'bus', { label: ' Publish ' }),
      arrow('d', 'c', 'bus', { label: 'publish', strokeStyle: 'dashed' }),
      arrow('x', 'c', 'other', { label: 'calls' }),
    ]);
    expect(byId(els, 'u')).toMatchObject({ exactStart: true, exactEnd: true });
    expect(byId(els, 'p1')).toMatchObject({ exactEnd: true });
    expect(byId(els, 'p1').exactStart).toBeUndefined();
    expect(byId(els, 'p2')).toMatchObject({ exactEnd: true });
    // A dashed "publish" says something else: its own end.
    expect(byId(els, 'd').exactEnd).toBeUndefined();
    expect(byId(els, 'x')).toBe(els[4]);
  });

  it('merges a fan out of one node that says the same thing', () => {
    const els = withExactEnds([
      arrow('a', 'src', 'x', { label: 'reads' }),
      arrow('b', 'src', 'y', { label: 'reads' }),
    ]);
    expect(byId(els, 'a')).toMatchObject({ exactStart: true });
    expect(byId(els, 'a').exactEnd).toBeUndefined();
  });
});

describe('withExactEnds by line', () => {
  it('lets only the style most lines at an end have share it, solid on a tie', () => {
    const els = withExactEnds([
      arrow('db', 'orders', 'ordersdb'),
      arrow('ev', 'orders', 'kafka', { strokeStyle: 'dashed' }),
      arrow('ev2', 'pay', 'kafka', { strokeStyle: 'dashed' }),
      arrow('st', 'pay', 'stripe'),
      arrow('ev3', 'cat', 'kafka', { strokeStyle: 'dashed' }),
      arrow('d1', 'cat', 'x', { strokeStyle: 'dotted' }),
      arrow('d2', 'cat', 'y', { strokeStyle: 'dotted' }),
    ]);
    // Out of orders: one solid, one dashed, a tie: the solid keeps the trunk.
    expect(byId(els, 'db').exactStart).toBe(true);
    expect(byId(els, 'ev').exactStart).toBeUndefined();
    // Into kafka every line is dashed: one bus.
    for (const id of ['ev', 'ev2', 'ev3']) expect(byId(els, id).exactEnd).toBe(true);
    // Out of cat two dotted outnumber one dashed.
    expect(byId(els, 'd1').exactStart).toBe(true);
    expect(byId(els, 'ev3').exactStart).toBeUndefined();
  });
});

describe('branchExits', () => {
  it('sends a flow exit whose next step lies clearly aside out of that side', () => {
    const els: Element[] = [
      box('s', 0, 0),
      box('down', 0, 200),
      box('right', 300, 200),
      box('left', -300, 200),
      arrow('d', 's', 'down', { label: 'next' }),
      arrow('r', 's', 'right', { label: 'cancel' }),
      arrow('l', 's', 'left', { label: 'hold' }),
    ];
    const out = branchExits(els, { axis: 'TB' });
    expect(fromAnchor(out, 'd')).toBe('s');
    expect(fromAnchor(out, 'r')).toBe('e');
    expect(fromAnchor(out, 'l')).toBe('w');
  });

  it('keeps one exit on the point, an exit too near, an ineligible one and one whose side is taken', () => {
    const near = branchExits(
      [
        box('s', 0, 0),
        box('a', 60, 200),
        box('b', -40, 200),
        arrow('x', 's', 'a'),
        arrow('y', 's', 'b'),
      ],
      { axis: 'TB' },
    );
    expect([fromAnchor(near, 'x'), fromAnchor(near, 'y')]).toEqual(['s', 's']);
    const two = branchExits(
      [
        box('s', 0, 0),
        box('a', 300, 200),
        box('b', 600, 200),
        arrow('x', 's', 'a'),
        arrow('y', 's', 'b'),
      ],
      { axis: 'TB' },
    );
    // Both lie right: the farther takes the side, the other stays on the point.
    expect([fromAnchor(two, 'y'), fromAnchor(two, 'x')]).toEqual(['e', 's']);
    const els: Element[] = [
      box('s', 0, 0),
      box('a', 0, 200),
      box('b', 300, 200),
      box('in', 300, -200),
      arrow('x', 's', 'a'),
      arrow('y', 's', 'b'),
      arrow('z', 'in', 's', {}, ['w', 'e']),
    ];
    expect(fromAnchor(branchExits(els, { axis: 'TB' }), 'y')).toBe('s');
    expect(
      fromAnchor(branchExits(els.slice(0, 6), { axis: 'TB', eligible: (a) => a.id !== 'y' }), 'y'),
    ).toBe('s');
    expect(branchExits(els.slice(0, 6), { axis: 'TB', eligible: () => false })).toEqual(
      els.slice(0, 6),
    );
  });

  it('keeps an exit whose one bend would run behind a box between on the point', () => {
    const els: Element[] = [
      box('s', 0, 0),
      box('a', 0, 200),
      box('b', 300, 400),
      box('wall', 300, 120),
      arrow('x', 's', 'a'),
      arrow('y', 's', 'b'),
    ];
    expect(fromAnchor(branchExits(els, { axis: 'TB' }), 'y')).toBe('s');
  });

  it('branches across a left-to-right flow by top and bottom', () => {
    const els: Element[] = [
      box('s', 0, 0),
      box('on', 200, 0),
      box('up', 200, -200),
      box('down', 200, 200),
      arrow('o', 's', 'on', {}, ['e', 'w']),
      arrow('u', 's', 'up', {}, ['e', 'w']),
      arrow('d', 's', 'down', {}, ['e', 'w']),
      { ...box('lane', -50, -300, 500, 700), shape: 'lane' } as Element,
    ];
    const out = branchExits(els, { axis: 'LR' });
    expect([fromAnchor(out, 'o'), fromAnchor(out, 'u'), fromAnchor(out, 'd')]).toEqual([
      'e',
      'n',
      's',
    ]);
  });
});

describe('labels off frames', () => {
  it('keeps every label plate off a frame border and its heading', () => {
    const els = layoutGraph(
      {
        direction: 'down',
        lines: 'angled',
        groups: [{ id: 'clients', label: 'Clients', members: ['web', 'mobile'] }],
        nodes: [
          { id: 'web', label: 'Web app' },
          { id: 'mobile', label: 'Mobile app' },
          { id: 'gw', label: 'API gateway' },
        ],
        edges: [
          { from: 'web', to: 'gw', label: 'HTTPS' },
          { from: 'mobile', to: 'gw', label: 'HTTPS' },
        ],
      },
      {
        makeEdgeId: (() => {
          let i = 0;
          return () => `e${i++}`;
        })(),
      },
    );
    const frame = els.find((e) => e.id === 'clients') as BoxedElement;
    const heading = frameHeadingRect(frame)!;
    for (const a of els.filter((e): e is ArrowElement => e.type === 'arrow' && !!e.label)) {
      const pts = arrowRoutePoints(a, els);
      const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y));
      let left = (a.labelOffset?.t ?? 0.5) * lens.reduce((s, l) => s + l, 0);
      let c = pts[0]!;
      for (let i = 0; i < lens.length; i++) {
        if (left <= lens[i]!) {
          const f = lens[i]! ? left / lens[i]! : 0;
          c = {
            x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * f,
            y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * f,
          };
          break;
        }
        left -= lens[i]!;
      }
      const plate = {
        x0: c.x - (a.labelMaxWidth ?? 0) / 2,
        x1: c.x + (a.labelMaxWidth ?? 0) / 2,
        y0: c.y - 11,
        y1: c.y + 11,
      };
      const bottom = frame.y + frame.height;
      expect(plate.y0 < bottom && plate.y1 > bottom, `${a.id} straddles the frame's bottom`).toBe(
        false,
      );
      const onHeading =
        plate.x0 < heading.x + heading.width &&
        plate.x1 > heading.x &&
        plate.y0 < heading.y + heading.height &&
        plate.y1 > heading.y;
      expect(onHeading).toBe(false);
    }
  });
});

describe('labels slide along their run', () => {
  it('keeps a label on a drop between two lanes off both lane borders', () => {
    const els = layoutGraph(
      {
        style: 'lanes',
        nodes: [
          { id: 'phone', label: 'Phone interview', group: 'hm' },
          { id: 'onsite', label: 'Onsite interviews', group: 'panel' },
          { id: 'debrief', label: 'Debrief', group: 'hm' },
        ],
        groups: [
          { id: 'hm', label: 'Hiring manager' },
          { id: 'panel', label: 'Panel' },
        ],
        edges: [
          { from: 'phone', to: 'onsite', label: 'invite onsite' },
          { from: 'onsite', to: 'debrief', label: 'feedback' },
        ],
      },
      {
        makeEdgeId: (() => {
          let i = 0;
          return () => `e${i++}`;
        })(),
      },
    );
    const lanes = els.filter((e): e is BoxedElement => e.type === 'shape' && e.shape === 'lane');
    for (const a of els.filter((e): e is ArrowElement => e.type === 'arrow' && !!e.label)) {
      const pts = arrowRoutePoints(a, els);
      const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y));
      let left = (a.labelOffset?.t ?? 0.5) * lens.reduce((s, l) => s + l, 0);
      let c = pts[0]!;
      for (let i = 0; i < lens.length; i++) {
        if (left <= lens[i]!) {
          const f = lens[i]! ? left / lens[i]! : 0;
          c = {
            x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * f,
            y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * f,
          };
          break;
        }
        left -= lens[i]!;
      }
      const straddles = lanes.some(
        (l) =>
          (c.y - 11 < l.y && c.y + 11 > l.y) ||
          (c.y - 11 < l.y + l.height && c.y + 11 > l.y + l.height),
      );
      expect(straddles, `${a.label} sits across a lane border`).toBe(false);
    }
  });
});
