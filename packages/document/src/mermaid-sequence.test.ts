import { describe, expect, it } from 'vitest';
import {
  isSequenceDiagram,
  parseSequenceDiagram,
  SEQUENCE_MAX_PARTICIPANTS,
} from './mermaid-sequence';
import { layoutGraph, graphFromMermaid } from './graph-input';
import type { ArrowElement, Element } from './index';

// docs/specs/020-import-export/mermaid.md "Sequence diagrams (agents)".

const text = `sequenceDiagram
  title Checkout
  autonumber
  actor U as Customer
  participant App
  participant API as Orders API
  U->>App: Place order
  App->>+API: POST /orders
  API->>API: Validate basket
  alt paid
    API-->>-App: 201 Created
  else declined
    API-->>App: 402
  end
  App-)U: Push notification
  Note over App,API: Idempotent by order id`;

describe('parseSequenceDiagram', () => {
  it('reads participants, actors, messages, activations, notes and fragments in order', () => {
    expect(isSequenceDiagram(text)).toBe(true);
    const read = parseSequenceDiagram(text);
    if (!read.ok) throw new Error(read.error);
    const d = read.diagram;
    expect(d.title).toBe('Checkout');
    expect(d.autonumber).toBe(true);
    expect(d.participants).toEqual([
      { id: 'U', label: 'Customer', actor: true },
      { id: 'App', label: 'App' },
      { id: 'API', label: 'Orders API' },
    ]);
    expect(d.items.map((i) => i.kind)).toEqual([
      'message',
      'message',
      'message',
      'fragment',
      'message',
      'else',
      'message',
      'end',
      'message',
      'note',
    ]);
    expect(d.items[1]).toMatchObject({ from: 'App', to: 'API', style: 'call', activate: true });
    expect(d.items[4]).toMatchObject({ style: 'reply', deactivate: true });
    expect(d.items[8]).toMatchObject({ style: 'async' });
    expect(d.items[9]).toMatchObject({ placement: 'over', who: ['App', 'API'] });
  });

  it('refuses a line it cannot read, naming it, and a diagram past the limits', () => {
    const bad = parseSequenceDiagram('sequenceDiagram\n  A ~~ B');
    expect(bad).toEqual({ ok: false, error: expect.stringContaining('A ~~ B') });
    const many = Array.from(
      { length: SEQUENCE_MAX_PARTICIPANTS + 1 },
      (_, i) => `participant P${i}`,
    );
    expect(parseSequenceDiagram(`sequenceDiagram\n${many.join('\n')}`).ok).toBe(false);
  });

  it('skips rect blocks and styling rather than failing', () => {
    const read = parseSequenceDiagram('sequenceDiagram\n  rect rgb(0,0,0)\n  A->>B: hi\n  end');
    expect(read.ok).toBe(true);
  });
});

describe('layoutSequence', () => {
  const draw = () => {
    const g = graphFromMermaid(text);
    if (!g.ok) throw new Error(g.error);
    let n = 0;
    return layoutGraph(g.graph, { makeEdgeId: () => `x${n++}` });
  };
  const arrows = (els: Element[]) => els.filter((e): e is ArrowElement => e.type === 'arrow');

  it('draws a dashed lifeline per participant and a numbered message per row, top to bottom', () => {
    const els = draw();
    const vertical = (a: ArrowElement) =>
      a.from.kind === 'free' && a.to.kind === 'free' && a.from.x === a.to.x && a.from.y !== a.to.y;
    const lifelines = arrows(els).filter(
      (a) => a.arrowEnds === 'none' && a.strokeStyle === 'dashed' && vertical(a),
    );
    expect(lifelines).toHaveLength(3);
    const messages = arrows(els).filter(
      (a) => typeof a.label === 'string' && /^\d+: /.test(a.label),
    );
    expect(messages.map((m) => m.label)).toEqual([
      '1: Place order',
      '2: POST /orders',
      '3: Validate basket',
      '4: 201 Created',
      '5: 402',
      '6: Push notification',
    ]);
    const ys = messages.map((m) => (m.from.kind === 'free' ? m.from.y : 0));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(messages.find((m) => m.label === '4: 201 Created')!.strokeStyle).toBe('dashed');
    expect(messages.every((m) => m.routeBehind === false)).toBe(true);
  });

  it('draws the fragment as a frame with its operator, the actor as a stick figure, the note as a sticky', () => {
    const els = draw();
    expect(els.some((e) => e.type === 'shape' && e.shape === 'frame' && e.label === 'alt')).toBe(
      true,
    );
    expect(els.some((e) => e.type === 'shape' && e.shape === 'actor')).toBe(true);
    expect(els.some((e) => e.type === 'sticky' && e.label === 'Idempotent by order id')).toBe(true);
    expect(els.some((e) => e.type === 'text' && e.label === 'Checkout')).toBe(true);
  });

  it('activates an answered call and the explicit +, but not an unanswered call', () => {
    const els = draw();
    const bars = els.filter((e) => e.type === 'shape' && e.shape === 'square' && e.width === 14);
    // API: the explicit + to its - reply, and the self-call's nested bar. App never is (no call it answers).
    expect(bars.length).toBe(2);
  });

  it('draws only the bars a diagram activates itself, none stacked on its answered calls', () => {
    const g = graphFromMermaid(
      [
        'sequenceDiagram',
        'participant A',
        'participant B',
        'A->>B: request',
        'activate B',
        'B-->>A: response',
        'deactivate B',
      ].join('\n'),
    );
    if (!g.ok) throw new Error(g.error);
    const bars = layoutGraph(g.graph).filter(
      (e) => e.type === 'shape' && e.shape === 'square' && e.width === 14,
    );
    expect(bars.length).toBe(1);
  });

  it('spans a fragment across the lifelines it involves, a nested one inside it', () => {
    const g = graphFromMermaid(
      [
        'sequenceDiagram',
        'participant A',
        'participant B',
        'participant C',
        'participant D',
        'A->>B: start',
        'alt ok',
        'B->>C: check',
        'opt cached',
        'B->>C: reuse',
        'end',
        'else failed',
        'C-->>B: error',
        'end',
        'B-->>A: done',
        'C->>D: log',
      ].join('\n'),
    );
    if (!g.ok) throw new Error(g.error);
    const els = layoutGraph(g.graph);
    const frames = els.filter(
      (e): e is Element & { x: number; width: number } => e.type === 'shape' && e.shape === 'frame',
    );
    const head = (id: string) =>
      els.find((e) => e.id === id) as Element & { x: number; width: number };
    const [outer, inner] = [
      frames.find((f) => f.label === 'alt')!,
      frames.find((f) => f.label === 'opt')!,
    ];
    // Across B and C, not A or D.
    expect(outer.x).toBeGreaterThan(head('A').x + head('A').width);
    expect(outer.x + outer.width).toBeLessThan(head('D').x);
    expect(inner.x).toBeGreaterThan(outer.x);
    expect(inner.x + inner.width).toBeLessThan(outer.x + outer.width);
  });

  it('draws a sequence from a graph: nodes the participants, edges the messages, dashed a reply', () => {
    const els = layoutGraph({
      style: 'sequence',
      nodes: [
        { id: 'a', label: 'Client' },
        { id: 'b', label: 'Server' },
      ],
      edges: [
        { from: 'a', to: 'b', label: 'GET /' },
        { from: 'b', to: 'a', label: '200', line: 'dashed' },
      ],
    });
    const msgs = arrows(els).filter((a) => a.label);
    expect(msgs.map((m) => m.label)).toEqual(['GET /', '200']);
    expect(msgs[1]!.strokeStyle).toBe('dashed');
  });
});
