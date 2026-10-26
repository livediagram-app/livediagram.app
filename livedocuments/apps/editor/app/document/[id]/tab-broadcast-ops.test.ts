import { describe, it, expect } from 'vitest';
import { opForTheWire } from '@livedocuments/document';
import type { Element, Tab } from '@livedocuments/document';
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

  it('never puts folder in a tab-meta patch (document-meta owns it)', () => {
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

describe('a cleared tab field (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it('travels by name, leaving elements alone', () => {
    const before = tab({ backgroundColor: '#fff' });
    const after = tab();
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['backgroundColor'] },
    ]);
  });

  it('a whole-tab op keeps our folder', () => {
    const local = tab({ folder: 'mine' });
    const incoming = tab({ name: 'Renamed', folder: 'theirs' });
    const merged = mergeRemoteTab(local, incoming);
    expect(merged.name).toBe('Renamed');
    expect(merged.folder).toBe('mine');
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
      elements: [el('a', { x: 5, commentThread: thread }), el('b')],
    });
    // What the socket actually sends: every op through `opForTheWire` (room.ts).
    const wire = (ops: unknown[]) => JSON.stringify(ops.map(opForTheWire));
    expect(wire(tabBroadcastOps(before, after))).not.toContain('owner-secret');
    expect(wire(tabBroadcastOps(undefined, after))).not.toContain('owner-secret');
  });
});

describe('tabBroadcastOps: articles (docs/specs/007-editor/article-pages.md "Collaboration")', () => {
  const P = (id: string, text = id) => ({ id, type: 'paragraph' as const, runs: [{ text }] });
  const withDoc = (...blocks: ReturnType<typeof P>[]) => tab({ articles: { f: { blocks } } });

  it('sends the writing as block ops, never in a tab-meta patch', () => {
    const before = withDoc(P('a'), P('b'));
    const after = withDoc(P('a', 'A!'), P('b'));
    expect(tabBroadcastOps(before, after)).toEqual([
      {
        kind: 'article',
        tabId: 't1',
        flow: 'f',
        // In its place: no position, so a collaborator's neighbour keeps its own.
        ops: [{ kind: 'put', block: P('a', 'A!') }],
      },
    ]);
  });

  it('says a removed article by name', () => {
    expect(tabBroadcastOps(withDoc(P('a')), tab())).toEqual([
      { kind: 'article', tabId: 't1', flow: 'f', removed: true },
    ]);
  });

  it('keeps the writing out of a whole-tab op, sending it as block ops after', () => {
    const after = withDoc(P('a'));
    const ops = tabBroadcastOps(undefined, after);
    expect(ops[0]).toEqual({ kind: 'tab', tabId: 't1', tab: tab() });
    expect(ops[1]).toMatchObject({ kind: 'article', flow: 'f', ops: [{ kind: 'put' }] });
  });

  it('splits a large change into frames the room will carry', () => {
    const big = Array.from({ length: 30 }, (_, i) => P(`b${i}`, 'x'.repeat(19_000)));
    const ops = tabBroadcastOps(tab(), withDoc(...big));
    expect(ops.length).toBeGreaterThan(1);
    for (const op of ops) expect(JSON.stringify(op).length).toBeLessThan(256 * 1024);
  });

  it("keeps the receiver's writing through a whole-tab merge", () => {
    const local = withDoc(P('mine'));
    expect(mergeRemoteTab(local, tab()).articles).toBe(local.articles);
  });

  // A tab-scoped session's whole tab reaches us without its name (the room drops it: a tab's name is
  // structure, docs/specs/013-workspace/tab-scoped-share-links.md): ours stays.
  it('keeps our tab name when the whole tab arrives without one', () => {
    const { name: _name, ...nameless } = tab({ name: 'Theirs' });
    void _name;
    expect(mergeRemoteTab(tab({ name: 'Ours' }), nameless as Tab).name).toBe('Ours');
    expect(mergeRemoteTab(tab({ name: 'Ours' }), tab({ name: 'Theirs' })).name).toBe('Theirs');
  });
});
