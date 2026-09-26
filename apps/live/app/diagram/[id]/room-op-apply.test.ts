import { describe, expect, it } from 'vitest';
import type { Element, Tab, TabVote } from '@livediagram/diagram';
import { applyElementDelta, responseDeltaFor, type ShapeElement } from '@livediagram/diagram';
import type { RoomOp } from '@livediagram/api-schema';
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

const vote = (over: Partial<TabVote> = {}): TabVote => ({
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: {},
  round: 'r1',
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

  it('adds a dot for the open round', () => {
    const tabs = [tab({ vote: vote() })];
    const next = applyRoomOpToTabs(tabs, {
      kind: 'vote',
      tabId: 't1',
      elementId: 'a',
      voter: 'pete',
      delta: 1,
      round: 'r1',
    });
    expect(next[0]!.vote?.votes).toEqual({ a: ['pete'] });
  });

  it('drops a dot from another round or for a closed vote (spec/152)', () => {
    const open = [tab({ vote: vote() })];
    const dot = { kind: 'vote', tabId: 't1', elementId: 'a', voter: 'pete', delta: 1 } as const;
    expect(applyRoomOpToTabs(open, { ...dot, round: 'r0' })).toBe(open);
    const closed = [tab({ vote: vote({ active: false }) })];
    expect(applyRoomOpToTabs(closed, { ...dot, round: 'r1' })).toBe(closed);
  });

  // THE bug: the host's End carried their map as of their save, so a dot
  // still in flight vanished for everybody else.
  it('an End for the same round keeps our dots', () => {
    const tabs = [tab({ vote: vote({ votes: { a: ['ariel', 'pete'] } }) })];
    const next = applyRoomOpToTabs(tabs, {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { vote: vote({ active: false, votes: { a: ['ariel'] } }) },
    });
    expect(next[0]!.vote?.active).toBe(false);
    expect(next[0]!.vote?.votes).toEqual({ a: ['ariel', 'pete'] });
  });

  it('a new round replaces the map', () => {
    const tabs = [tab({ vote: vote({ votes: { a: ['ariel'] } }) })];
    const next = applyRoomOpToTabs(tabs, {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { vote: vote({ round: 'r2' }) },
    });
    expect(next[0]!.vote?.votes).toEqual({});
  });

  it("a clear removes the field and keeps everybody's elements (spec/152)", () => {
    const mine = tab({ timer: { mode: 'stopwatch', running: true, anchorAt: 1 } });
    const next = applyRoomOpToTabs([mine], {
      kind: 'tab-meta',
      tabId: 't1',
      patch: {},
      clear: ['timer', 'elements', 'id'],
    });
    expect('timer' in next[0]!).toBe(false);
    expect(next[0]!.elements).toBe(mine.elements);
    expect(next[0]!.id).toBe('t1');
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

  it('diagram-meta reorders, keeps identity, and adds placeholders', () => {
    const one = tab();
    const two = tab({ id: 't2', name: 'Tab 2' });
    const next = applyRoomOpToTabs([one, two], {
      kind: 'diagram-meta',
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

// spec/152, end to end: two people press the same done check in the same
// instant, then each of their autosaves runs. Everybody must end up with
// both marks.
describe('two people pressing one done check', () => {
  const check = (): ShapeElement => ({ ...el('card'), shape: 'done-check' }) as ShapeElement;
  const start = (): Tab[] => [tab({ elements: [check()] })];

  const press = (tabs: Tab[], who: string) => {
    const card = tabs[0]!.elements[0] as ShapeElement;
    const delta = responseDeltaFor(card, who, 'done', 1);
    const op: RoomOp = { kind: 'el-delta', tabId: 't1', elementId: 'card', delta };
    return { tabs: [{ ...tabs[0]!, elements: [applyElementDelta(card, delta)] }], op };
  };
  const marks = (tabs: Tab[]) =>
    ((tabs[0]!.elements[0] as ShapeElement).responses ?? []).map((r) => r.participantId).sort();

  it('converges on both marks, and neither autosave re-sends the card', () => {
    const saved = start();
    const a = press(start(), 'a');
    const b = press(start(), 'b');
    // Each receives the other's delta.
    const aTabs = applyRoomOpToTabs(a.tabs, b.op);
    const bTabs = applyRoomOpToTabs(b.tabs, a.op);
    expect(marks(aTabs)).toEqual(['a', 'b']);
    expect(marks(bTabs)).toEqual(['a', 'b']);
    // Their saves: the only change is an answer, which the delta already said.
    expect(tabBroadcastOps(saved[0], a.tabs[0]!)).toEqual([]);
  });

  it("a peer's whole-element update (they moved the card) keeps both marks", () => {
    const a = press(start(), 'a');
    const bothMarked = applyRoomOpToTabs(a.tabs, press(start(), 'b').op);
    // Their copy was saved with only their own mark, before a's arrived.
    const theirs = { ...(press(start(), 'b').tabs[0]!.elements[0] as ShapeElement), x: 80 };
    const next = applyRoomOpToTabs(bothMarked, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: theirs },
    });
    expect((next[0]!.elements[0] as ShapeElement).x).toBe(80);
    expect(marks(next)).toEqual(['a', 'b']);
  });

  it('a whole-tab op keeps both marks too', () => {
    const bothMarked = applyRoomOpToTabs(press(start(), 'a').tabs, press(start(), 'b').op);
    const theirTab = press(start(), 'b').tabs[0]!;
    const next = applyRoomOpToTabs(bothMarked, { kind: 'tab', tabId: 't1', tab: theirTab });
    expect(marks(next)).toEqual(['a', 'b']);
  });
});
