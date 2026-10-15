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

  it('keeps a decision\'s labelled exits on their own ends: two decisions\' "no" never share one bus', () => {
    const diamond = (id: string, x: number) =>
      ({ ...box(id, x, 0), shape: 'diamond' }) as BoxedElement;
    const els = withExactEnds([
      diamond('fit', 0),
      diamond('hire', 300),
      box('reject', 150, 200),
      arrow('n1', 'fit', 'reject', { label: 'no' }),
      arrow('n2', 'hire', 'reject', { label: 'no' }),
      arrow('p1', 'a', 'bus', { label: 'publish' }),
      arrow('p2', 'b', 'bus', { label: 'publish' }),
    ]);
    expect(byId(els, 'n1').exactEnd).toBeUndefined();
    expect(byId(els, 'n2').exactEnd).toBeUndefined();
    // Steps saying the same thing into one node still merge.
    expect(byId(els, 'p1')).toMatchObject({ exactEnd: true });
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

describe('withExactEnds: who counts', () => {
  it('reads an explicit solid line and an unset one as the same line', () => {
    const els = withExactEnds([
      arrow('p1', 'a', 'bus', { label: 'publish', strokeStyle: 'solid' }),
      arrow('p2', 'b', 'bus', { label: 'publish' }),
    ]);
    expect(byId(els, 'p1')).toMatchObject({ exactEnd: true });
    expect(byId(els, 'p2')).toMatchObject({ exactEnd: true });
  });

  it('lets alike lines share a trunk though more lines of another style leave there, each saying its own thing', () => {
    const els = withExactEnds([
      arrow('get', 'svc', 'x', { label: 'GET' }),
      arrow('post', 'svc', 'y', { label: 'POST' }),
      arrow('put', 'svc', 'z', { label: 'PUT' }),
      arrow('e1', 'svc', 'q', { strokeStyle: 'dashed' }),
      arrow('e2', 'svc', 'r', { strokeStyle: 'dashed' }),
    ]);
    expect(byId(els, 'e1')).toMatchObject({ exactStart: true });
    expect(byId(els, 'e2')).toMatchObject({ exactStart: true });
    expect(byId(els, 'get').exactStart).toBeUndefined();
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

describe('ends beside a trunk', () => {
  it('moves an end that keeps its place off a trunk anchor to the quarter toward its other end', () => {
    const els = withExactEnds([
      box('orders', 0, 0),
      box('db', -200, 200),
      box('kafka', 400, 200),
      box('ahead', 0, 400),
      arrow('t', 'orders', 'db'),
      arrow('e', 'orders', 'kafka', { label: 'publish', strokeStyle: 'dashed' }),
      arrow('s', 'orders', 'ahead', { label: 'audit' }),
      arrow('w', 'db', 'orders', {}, ['e', 'w']),
    ]);
    expect(byId(els, 't')).toMatchObject({ exactStart: true, from: { anchor: 's' } });
    expect(byId(els, 'e').from).toMatchObject({ anchor: 'sse' });
    // Straight ahead, it stays on the middle.
    expect(byId(els, 's').from).toMatchObject({ anchor: 's' });
    const left = withExactEnds([
      box('a', 0, 0),
      box('b', 0, 200),
      box('c', -400, 200),
      arrow('t', 'a', 'b'),
      arrow('x', 'a', 'c', { label: 'x' }),
    ]);
    expect(byId(left, 'x').from).toMatchObject({ anchor: 'ssw' });
  });

  it('leaves ends where no trunk sits, and an end into a bus too', () => {
    const els = withExactEnds([
      box('a', 0, 0),
      box('b', 300, 200),
      arrow('x', 'a', 'b', { label: 'one' }),
      arrow('y', 'a', 'b', { label: 'two' }),
    ]);
    expect(byId(els, 'x').from).toMatchObject({ anchor: 's' });
    const bus = withExactEnds([
      box('p', 0, 0),
      box('q', 200, 0),
      box('k', 600, 300),
      arrow('p1', 'p', 'k'),
      arrow('q1', 'q', 'k'),
      arrow('ev', 'q', 'k', { label: 'events', strokeStyle: 'dashed' }),
    ]);
    expect(byId(bus, 'ev').to).toMatchObject({ anchor: 'nnw' });
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

  it('sends two exits clearly either side out of their two sides, none left on the point', () => {
    // A decision whose accept lies above and decline below, the flow running right: up and down, not tip and corner.
    const out = branchExits(
      [
        box('s', 0, 0),
        box('up', 300, -200),
        box('down', 300, 200),
        arrow('a', 's', 'up', { label: 'Accept' }, ['e', 'w']),
        arrow('d', 's', 'down', { label: 'Decline' }, ['e', 'w']),
      ],
      { axis: 'LR' },
    );
    expect([fromAnchor(out, 'a'), fromAnchor(out, 'd')]).toEqual(['n', 's']);
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
  it("leaves a lanes decision's exits on its side when the lines are not angled", () => {
    const exitsOf = (lines: 'straight' | 'angled') =>
      layoutGraph({
        style: 'lanes',
        lines,
        nodes: [
          { id: 'check', label: 'Approved?', shape: 'diamond', group: 'a' },
          { id: 'yes', label: 'Ship', group: 'b' },
          { id: 'no', label: 'Rework', group: 'c' },
        ],
        groups: [
          { id: 'a', label: 'Review' },
          { id: 'b', label: 'Release' },
          { id: 'c', label: 'Build' },
        ],
        edges: [
          { from: 'check', to: 'yes', label: 'yes' },
          { from: 'check', to: 'no', label: 'no' },
        ],
      })
        .filter((e): e is ArrowElement => e.type === 'arrow')
        .map((a) => (a.from.kind === 'pinned' ? a.from.anchor : null));
    // Angled, one exit leaves by the top or bottom, squared by its elbow.
    expect(exitsOf('angled').some((a) => a === 'n' || a === 's')).toBe(true);
    // Straight, nothing turns it: both leave the side facing their targets.
    expect(exitsOf('straight').some((a) => a === 'n' || a === 's')).toBe(false);
  });

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

describe('labels off other lines', () => {
  it('moves a label off a run another, unlabelled line crosses', async () => {
    const { placeElbowLabels } = await import('./graph-look');
    const { withOrthogonalBends } = await import('./arrow-orthogonal');
    // s's right side to t's top: one bend, then a drop that an unlabelled line crosses at its middle.
    const els = withOrthogonalBends(
      [
        box('s', 0, 0),
        box('t', 400, 300),
        arrow('a', 's', 't', { label: 'deploys to staging', arrowStyle: 'angled' }, ['e', 'n']),
        {
          id: 'b',
          type: 'arrow',
          from: { kind: 'free', x: 300, y: 165 },
          to: { kind: 'free', x: 600, y: 165 },
        } as ArrowElement,
      ],
      'TB',
    );
    const placed = placeElbowLabels(els);
    const a = placed.find((e) => e.id === 'a') as ArrowElement;
    const pts = arrowRoutePoints(a, placed);
    const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y));
    let left = a.labelOffset!.t * lens.reduce((s, l) => s + l, 0);
    let y = pts[0]!.y;
    for (let i = 0; i < lens.length; i++) {
      if (left <= lens[i]!) {
        y = pts[i]!.y + ((pts[i + 1]!.y - pts[i]!.y) * left) / lens[i]!;
        break;
      }
      left -= lens[i]!;
    }
    // The plate (22px tall) is clear of the crossing line at y = 165.
    expect(Math.abs(y - 165)).toBeGreaterThan(11);
  });
});
