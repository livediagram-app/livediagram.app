import { describe, expect, it } from 'vitest';
import { graphFromMermaid, layoutGraph, type GraphInput } from './graph-input';
import { anchorPrimarySide } from './anchors';
import type { ArrowElement, BoxedElement, Element } from './index';

// A shared end in swimlanes (docs/specs/015-api/mcp-server.md §4.7 "Lanes stay compact and their decisions branch"):
// stacks ordered by their feeders, a hand-off along its lane lined up straight.

let n = 0;
const lay = (g: GraphInput) => layoutGraph(g, { makeEdgeId: () => `e${n++}` });
const box = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;
const lane = (els: Element[], id: string) => box(els, id);
const midY = (b: BoxedElement) => b.y + b.height / 2;
const arrow = (els: Element[], from: string, to: string) =>
  els.find(
    (e): e is ArrowElement =>
      e.type === 'arrow' &&
      e.from.kind === 'pinned' &&
      e.from.elementId === from &&
      e.to.kind === 'pinned' &&
      e.to.elementId === to,
  )!;
const anchorOf = (end: ArrowElement['to']) => (end.kind === 'pinned' ? end.anchor : null);

// An evaluator's hiring flow: two decisions' "No" into one rejection.
const hiring: GraphInput = {
  style: 'lanes',
  groups: [
    { id: 'cand', label: 'Candidate' },
    { id: 'rec', label: 'Recruiter' },
    { id: 'hm', label: 'Hiring manager' },
    { id: 'panel', label: 'Panel' },
  ],
  nodes: [
    { id: 'apply', label: 'Submit application', shape: 'stadium', group: 'cand' },
    { id: 'screen', label: 'Screen application', group: 'rec' },
    { id: 'pass', label: 'Meets the bar?', shape: 'diamond', group: 'rec' },
    { id: 'phone', label: 'Phone interview', group: 'hm' },
    { id: 'onsite', label: 'Onsite interviews', group: 'panel' },
    { id: 'debrief', label: 'Debrief', group: 'hm' },
    { id: 'hire', label: 'Hire?', shape: 'diamond', group: 'hm' },
    { id: 'offer', label: 'Extend offer', group: 'rec' },
    { id: 'decide', label: 'Accept offer?', shape: 'diamond', group: 'cand' },
    { id: 'accept', label: 'Accepted', shape: 'stadium', group: 'cand' },
    { id: 'decline', label: 'Declined', shape: 'stadium', group: 'cand' },
    { id: 'reject', label: 'Send rejection', shape: 'stadium', group: 'rec' },
  ],
  edges: [
    { from: 'apply', to: 'screen' },
    { from: 'screen', to: 'pass' },
    { from: 'pass', to: 'phone', label: 'Yes' },
    { from: 'pass', to: 'reject', label: 'No' },
    { from: 'phone', to: 'onsite' },
    { from: 'onsite', to: 'debrief' },
    { from: 'debrief', to: 'hire' },
    { from: 'hire', to: 'offer', label: 'Yes' },
    { from: 'hire', to: 'reject', label: 'No' },
    { from: 'offer', to: 'decide' },
    { from: 'decide', to: 'accept', label: 'Accept' },
    { from: 'decide', to: 'decline', label: 'Decline' },
  ],
};

describe('a shared end in swimlanes', () => {
  const els = lay(hiring);

  it('stacks the step fed from its own lane over the one fed only from below', () => {
    const midX = (b: BoxedElement) => b.x + b.width / 2;
    expect(midX(box(els, 'reject'))).toBe(midX(box(els, 'offer')));
    expect(box(els, 'reject').y).toBeLessThan(box(els, 'offer').y);
  });

  it("runs the first decision's No straight along its lane, the other No beside it on a quarter", () => {
    expect(midY(box(els, 'reject'))).toBe(midY(box(els, 'pass')));
    const straight = arrow(els, 'pass', 'reject');
    expect(straight.exactEnd).toBe(true);
    expect(anchorOf(straight.to)).toBe('w');
    // Hire's No comes up from below: in beside the straight run, never fanned off it.
    expect(anchorOf(arrow(els, 'hire', 'reject').to)).toBe('wsw');
  });

  it('grows the lane to hold the stack it moved', () => {
    const rec = lane(els, 'rec');
    for (const id of ['screen', 'pass', 'reject', 'offer']) {
      const b = box(els, id);
      expect(b.y).toBeGreaterThanOrEqual(rec.y);
      expect(b.y + b.height).toBeLessThanOrEqual(rec.y + rec.height);
    }
  });

  it("keeps a decision's own branches spread about it, each leaving by its own side", () => {
    expect(midY(box(els, 'accept'))).toBeLessThan(midY(box(els, 'decide')));
    expect(midY(box(els, 'decline'))).toBeGreaterThan(midY(box(els, 'decide')));
    expect(arrow(els, 'decide', 'accept').exactEnd).toBeUndefined();
  });

  it('lines up nothing a box of the lane stands in the way of', () => {
    const blocked = lay({
      ...hiring,
      nodes: [...hiring.nodes, { id: 'note', label: 'Log outcome', group: 'rec' }],
      edges: [
        ...hiring.edges,
        { from: 'pass', to: 'note', label: 'Later' },
        { from: 'note', to: 'debrief' },
      ],
    });
    // Log outcome sits on Meets the bar's line, between it and the rejection: the rejection keeps its own place.
    const [pass, note, reject] = ['pass', 'note', 'reject'].map((id) => box(blocked, id));
    expect(note!.x).toBeGreaterThan(pass!.x);
    expect(note!.x).toBeLessThan(reject!.x);
    expect(midY(note!)).toBe(midY(pass!));
    expect(midY(reject!)).not.toBe(midY(pass!));
  });
});

describe('a level label in swimlanes', () => {
  it("widens the gap a decision's level exit crosses so its label fits, moving every later column along", () => {
    const els = lay({
      style: 'lanes',
      groups: [
        { id: 'c', label: 'Candidate' },
        { id: 'r', label: 'Recruiter' },
      ],
      nodes: [
        { id: 'offer', label: 'Make offer', group: 'r' },
        { id: 'decide', label: 'Accept offer?', shape: 'diamond', group: 'c' },
        { id: 'yes', label: 'Accepted: start onboarding', shape: 'stadium', group: 'c' },
        { id: 'no', label: 'Declined: reopen role', shape: 'stadium', group: 'r' },
      ],
      edges: [
        { from: 'offer', to: 'decide' },
        { from: 'decide', to: 'yes', label: 'Accept' },
        { from: 'decide', to: 'no', label: 'Decline' },
      ],
    });
    const [decide, yes] = [box(els, 'decide'), box(els, 'yes')];
    expect(midY(yes)).toBe(midY(decide));
    // "Accept" is about 52 px with its margin; the run holds it and room for the arrowhead.
    expect(yes.x - (decide.x + decide.width)).toBeGreaterThanOrEqual(68);
    const lanes = els.filter((e) => e.type === 'shape' && e.shape === 'lane') as BoxedElement[];
    expect(lanes[0]!.x + lanes[0]!.width).toBeGreaterThanOrEqual(yes.x + yes.width);
  });
});

describe('a router line into a crowded side', () => {
  it('takes a free side of a shared end rather than landing beside two lines', () => {
    const read = graphFromMermaid(
      [
        'stateDiagram-v2',
        '    direction TB',
        '    [*] --> Created',
        '    Created --> Paid : payment captured',
        '    Paid --> Packed : items picked',
        '    Packed --> Shipped : handed to carrier',
        '    Shipped --> Delivered : signed for',
        '    Created --> Cancelled : customer cancels',
        '    Paid --> Cancelled : cancelled before packing',
        '    Delivered --> Returned : return received',
        '    Returned --> Refunded : refund issued',
        '    Delivered --> [*]',
        '    Cancelled --> [*]',
        '    Refunded --> [*]',
      ].join('\n'),
    );
    if (!read.ok) throw new Error(read.error);
    const els = lay(read.graph);
    const into = els.filter(
      (e): e is ArrowElement =>
        e.type === 'arrow' &&
        e.to.kind === 'pinned' &&
        (els.find((b) => b.id === (e.to as { elementId: string }).elementId) as { shape?: string })
          ?.shape === 'final-state',
    );
    expect(into).toHaveLength(3);
    const sides = into.map((a) => anchorPrimarySide(anchorOf(a.to)!));
    // One line per side of the end state: down into its top, and one from each side.
    expect(new Set(sides).size).toBe(3);
  });
});
