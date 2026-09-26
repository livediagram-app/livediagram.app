import { describe, it, expect } from 'vitest';
import { opForTheWire } from '@livediagram/diagram';
import type { Element, Tab, TabVote } from '@livediagram/diagram';
import { EL_OP_BROADCAST_LIMIT, mergeRemoteTab, tabBroadcastOps } from './tab-broadcast-ops';

const el = (id: string, over: Partial<Element> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

const tab = (over: Partial<Tab> = {}): Tab => ({
  id: 't1',
  name: 'Tab 1',
  elements: [el('a'), el('b')],
  ...over,
});

describe('tabBroadcastOps', () => {
  it('sends a whole-tab op when peers have no prior copy', () => {
    const after = tab();
    expect(tabBroadcastOps(undefined, after)).toEqual([{ kind: 'tab', tabId: 't1', tab: after }]);
  });

  it('emits one el op for a single moved element', () => {
    const before = tab();
    const after = tab({ elements: [el('a', { x: 50 }), el('b')] });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'el', tabId: 't1', op: { kind: 'update', element: el('a', { x: 50 }) } },
    ]);
  });

  it('emits an el add op for a new element', () => {
    const before = tab();
    const after = tab({ elements: [el('a'), el('b'), el('c', { x: 3 })] });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'el', tabId: 't1', op: { kind: 'add', element: el('c', { x: 3 }), at: 2 } },
    ]);
  });

  it('emits a tab-meta patch for a background change with no element change', () => {
    const before = tab();
    const after = tab({ backgroundColor: '#111' });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { backgroundColor: '#111' } },
    ]);
  });

  it('emits the tab-meta patch before the el ops when both changed', () => {
    const before = tab();
    const after = tab({ name: 'Renamed', elements: [el('a', { x: 9 }), el('b')] });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed' } },
      { kind: 'el', tabId: 't1', op: { kind: 'update', element: el('a', { x: 9 }) } },
    ]);
  });

  it('never puts folder in a tab-meta patch (diagram-meta owns it)', () => {
    const before = tab({ folder: 'A' });
    const after = tab({ folder: 'B', backgroundColor: '#222' });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { backgroundColor: '#222' } },
    ]);
  });

  it('falls back to a whole-tab op for a bulk element change', () => {
    const before = tab({ elements: [] });
    const many = Array.from({ length: EL_OP_BROADCAST_LIMIT + 1 }, (_, i) => el(`n${i}`));
    const after = tab({ elements: many });
    expect(tabBroadcastOps(before, after)).toEqual([{ kind: 'tab', tabId: 't1', tab: after }]);
  });

  it('names a cleared meta field in `clear` rather than resending the tab (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
    // Clearing a field yields patch[k] = undefined, which JSON.stringify drops
    // on the wire. It used to force a whole-tab op, which replaced every
    // element on every receiver; the clear now travels by name.
    const before = tab({ backgroundColor: '#111' });
    const after = tab(); // backgroundColor removed
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['backgroundColor'] },
    ]);
  });

  it('emits nothing when a changed tab turns out identical', () => {
    const before = tab();
    expect(tabBroadcastOps(before, tab())).toEqual([]);
  });
});

describe('the vote field (docs/specs/012-collaboration/session-tools.md)', () => {
  const vote = (over: Partial<TabVote> = {}): TabVote => ({
    active: true,
    revealed: false,
    votesPerPerson: 6,
    votes: {},
    ...over,
  });

  it('does NOT ship the votes map when only dots moved', () => {
    // Dots travel as their own commutative `vote` op. Shipping the map here
    // too would put the clobber back: a tab-meta patch replaces the field
    // wholesale, so a peer applying it drops any dot that reached them from
    // somebody else in the meantime. That is the retro bug.
    const before = tab({ vote: vote() });
    const after = tab({ vote: vote({ votes: { a: ['ariel'] } }) });
    expect(tabBroadcastOps(before, after)).toEqual([]);
  });

  it('still ships the whole vote when a lifecycle field changed', () => {
    // End / reveal / clear / start are the host's alone, so there is one
    // writer and the whole object is right for them — and carrying `votes`
    // along is how a start or a clear resets it on every peer.
    const before = tab({ vote: vote({ votes: { a: ['ariel'] } }) });
    const after = tab({ vote: vote({ votes: { a: ['ariel'] }, revealed: true }) });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { vote: after.vote } },
    ]);
  });

  it('ships the reset when a lifecycle change also empties the votes', () => {
    // Clearing a round moves `active` AND wipes the map; the peer needs both.
    const before = tab({ vote: vote({ votes: { a: ['ariel', 'pete'] } }) });
    const after = tab({ vote: vote({ active: false, votes: {} }) });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { vote: after.vote } },
    ]);
  });

  it('a whole-tab op keeps our dots, which may include ones in flight to the sender', () => {
    // The host clears the timer (a whole-tab op) with a snapshot taken before
    // Ariel's dot reached them; Ariel's dot must survive on every receiver.
    const local = tab({ vote: vote({ votes: { a: ['ariel'] } }), folder: 'mine' });
    const incoming = tab({ name: 'Renamed', vote: vote({ votes: {} }), folder: 'theirs' });
    const merged = mergeRemoteTab(local, incoming);
    expect(merged.vote).toBe(local.vote);
    expect(merged.name).toBe('Renamed');
    expect(merged.folder).toBe('mine');
  });

  it('a whole-tab op still replaces the vote on a lifecycle change', () => {
    const local = tab({ vote: vote({ votes: { a: ['ariel'] } }) });
    const incoming = tab({ vote: vote({ active: false, votes: {} }) });
    expect(mergeRemoteTab(local, incoming).vote).toBe(incoming.vote);
  });

  it('leaves other meta changes alone while dots move', () => {
    // A rename riding the same save still travels; only `vote` is withheld.
    const before = tab({ vote: vote() });
    const after = tab({ name: 'Renamed', vote: vote({ votes: { a: ['ariel'] } }) });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed' } },
    ]);
  });

  it('clears the vote by name, leaving elements alone (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
    const before = tab({ vote: vote() });
    const after = tab();
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['vote'] },
    ]);
  });
});

describe('comment author ids stay off the wire (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it("strips every comment's author id from element and tab ops", () => {
    const thread = {
      comments: [
        {
          id: 'c1',
          text: 'hi',
          createdAt: 1,
          authorName: 'A',
          authorColor: '#000',
          authorId: 'owner-secret',
        },
      ],
      resolved: false,
    };
    const before = tab();
    const after = tab({
      elements: [el('a', { x: 5, commentThread: thread } as Partial<Element>), el('b')],
    });
    // What the socket actually sends: every op through `opForTheWire` (room.ts).
    const wire = (ops: unknown[]) => JSON.stringify(ops.map(opForTheWire));
    expect(wire(tabBroadcastOps(before, after))).not.toContain('owner-secret');
    expect(wire(tabBroadcastOps(undefined, after))).not.toContain('owner-secret');
  });
});
