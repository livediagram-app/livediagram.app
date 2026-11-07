import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import { applyElementDelta, checklistDeltaFor, type ShapeElement } from '@livehuddle/document';
import type { RoomOp } from '@livehuddle/api-schema';
import { applyRoomOpToTabs } from './room-op-apply';
import { tabBroadcastOps } from './tab-broadcast-ops';

const el = (id: string, over: Partial<Element> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

const tab = (over: Partial<Tab> = {}): Tab => ({
  id: 't1',
  name: 'Tab 1',
  elements: [el('a'), el('b')],
  ...over,
});

describe('applyRoomOpToTabs', () => {
  it('applies an element update by id and leaves the other element alone', () => {
    const tabs = [tab()];
    const next = applyRoomOpToTabs(tabs, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: el('a', { x: 9 }) },
    });
    expect(next[0]!.elements[0]).toEqual(el('a', { x: 9 }));
    expect(next[0]!.elements[1]).toBe(tabs[0]!.elements[1]);
  });

  it('returns the same array for an op that changes nothing', () => {
    const tabs = [tab()];
    expect(
      applyRoomOpToTabs(tabs, {
        kind: 'el',
        tabId: 't1',
        op: { kind: 'update', element: el('gone') },
      }),
    ).toBe(tabs);
    expect(
      applyRoomOpToTabs(tabs, { kind: 'el', tabId: 'nope', op: { kind: 'remove', id: 'a' } }),
    ).toBe(tabs);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The Vote": an old client's vote changes nothing.
  it("ignores an old client's dot, and drops the vote a tab or a patch still carries", () => {
    const tabs = [tab()];
    const dot = { kind: 'vote', tabId: 't1', elementId: 'a', voter: 'pete', delta: 1 };
    expect(applyRoomOpToTabs(tabs, dot as unknown as RoomOp)).toBe(tabs);
    const oldVote = { active: true, revealed: false, votesPerPerson: 3, votes: { a: ['pete'] } };
    const patched = applyRoomOpToTabs(tabs, {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { name: 'Renamed', vote: oldVote } as never,
    });
    expect(patched[0]!.name).toBe('Renamed');
    expect('vote' in patched[0]!).toBe(false);
    const whole = applyRoomOpToTabs(tabs, {
      kind: 'tab',
      tabId: 't1',
      tab: { ...tab(), vote: oldVote } as never,
    });
    expect('vote' in whole[0]!).toBe(false);
    const added = applyRoomOpToTabs(tabs, {
      kind: 'tab',
      tabId: 't2',
      tab: { ...tab({ id: 't2' }), vote: oldVote } as never,
    });
    expect('vote' in added[1]!).toBe(false);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The Session strip's Timer": an old client's tab timer is dropped.
  it('drops the Session strip timer a tab or a patch still carries', () => {
    const oldTimer = { mode: 'stopwatch', running: true, anchorAt: 1 };
    const patched = applyRoomOpToTabs([tab()], {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { name: 'Renamed', timer: oldTimer } as never,
    });
    expect(patched[0]!.name).toBe('Renamed');
    expect('timer' in patched[0]!).toBe(false);
    const whole = applyRoomOpToTabs([tab()], {
      kind: 'tab',
      tabId: 't1',
      tab: { ...tab(), timer: oldTimer } as never,
    });
    expect('timer' in whole[0]!).toBe(false);
  });

  it("a clear removes the field and keeps everybody's elements (docs/specs/012-collaboration/collab-race-hardening.md)", () => {
    const mine = tab({ backgroundOpacity: 0.5 });
    const next = applyRoomOpToTabs([mine], {
      kind: 'tab-meta',
      tabId: 't1',
      patch: {},
      clear: ['backgroundOpacity', 'elements', 'id'],
    });
    expect('backgroundOpacity' in next[0]!).toBe(false);
    expect(next[0]!.elements).toBe(mine.elements);
    expect(next[0]!.id).toBe('t1');
  });

  it("a tab-meta patch's malformed layers and colours are settled (docs/specs/006-document/layers.md)", () => {
    const next = applyRoomOpToTabs([tab()], {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { layers: 'x', backgroundColor: true } as never,
    });
    expect('layers' in next[0]!).toBe(false);
    expect('backgroundColor' in next[0]!).toBe(false);
  });

  it('a tab-meta patch never moves the folder', () => {
    const tabs = [tab({ folder: 'mine' })];
    const next = applyRoomOpToTabs(tabs, {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { name: 'Renamed', folder: 'theirs' },
    });
    expect(next[0]!.name).toBe('Renamed');
    expect(next[0]!.folder).toBe('mine');
  });

  it('document-meta reorders, keeps identity, and adds placeholders', () => {
    const one = tab();
    const two = tab({ id: 't2', name: 'Tab 2' });
    const next = applyRoomOpToTabs([one, two], {
      kind: 'document-meta',
      name: 'D',
      tabs: [
        { id: 't2', name: 'Tab 2', orderIndex: 0 },
        { id: 't1', name: 'Tab 1', orderIndex: 1 },
        { id: 't3', name: 'Tab 3', orderIndex: 2 },
      ],
    });
    expect(next.map((t) => t.id)).toEqual(['t2', 't1', 't3']);
    expect(next[0]).toBe(two);
    expect(next[2]!.elements).toEqual([]);
  });
});

// A connected tab rides the outline op (liveworkspace/docs/specs/004-index/connected-tabs.md).
describe('applyRoomOpToTabs: connected tabs', () => {
  const connection = {
    id: 'cn_abcdefghijklmnopqrstuvwx',
    app: 'liveplanner',
    itemId: 'plan1',
  } as const;

  it("carries a summary's connection onto a new placeholder", () => {
    const next = applyRoomOpToTabs([tab()], {
      kind: 'document-meta',
      name: 'D',
      tabs: [
        { id: 't1', name: 'Tab 1', orderIndex: 0 },
        { id: 't2', name: 'Roadmap', orderIndex: 1, connection },
      ],
    });
    expect((next[1] as { connection?: unknown }).connection).toEqual(connection);
    expect(next[1]!.elements).toEqual([]);
  });

  it("keeps a local tab's connection when the summary carries none", () => {
    const local = { ...tab({ id: 't2', name: 'Roadmap', elements: [] }), connection } as Tab;
    const next = applyRoomOpToTabs([tab(), local], {
      kind: 'document-meta',
      name: 'D',
      tabs: [
        { id: 't1', name: 'Tab 1', orderIndex: 0 },
        { id: 't2', name: 'Roadmap', orderIndex: 1 },
      ],
    });
    expect(next[1]).toBe(local);
  });
});

// docs/specs/012-collaboration/collab-race-hardening.md, end to end: two people press the same done check in the same
// instant, then each of their autosaves runs. Everybody must end up with
// both marks.
describe('applyRoomOpToTabs: a payload naming another tab', () => {
  it("keeps the tab's id through a whole-tab op and a tab-meta patch, so a save can't land on another tab", () => {
    const tabs = [tab(), tab({ id: 't2', name: 'Other', elements: [el('z')] })];
    const whole = applyRoomOpToTabs(tabs, {
      kind: 'tab',
      tabId: 't1',
      tab: { id: 't2', name: 'Hijack', elements: [el('x')] },
    });
    expect(whole.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(whole[1]).toBe(tabs[1]);
    const added = applyRoomOpToTabs([tabs[1]!], {
      kind: 'tab',
      tabId: 't1',
      tab: { id: 't2', name: 'New', elements: [] },
    });
    expect(added.map((t) => t.id)).toEqual(['t2', 't1']);
    const meta = applyRoomOpToTabs(tabs, {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { id: 't2', name: 'Renamed', elements: [] } as Partial<Omit<Tab, 'elements'>>,
    });
    expect(meta[0]!.id).toBe('t1');
    expect(meta[0]!.name).toBe('Renamed');
    expect(meta[0]!.elements).toBe(tabs[0]!.elements);
  });
});

describe('two people ticking one checklist', () => {
  const check = (): ShapeElement =>
    el('card', {
      shape: 'checklist',
      checklistItems: [
        { text: 'a', done: false },
        { text: 'b', done: false },
      ],
    }) as ShapeElement;
  const start = (): Tab[] => [tab({ elements: [check()] })];

  // Each person ticks their own row: 'a' ticks the first, 'b' the second.
  const press = (tabs: Tab[], who: 'a' | 'b') => {
    const card = tabs[0]!.elements[0] as ShapeElement;
    const delta = checklistDeltaFor(card, who === 'a' ? 0 : 1)!;
    const op: RoomOp = { kind: 'el-delta', tabId: 't1', elementId: 'card', delta };
    return { tabs: [{ ...tabs[0]!, elements: [applyElementDelta(card, delta)] }], op };
  };
  const marks = (tabs: Tab[]) =>
    ((tabs[0]!.elements[0] as ShapeElement).checklistItems ?? [])
      .filter((item) => item.done)
      .map((item) => item.text)
      .sort();

  it('converges on both ticks, and neither autosave re-sends the card', () => {
    const saved = start();
    const a = press(start(), 'a');
    const b = press(start(), 'b');
    // Each receives the other's delta.
    const aTabs = applyRoomOpToTabs(a.tabs, b.op);
    const bTabs = applyRoomOpToTabs(b.tabs, a.op);
    expect(marks(aTabs)).toEqual(['a', 'b']);
    expect(marks(bTabs)).toEqual(['a', 'b']);
    // Their saves: the only change is a tick, which the delta already said.
    expect(tabBroadcastOps(saved[0], a.tabs[0]!)).toEqual([]);
  });

  it("a peer's whole-element update (they moved the card) keeps both ticks", () => {
    const a = press(start(), 'a');
    const bothMarked = applyRoomOpToTabs(a.tabs, press(start(), 'b').op);
    // Their copy was saved with only their own tick, before a's arrived.
    const theirs = { ...(press(start(), 'b').tabs[0]!.elements[0] as ShapeElement), x: 80 };
    const next = applyRoomOpToTabs(bothMarked, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: theirs },
    });
    expect((next[0]!.elements[0] as ShapeElement).x).toBe(80);
    expect(marks(next)).toEqual(['a', 'b']);
  });

  it('a whole-tab op keeps both ticks too', () => {
    const bothMarked = applyRoomOpToTabs(press(start(), 'a').tabs, press(start(), 'b').op);
    const theirTab = press(start(), 'b').tabs[0]!;
    const next = applyRoomOpToTabs(bothMarked, { kind: 'tab', tabId: 't1', tab: theirTab });
    expect(marks(next)).toEqual(['a', 'b']);
  });
});

// An agent's changeset (docs/specs/024-agents/agent-changesets.md "In the editor"): its element ops
// apply as a peer's would, a created tab is appended first, and an op with no element ops (an
// oversize relay that asks for a refetch) changes nothing here.
describe('applyRoomOpToTabs: changeset', () => {
  const changeset = (over: Record<string, unknown>): RoomOp => ({
    kind: 'changeset',
    tabId: 't1',
    id: 'cs_0000000001',
    rev: 2,
    prevRev: null,
    author: { name: 'Webber', color: '#0ea5e9' },
    counts: { added: 1, changed: 1, removed: 0 },
    ...over,
  });

  it('applies every element op in order, merging over our copy', () => {
    const tabs = [tab()];
    const next = applyRoomOpToTabs(
      tabs,
      changeset({
        elementOps: [
          { kind: 'add', element: el('c', { x: 5 }), at: 2 },
          { kind: 'update', element: el('a', { x: 9 }) },
        ],
      }),
    );
    expect(next[0]!.elements.map((e) => [e.id, 'x' in e ? e.x : null])).toEqual([
      ['a', 9],
      ['b', 0],
      ['c', 5],
    ]);
  });

  it('appends a tab the changeset created, then fills it', () => {
    const tabs = [tab()];
    const next = applyRoomOpToTabs(
      tabs,
      changeset({
        tabId: 't2',
        tab: { id: 't2', name: 'Detail' },
        elementOps: [{ kind: 'add', element: el('n'), at: 0 }],
      }),
    );
    expect(next.map((t) => [t.id, t.elements.map((e) => e.id)])).toEqual([
      ['t1', ['a', 'b']],
      ['t2', ['n']],
    ]);
  });

  it('appends a created tab even when its relay was too large to carry the elements', () => {
    const tabs = [tab()];
    const next = applyRoomOpToTabs(
      tabs,
      changeset({ tabId: 't2', tab: { id: 't2', name: 'Detail' }, refetch: true, touched: ['n'] }),
    );
    expect(next.map((t) => [t.id, t.elements.length])).toEqual([
      ['t1', 2],
      ['t2', 0],
    ]);
  });

  it('keeps identity for a refetch op or a tab we do not have', () => {
    const tabs = [tab()];
    expect(applyRoomOpToTabs(tabs, changeset({ refetch: true, touched: ['a'] }))).toBe(tabs);
    expect(
      applyRoomOpToTabs(
        tabs,
        changeset({ tabId: 'nope', elementOps: [{ kind: 'remove', id: 'a' }] }),
      ),
    ).toBe(tabs);
  });
});
