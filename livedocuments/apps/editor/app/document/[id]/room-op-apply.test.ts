import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livedocuments/document';
import { applyElementDelta, checklistDeltaFor, type ShapeElement } from '@livedocuments/document';
import type { RoomOp } from '@livedocuments/api-schema';
import { applyRoomOpToTabs } from './room-op-apply';
import { tabBroadcastOps } from './tab-broadcast-ops';
import { clearArticleGrow, isArticleGrowPending } from '@/lib/article/article-grow-store';

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

  it("a clear removes the field and keeps everybody's elements (docs/specs/012-collaboration/collab-race-hardening.md)", () => {
    const mine = tab({ backgroundColor: '#fff' });
    const next = applyRoomOpToTabs([mine], {
      kind: 'tab-meta',
      tabId: 't1',
      patch: {},
      clear: ['backgroundColor', 'elements', 'id'],
    });
    expect('backgroundColor' in next[0]!).toBe(false);
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

// docs/specs/012-collaboration/collab-race-hardening.md, end to end: two people tick different rows of one checklist
// in the same instant, then each of their autosaves runs. Everybody must end up with both ticks.
describe('two people ticking one checklist', () => {
  const list = (): ShapeElement =>
    ({
      ...el('card'),
      shape: 'checklist',
      checklistItems: [
        { text: 'a', done: false },
        { text: 'b', done: false },
      ],
    }) as ShapeElement;
  const start = (): Tab[] => [tab({ elements: [list()] })];

  // `a` ticks the first row, `b` the second.
  const press = (tabs: Tab[], who: 'a' | 'b') => {
    const card = tabs[0]!.elements[0] as ShapeElement;
    const delta = checklistDeltaFor(card, who === 'a' ? 0 : 1)!;
    const op: RoomOp = { kind: 'el-delta', tabId: 't1', elementId: 'card', delta };
    return { tabs: [{ ...tabs[0]!, elements: [applyElementDelta(card, delta)] }], op };
  };
  const marks = (tabs: Tab[]) =>
    ((tabs[0]!.elements[0] as ShapeElement).checklistItems ?? [])
      .filter((i) => i.done)
      .map((i) => i.text);

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

describe('applyRoomOpToTabs: documents', () => {
  const P = (id: string, text = id) => ({ id, type: 'paragraph' as const, runs: [{ text }] });

  it("applies a peer's block ops, merging with ours", () => {
    const base = tab({ articles: { f: { blocks: [P('a'), P('b')] } } });
    const mine = tab({ articles: { f: { blocks: [P('a', 'mine'), P('b')] } } });
    const theirs = tab({ articles: { f: { blocks: [P('a'), P('b', 'theirs')] } } });
    let tabs = [mine];
    for (const op of tabBroadcastOps(base, theirs)) tabs = applyRoomOpToTabs(tabs, op);
    expect(tabs[0]!.articles!.f!.blocks).toEqual([P('a', 'mine'), P('b', 'theirs')]);
  });

  it('drops writing for an article this tab no longer has, unless it is new', () => {
    const tabs = [tab()];
    const late: RoomOp = {
      kind: 'article',
      tabId: 't1',
      flow: 'f',
      ops: [{ kind: 'put', block: P('a') }],
    };
    expect(applyRoomOpToTabs(tabs, late)[0]!.articles).toBeUndefined();
    const created: RoomOp = { ...late, created: true };
    expect(applyRoomOpToTabs(tabs, created)[0]!.articles!.f!.blocks).toEqual([P('a')]);
  });

  it('marks writing whose writer lays out no pages for growing by whoever lays it out next', () => {
    const tabs = [tab({ articles: { f: { blocks: [P('a')] } } })];
    const op: RoomOp = {
      kind: 'article',
      tabId: 't1',
      flow: 'f',
      ops: [{ kind: 'put', block: P('b') }],
    };
    applyRoomOpToTabs(tabs, op);
    expect(isArticleGrowPending('t1', 'f')).toBe(false);
    applyRoomOpToTabs(tabs, { ...op, grow: true });
    expect(isArticleGrowPending('t1', 'f')).toBe(true);
    clearArticleGrow('t1', 'f');
    expect(isArticleGrowPending('t1', 'f')).toBe(false);
  });

  it('ignores a malformed article frame', () => {
    const tabs = [tab({ articles: { f: { blocks: [P('a')] } } })];
    const bad = { kind: 'article', tabId: 't1', flow: 'f', ops: 'x' } as unknown as RoomOp;
    expect(applyRoomOpToTabs(tabs, bad)).toBe(tabs);
  });

  it('removes an article, and drops the field with the last one', () => {
    const tabs = [tab({ articles: { f: { blocks: [P('a')] } } })];
    const op: RoomOp = { kind: 'article', tabId: 't1', flow: 'f', removed: true };
    expect(applyRoomOpToTabs(tabs, op)[0]!.articles).toBeUndefined();
  });
});
