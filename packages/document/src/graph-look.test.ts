import { describe, expect, it } from 'vitest';
import { layoutGraph, type GraphInput } from './graph-input';
import { labelBoxSize } from './graph-authoring';
import { sideStepEdges, withTones } from './graph-look';
import type { ArrowElement, BoxedElement, Element } from './index';

// The graph look (docs/specs/015-api/mcp-server.md §4.7 "The graph look").

let n = 0;
const ids = () => `e${n++}`;
const lay = (g: GraphInput) => layoutGraph(g, { makeEdgeId: ids });
const box = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;
const arrowTo = (els: Element[], from: string, to: string) =>
  els.find(
    (e): e is ArrowElement =>
      e.type === 'arrow' &&
      e.from.kind === 'pinned' &&
      e.from.elementId === from &&
      e.to.kind === 'pinned' &&
      e.to.elementId === to,
  )!;
const midY = (b: BoxedElement) => b.y + b.height / 2;
const midX = (b: BoxedElement) => b.x + b.width / 2;

const checkout: GraphInput = {
  nodes: [
    { id: 'cart', label: 'Cart', shape: 'stadium' },
    { id: 'signed', label: 'Signed in?', shape: 'diamond' },
    { id: 'signin', label: 'Sign in' },
    { id: 'pay', label: 'Payment' },
    { id: 'ok', label: 'Payment ok?', shape: 'diamond' },
    { id: 'done', label: 'Order placed', shape: 'stadium' },
    { id: 'err', label: 'Show error' },
  ],
  edges: [
    { from: 'cart', to: 'signed' },
    { from: 'signed', to: 'signin', label: 'no' },
    { from: 'signed', to: 'pay', label: 'yes' },
    { from: 'signin', to: 'pay' },
    { from: 'pay', to: 'ok' },
    { from: 'ok', to: 'done', label: 'yes' },
    { from: 'ok', to: 'err', label: 'no' },
    { from: 'err', to: 'pay' },
  ],
};

describe('template sizing', () => {
  it('never draws a palette square: steps are wide and short, decisions wider than tall', () => {
    const step = labelBoxSize('Pay', 'square', { textSize: 'md' });
    expect(step.width).toBeGreaterThanOrEqual(180);
    expect(step.height).toBeLessThan(step.width / 2);
    const decision = labelBoxSize('Ok?', 'diamond', { textSize: 'md' });
    expect(decision.width).toBeGreaterThan(decision.height);
    const circle = labelBoxSize('Learn', 'circle', { textSize: 'md' });
    expect(circle.width).toBe(circle.height);
  });

  it('sets md text up to twelve nodes and sm beyond', () => {
    const textOf = (els: Element[]) =>
      (els.find((e) => e.type === 'shape') as { textSize?: string }).textSize;
    expect(textOf(lay(checkout))).toBe('md');
    const many: GraphInput = {
      nodes: Array.from({ length: 13 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` })),
      edges: Array.from({ length: 12 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}` })),
    };
    expect(textOf(lay(many))).toBe('sm');
  });
});

describe('side steps', () => {
  it('keeps the yes exit on the spine and lays the other beside its decision', () => {
    const flat = sideStepEdges(checkout.nodes, checkout.edges);
    expect([...flat].sort()).toEqual(['ok->err', 'signed->signin']);
    const els = lay(checkout);
    expect(midY(box(els, 'signin'))).toBeCloseTo(midY(box(els, 'signed')), 0);
    expect(midY(box(els, 'err'))).toBeCloseTo(midY(box(els, 'ok')), 0);
    expect(box(els, 'err').x).toBeGreaterThan(box(els, 'ok').x + box(els, 'ok').width);
  });

  it('never sides an exit whose target something else enters', () => {
    const g: GraphInput = {
      nodes: [{ id: 'd', shape: 'diamond' }, { id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { from: 'd', to: 'a', label: 'yes' },
        { from: 'd', to: 'b', label: 'no' },
        { from: 'c', to: 'b' },
      ],
    };
    expect(sideStepEdges(g.nodes, g.edges).size).toBe(0);
  });
});

describe('the spine and loops', () => {
  it('runs the main path down one centre line', () => {
    const els = lay(checkout);
    const line = midX(box(els, 'cart'));
    for (const id of ['signed', 'pay', 'ok', 'done'])
      expect(midX(box(els, id))).toBeCloseTo(line, 0);
  });

  it('sends a loop round the outside as elbows that never cross a box', () => {
    const els = lay(checkout);
    const loop = arrowTo(els, 'err', 'pay');
    expect(loop.arrowStyle).toBe('angled');
    expect(loop.curvePoints?.length).toBeGreaterThan(0);
  });

  it('routes an edge that skips ranks down the spine round the outside too', () => {
    const g: GraphInput = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
        { from: 'a', to: 'd' },
      ],
      direction: 'down',
    };
    const skip = arrowTo(lay(g), 'a', 'd');
    expect(skip.curvePoints?.length).toBe(2);
    expect(skip.from.kind === 'pinned' && skip.from.anchor).toMatch(/^[ew]$/);
  });
});

describe('tones', () => {
  it('makes a flowchart start strong, its end and decisions soft, a node tone overriding', () => {
    const els = withTones(
      lay(checkout),
      checkout.nodes.map((nd) => (nd.id === 'err' ? { ...nd, tone: 'muted' as const } : nd)),
      checkout.edges,
    );
    const preset = (id: string) => (box(els, id) as { colorPreset?: string }).colorPreset;
    expect(preset('cart')).toBe('bold');
    expect(preset('done')).toBe('soft');
    expect(preset('signed')).toBe('soft');
    expect(preset('err')).toBe('outline');
    expect(preset('pay')).toBeUndefined();
  });

  it('leaves a graph without flowchart notation untoned', () => {
    const els = lay({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] });
    expect(els.some((e) => 'colorPreset' in e && e.colorPreset)).toBe(false);
  });

  it('puts a node icon on its box', () => {
    const els = lay({
      nodes: [{ id: 'a', icon: 'database' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect((box(els, 'a') as { iconId?: string }).iconId).toBe('database');
  });
});

describe('title, subtitle and key', () => {
  it('sets a bold title and a muted caption above the drawing, left aligned', () => {
    const els = lay({ ...checkout, title: 'Online checkout', subtitle: 'From cart to order.' });
    const title = els.find(
      (e) => e.type === 'text' && e.label === 'Online checkout',
    ) as BoxedElement & {
      textBold?: boolean;
    };
    const caption = els.find(
      (e) => e.type === 'text' && e.label === 'From cart to order.',
    ) as BoxedElement;
    expect(title.textBold).toBe(true);
    expect(caption.y).toBeGreaterThan(title.y);
    expect(caption.y + caption.height).toBeLessThan(box(els, 'cart').y);
    expect(title.x).toBe(caption.x);
  });

  it('adds a key of the shape kinds used beside the drawing, one row each', () => {
    const els = lay({ ...checkout, key: true });
    const labels = els.filter((e) => e.type === 'text').map((e) => (e as { label?: string }).label);
    expect(labels).toEqual(expect.arrayContaining(['Key', 'Start or end', 'Step', 'Decision']));
    expect(labels).not.toContain('Data store');
  });
});

describe('one size per kind', () => {
  it('gives every box of a kind the size the largest needs, leaving other kinds their own', () => {
    const els = lay({
      nodes: [
        { id: 'a', label: 'Pay' },
        { id: 'b', label: 'Send the receipt and the order summary by email' },
        { id: 'c', label: 'Ok?', shape: 'diamond' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    const [a, b, c] = ['a', 'b', 'c'].map((id) => box(els, id));
    expect([a!.width, a!.height]).toEqual([b!.width, b!.height]);
    expect(c!.width).not.toBe(a!.width);
  });
});

describe('a label over two lines', () => {
  it('is measured line by line: narrower than one line holding both, and taller', () => {
    const one = labelBoxSize('App tasks on ECS Fargate in two zones', 'square', { textSize: 'md' });
    const two = labelBoxSize('App tasks on ECS\nFargate in two zones', 'square', {
      textSize: 'md',
    });
    expect(two.width).toBeLessThan(one.width);
    expect(two.height).toBeGreaterThanOrEqual(one.height);
  });
});

describe('key samples', () => {
  const kinds = (tones: ('muted' | 'soft')[]): GraphInput => ({
    nodes: [
      ...tones.map((tone, i) => ({ id: `s${i}`, label: `S${i}`, shape: 'stadium' as const, tone })),
      { id: 'step', label: 'Step' },
    ],
    edges: tones.map((_, i) => ({ from: `s${i}`, to: 'step' })),
    key: true,
  });
  it('shows a kind in its ordinary look, not the muted exception among it', () => {
    const els = lay(kinds(['soft', 'soft', 'muted']));
    const keyed = els.filter(
      (e) => e.type === 'shape' && e.shape === 'stadium' && e.width < 100,
    ) as { colorPreset?: string }[];
    expect(keyed.map((k) => k.colorPreset)).toEqual(['soft']);
  });

  it('shows the muted look when every one of the kind is muted', () => {
    const els = lay(kinds(['muted']));
    const keyed = els.filter(
      (e) => e.type === 'shape' && e.shape === 'stadium' && e.width < 100,
    ) as { colorPreset?: string }[];
    expect(keyed.map((k) => k.colorPreset)).toEqual(['outline']);
  });
});

describe('key meanings', () => {
  const system: GraphInput = {
    nodes: [
      { id: 'a', label: 'API' },
      { id: 'b', label: 'Bus', shape: 'hexagon' },
      { id: 'c', label: 'DB', shape: 'cylinder' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
  };
  const texts = (els: Element[]) =>
    els.filter((e) => e.type === 'text').map((e) => (e as { label?: string }).label);
  it("names a system diagram's shapes plainly, not by flowchart meanings", () => {
    const labels = texts(lay({ ...system, key: true }));
    expect(labels).toEqual(expect.arrayContaining(['Component', 'Hub or bus', 'Data store']));
    expect(labels).not.toContain('Preparation');
  });
  it('takes meanings given by shape, the rest by default', () => {
    const labels = texts(lay({ ...system, key: { hexagon: 'Event bus' } }));
    expect(labels).toEqual(expect.arrayContaining(['Component', 'Event bus', 'Data store']));
  });
});

describe('lanes', () => {
  it('draws each group as a lane, one under another, a lone hand-off dropping straight down', () => {
    const els = lay({
      style: 'lanes',
      nodes: [
        { id: 'a', label: 'Apply', group: 'cand' },
        { id: 'b', label: 'Screen', group: 'rec' },
        { id: 'c', label: 'Interview', group: 'hm' },
      ],
      groups: [
        { id: 'cand', label: 'Candidate' },
        { id: 'rec', label: 'Recruiter' },
        { id: 'hm', label: 'Hiring manager' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    const lanes = els.filter((e) => e.type === 'shape' && e.shape === 'lane') as BoxedElement[];
    expect(lanes.map((l) => (l as { label?: string }).label)).toEqual([
      'Candidate',
      'Recruiter',
      'Hiring manager',
    ]);
    expect(lanes[1]!.y).toBeGreaterThan(lanes[0]!.y + lanes[0]!.height);
    // Each hand-off is its step's only way out and the next step's only way in: a staircase, one column.
    expect(midX(box(els, 'b'))).toBe(midX(box(els, 'a')));
    expect(midX(box(els, 'c'))).toBe(midX(box(els, 'b')));
    for (const [id, lane] of [
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ] as const) {
      const b = box(els, id);
      expect(b.y).toBeGreaterThanOrEqual(lanes[lane]!.y);
      expect(b.y + b.height).toBeLessThanOrEqual(lanes[lane]!.y + lanes[lane]!.height);
    }
  });

  it('steps right within a lane, and for a hand-off that is not a lone one', () => {
    const els = lay({
      style: 'lanes',
      nodes: [
        { id: 'a', label: 'Apply', group: 'cand' },
        { id: 'b', label: 'Screen', group: 'rec' },
        { id: 'c', label: 'Call', group: 'rec' },
        { id: 'd', label: 'Interview', group: 'hm' },
        { id: 'e', label: 'Offer', group: 'rec' },
      ],
      groups: [
        { id: 'cand', label: 'Candidate' },
        { id: 'rec', label: 'Recruiter' },
        { id: 'hm', label: 'Hiring manager' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
        { from: 'c', to: 'e' },
      ],
    });
    expect(midX(box(els, 'b'))).toBe(midX(box(els, 'a')));
    expect(box(els, 'c').x).toBeGreaterThan(box(els, 'b').x);
    // c has two ways out: neither hand-off keeps its column.
    expect(box(els, 'd').x).toBeGreaterThan(box(els, 'c').x);
  });

  it('gives a staircase hand-off its column back when another step of its lane shares it', () => {
    const els = lay({
      style: 'lanes',
      nodes: [
        { id: 'a', label: 'Apply', group: 'cand' },
        { id: 'x', label: 'Prepare', group: 'rec' },
        { id: 'y', label: 'Wait', group: 'rec' },
        { id: 'b', label: 'Screen', group: 'rec' },
      ],
      groups: [
        { id: 'cand', label: 'Candidate' },
        { id: 'rec', label: 'Recruiter' },
      ],
      edges: [
        { from: 'x', to: 'y' },
        { from: 'a', to: 'b' },
      ],
    });
    // b would share column 0 with x in its lane: it takes a column of its own.
    expect(box(els, 'b').x).toBeGreaterThan(box(els, 'x').x + box(els, 'x').width);
  });

  it('branches a decision: the level exit on its point, the others from its top or bottom', () => {
    const els = lay({
      style: 'lanes',
      nodes: [
        { id: 'start', label: 'Start', group: 'mid' },
        { id: 'd', label: 'Approve?', shape: 'diamond', group: 'mid' },
        { id: 'up', label: 'Escalate', group: 'top' },
        { id: 'on', label: 'Proceed', group: 'mid' },
        { id: 'down', label: 'Reject', group: 'low' },
      ],
      groups: [
        { id: 'top', label: 'Top' },
        { id: 'mid', label: 'Middle' },
        { id: 'low', label: 'Low' },
      ],
      edges: [
        { from: 'start', to: 'd' },
        { from: 'd', to: 'up', label: 'unsure' },
        { from: 'd', to: 'on', label: 'yes' },
        { from: 'd', to: 'down', label: 'no' },
      ],
    });
    const from = (to: string) => {
      const a = arrowTo(els, 'd', to);
      return a.from.kind === 'pinned' ? a.from.anchor : null;
    };
    expect(from('on')).toBe('e');
    expect(from('up')).toBe('n');
    expect(from('down')).toBe('s');
  });

  it('keeps an exit on the point when its side is taken or its step lies too near', () => {
    const els = lay({
      style: 'lanes',
      nodes: [
        { id: 'p', label: 'Phone', group: 'top' },
        { id: 'd', label: 'Pass?', shape: 'diamond', group: 'mid' },
        { id: 'r', label: 'Reject', group: 'top' },
        { id: 'o', label: 'Onsite', group: 'mid' },
      ],
      groups: [
        { id: 'top', label: 'Top' },
        { id: 'mid', label: 'Middle' },
      ],
      edges: [
        { from: 'p', to: 'd' },
        { from: 'd', to: 'r', label: 'no' },
        { from: 'd', to: 'o', label: 'yes' },
      ],
    });
    // The staircase from Phone arrives at the top: "no" stays on the point with "yes".
    const anchor = (to: string) => {
      const a = arrowTo(els, 'd', to);
      return a.from.kind === 'pinned' ? a.from.anchor : null;
    };
    expect(arrowTo(els, 'p', 'd').to).toMatchObject({ anchor: 'n' });
    expect(anchor('r')).not.toBe('n');
    expect(anchor('o')).not.toBe('s');
  });

  it('gives nodes outside every group an unnamed lane of their own', () => {
    const els = lay({
      style: 'lanes',
      nodes: [{ id: 'a', group: 'g' }, { id: 'b' }],
      groups: [{ id: 'g', label: 'G' }],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(els.filter((e) => e.type === 'shape' && e.shape === 'lane')).toHaveLength(2);
  });
});

describe('cycle', () => {
  it('puts the stops on a ring clockwise from the top, a lone node at the centre, edges curved on the arc', () => {
    const els = lay({
      style: 'cycle',
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'hub', label: 'Hub' }],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
        { from: 'd', to: 'a' },
      ],
    });
    const [a, b, hub] = [box(els, 'a'), box(els, 'b'), box(els, 'hub')];
    expect(midY(a)).toBeLessThan(midY(hub));
    expect(midX(b)).toBeGreaterThan(midX(hub));
    expect(midX(hub)).toBeCloseTo((midX(a) + midX(box(els, 'c'))) / 2, 0);
    expect((a as { shape?: string }).shape).toBe('circle');
    expect(arrowTo(els, 'a', 'b').arrowStyle).toBe('curved');
  });
});

describe('mindmap', () => {
  it('draws mind nodes: a bold round root, hued branches on both sides, connectors without heads', () => {
    const els = lay({
      style: 'mindmap',
      nodes: [
        { id: 'c', label: 'Launch' },
        { id: 'a', label: 'Marketing' },
        { id: 'b', label: 'Pricing' },
        { id: 'd', label: 'Logistics' },
        { id: 'a1', label: 'Instagram' },
      ],
      edges: [
        { from: 'c', to: 'a' },
        { from: 'c', to: 'b' },
        { from: 'c', to: 'd' },
        { from: 'a', to: 'a1' },
      ],
    });
    const node = (id: string) =>
      box(els, id) as BoxedElement & { shape?: string; mindParentId?: string };
    expect(node('c').shape).toBe('mind-node');
    expect((node('c') as { colorPreset?: string }).colorPreset).toBe('bold');
    expect(node('a1').mindParentId).toBe('a');
    const sides = ['a', 'b', 'd'].map((id) => Math.sign(midX(box(els, id)) - midX(box(els, 'c'))));
    expect(new Set(sides).size).toBe(2);
    const connector = arrowTo(els, 'c', 'a');
    expect(connector.arrowEnds).toBe('none');
    expect(connector.arrowStyle).toBe('curved');
  });
});

describe('tree', () => {
  it("stacks a manager's leaf reports in a column under them, joined by a bus", () => {
    const els = lay({
      style: 'tree',
      nodes: [{ id: 'ceo' }, { id: 'cto' }, { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'coo' }],
      edges: [
        { from: 'ceo', to: 'cto' },
        { from: 'ceo', to: 'coo' },
        { from: 'cto', to: 'a' },
        { from: 'cto', to: 'b' },
        { from: 'cto', to: 'c' },
      ],
    });
    const [a, b, c, cto] = ['a', 'b', 'c', 'cto'].map((id) => box(els, id));
    expect(a!.x).toBe(b!.x);
    expect(b!.y).toBeGreaterThan(a!.y);
    expect(c!.y).toBeGreaterThan(b!.y);
    expect(a!.x).toBeGreaterThan(cto!.x);
    const bus = arrowTo(els, 'cto', 'b');
    expect(bus.from.kind === 'pinned' && bus.from.anchor).toBe('ssw');
    expect(bus.to.kind === 'pinned' && bus.to.anchor).toBe('w');
  });
});

describe('storm', () => {
  it('lays an event-storming wall: a column per event, a lane per kind, notes whole, no arrows', () => {
    const policy = 'Whenever an order is placed, authorise the payment straight away';
    const els = lay({
      style: 'storm',
      nodes: [
        { id: 'cust', label: 'Customer', esKind: 'actor' },
        { id: 'place', label: 'Place order', esKind: 'command' },
        { id: 'placed', label: 'Order placed', esKind: 'domain-event' },
        { id: 'p1', label: policy, esKind: 'policy' },
        { id: 'auth', label: 'Authorise payment', esKind: 'command' },
        { id: 'authd', label: 'Payment authorised', esKind: 'domain-event' },
      ],
      edges: [
        { from: 'cust', to: 'place' },
        { from: 'place', to: 'placed' },
        { from: 'placed', to: 'p1' },
        { from: 'p1', to: 'auth' },
        { from: 'auth', to: 'authd' },
      ],
    });
    expect(els.some((e) => e.type === 'arrow')).toBe(false);
    const labels = els.filter((e) => e.type === 'text').map((e) => (e as { label?: string }).label);
    expect(labels).toEqual(
      expect.arrayContaining(['Actors', 'Commands', 'Domain events', 'Policies']),
    );
    const note = (id: string) => box(els, id) as BoxedElement & { esKind?: string; label?: string };
    expect(note('p1').label).toBe(policy);
    expect(note('placed').esKind).toBe('domain-event');
    // Columns: the first command with its event, the policy under the event it follows, the next command onward.
    expect(midX(note('place'))).toBeCloseTo(midX(note('placed')), 0);
    expect(midX(note('p1'))).toBeCloseTo(midX(note('placed')), 0);
    expect(midX(note('auth'))).toBeCloseTo(midX(note('authd')), 0);
    expect(midX(note('authd'))).toBeGreaterThan(midX(note('placed')));
    // Lanes: actor over command over event over policy.
    expect(midY(note('cust'))).toBeLessThan(midY(note('place')));
    expect(midY(note('place'))).toBeLessThan(midY(note('placed')));
    expect(midY(note('placed'))).toBeLessThan(midY(note('p1')));
  });

  it('makes a new tab an event-storming board', async () => {
    const { buildGraphTab } = await import('./tab-builders');
    const tab = buildGraphTab(
      't',
      'Wall',
      { style: 'storm', nodes: [{ id: 'a', label: 'Happened' }], edges: [] },
      undefined,
    );
    expect(tab.kind).toBe('event-storming');
    expect(tab.esLanesSettled).toBe(true);
  });
});
