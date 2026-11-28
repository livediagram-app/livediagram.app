// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { newSessionTab, type SessionTabState } from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';

vi.mock('@/lib/api/item-history', () => ({ recordSessionOutcome: vi.fn(async () => {}) }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { recordSessionOutcome } from '@/lib/api/item-history';
import { track } from '@/lib/telemetry';
import { heldOrder, useSessionRun } from './useSessionRun';

// docs/specs/026-plan/session-tabs.md "The queue", "The sidebar", "The action bar": the facilitator's moves and
// outcomes write the real card, keep the outcome in its history and on the tab, and move the room on; anyone else's
// press is a peek that moves nothing.
const work: ItemTypeDef = {
  id: 'work',
  label: 'Work',
  newTitle: 'New work',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status'],
  statuses: ['backlog', 'ready', 'done'],
};
const card = (id: string, status: string, rank: string, extra = {}): Item => ({
  id,
  type: 'work',
  key: 1,
  rank,
  fields: { title: id.toUpperCase(), status, ...extra },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});
const SCOPE = { ownerId: 'o', projectId: 'p', shareCode: null, tabId: null };

function setup(
  runs: boolean,
  session?: Partial<SessionTabState>,
  scope = true,
  cards = [
    card('a', 'backlog', 'a'),
    card('b', 'backlog', 'b'),
    card('c', 'backlog', 'c', { flagged: true }),
  ],
) {
  const items = new Map(cards.map((i) => [i.id, i]));
  const plan = {
    items,
    types: [work],
    statusNames: new Map([
      ['backlog', 'Backlog'],
      ['ready', 'Ready'],
      ['done', 'Done'],
    ]),
    moveItem: vi.fn(),
    patchItem: vi.fn(async () => true),
    announce: vi.fn(),
    itemsScope: scope ? SCOPE : null,
  } as unknown as PlanContextValue;
  let state: SessionTabState = {
    ...newSessionTab('refinement', { typeIds: ['work'], statuses: ['backlog'] }),
    ...session,
  };
  const run = vi.fn((_tab: string, change: (s: SessionTabState) => SessionTabState) => {
    state = change(state);
  });
  const hook = renderHook(
    ({ s }) => useSessionRun({ tabId: 't1', session: s, plan, runs, selfName: 'Sam', run }),
    { initialProps: { s: state } },
  );
  const sync = () => hook.rerender({ s: state });
  return { hook, plan, run, sync, state: () => state };
}

// Each read of the clock a moment later, so outcomes decided in one test order by when they were decided.
let clock = 1_000;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockImplementation(() => (clock += 10));
});

describe('useSessionRun', () => {
  it('settles the room on the first card for the facilitator, never for anyone else', () => {
    const f = setup(true);
    expect(f.hook.result.current.current?.id).toBe('a');
    expect(f.state().currentId).toBe('a');
    const g = setup(false);
    expect(g.hook.result.current.current?.id).toBe('a');
    expect(g.run).not.toHaveBeenCalled();
  });

  it('Refined moves the card to its target, records it and moves on', () => {
    const f = setup(true, { currentId: 'a' });
    act(() => f.hook.result.current.decide('refined'));
    expect(f.plan.moveItem).toHaveBeenCalledWith('a', { status: 'ready', before: null });
    expect(recordSessionOutcome).toHaveBeenCalledWith(SCOPE, 'a', {
      session: 'refinement',
      outcome: 'refined',
    });
    expect(f.state().decided?.['a']).toMatchObject({ outcome: 'refined', by: 'Sam' });
    expect(f.state().currentId).toBe('b');
    expect(f.plan.announce).toHaveBeenCalledWith('Refined. Next: B');
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SessionRefined');
    f.sync();
    // A decided card cannot be decided again until its outcome is undone.
    act(() => f.hook.result.current.goTo('a'));
    f.sync();
    act(() => f.hook.result.current.decide('skipped'));
    expect(f.state().decided?.['a']?.outcome).toBe('refined');
  });

  it('Skip moves on without touching the card; Flag flags it; the last says the session is complete', () => {
    const f = setup(true, { currentId: 'b' });
    act(() => f.hook.result.current.decide('flagged'));
    expect(f.plan.patchItem).toHaveBeenCalledWith('b', { set: { flagged: true } });
    f.sync();
    expect(f.hook.result.current.current?.id).toBe('c');
    // An already flagged card is not flagged again.
    act(() => f.hook.result.current.decide('flagged'));
    expect(f.plan.patchItem).toHaveBeenCalledTimes(1);
    f.sync();
    act(() => f.hook.result.current.decide('skipped'));
    expect(f.plan.moveItem).not.toHaveBeenCalled();
    expect(f.plan.announce).toHaveBeenLastCalledWith('Skipped. Session complete');
    f.sync();
    expect(f.hook.result.current.current).toBeNull();
    expect(f.hook.result.current.queue.decided.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps an outcome on the tab even where the plan records no history (offline)', () => {
    const f = setup(true, { currentId: 'a' }, false);
    act(() => f.hook.result.current.decide('skipped'));
    expect(recordSessionOutcome).not.toHaveBeenCalled();
    expect(f.state().decided?.['a']?.outcome).toBe('skipped');
  });

  it('a failed history write is logged, never thrown', async () => {
    vi.mocked(recordSessionOutcome).mockRejectedValueOnce(new Error('offline'));
    const f = setup(true, { currentId: 'a' });
    await act(async () => f.hook.result.current.decide('skipped'));
    expect(f.state().decided?.['a']).toBeTruthy();
  });

  it('moves with J and K, undoes an outcome and starts again', () => {
    const f = setup(true, { currentId: 'a' });
    act(() => f.hook.result.current.next());
    f.sync();
    expect(f.state().currentId).toBe('b');
    act(() => f.hook.result.current.previous());
    f.sync();
    act(() => f.hook.result.current.previous());
    expect(f.state().currentId).toBe('a');
    act(() => f.hook.result.current.decide('skipped'));
    f.sync();
    act(() => f.hook.result.current.undo('a'));
    expect(f.state().decided).toBeUndefined();
    expect(f.state().currentId).toBe('a');
    act(() => f.hook.result.current.decide('skipped'));
    act(() => f.hook.result.current.startAgain());
    expect(f.state().decided).toBeUndefined();
  });

  it('for anyone else a press is a peek: their screen alone, until Back', () => {
    const f = setup(false, { currentId: 'a' });
    act(() => f.hook.result.current.goTo('c'));
    expect(f.hook.result.current.peeking).toBe(true);
    expect(f.hook.result.current.shown?.id).toBe('c');
    expect(f.hook.result.current.current?.id).toBe('a');
    act(() => {
      f.hook.result.current.decide('refined');
      f.hook.result.current.next();
      f.hook.result.current.undo('a');
      f.hook.result.current.startAgain();
    });
    expect(f.run).not.toHaveBeenCalled();
    act(() => f.hook.result.current.backToRoom());
    expect(f.hook.result.current.shown?.id).toBe('a');
  });

  it('answers where Refined takes a card, and none past the last stage', () => {
    const f = setup(true, {
      setup: { typeIds: ['work'], statuses: ['backlog'], targets: { work: 'done' } },
    });
    expect(f.hook.result.current.target(card('x', 'backlog', 'x'))).toBe('done');
    expect(f.hook.result.current.target(card('x', 'done', 'x'))).toBeNull();
  });

  it('a peek at a card since gone shows the room’s; the room’s own card is no move; J from the end goes back in', () => {
    const g = setup(false);
    act(() => g.hook.result.current.goTo('gone'));
    expect(g.hook.result.current.shown?.id).toBe('a');
    const f = setup(true);
    f.sync();
    const before = f.state();
    act(() => f.hook.result.current.goTo('a'));
    expect(f.state()).toBe(before);
    const done = setup(true, {
      decided: Object.fromEntries(
        ['a', 'b', 'c'].map((id, i) => [id, { outcome: 'skipped' as const, at: i, by: 'Sam' }]),
      ),
    });
    expect(done.hook.result.current.current).toBeNull();
    act(() => done.hook.result.current.next());
    expect(done.state().currentId).toBe('a');
  });

  it('Refined on a card with no later stage leaves it where it is', () => {
    const f = setup(true, { setup: { typeIds: ['work'], statuses: ['done'] } }, true, [
      card('z', 'done', 'z'),
    ]);
    f.sync();
    act(() => f.hook.result.current.decide('refined'));
    expect(f.plan.moveItem).not.toHaveBeenCalled();
    expect(f.state().decided?.z?.outcome).toBe('refined');
  });
});

// docs/specs/026-plan/session-tabs.md "The queue": the order holds per tab and set-up, for a bounded number of tabs.
describe('heldOrder', () => {
  const setup = { typeIds: ['work'], statuses: ['backlog'] };
  const a = card('ha', 'backlog', 'a');
  const b = card('hb', 'backlog', 'b');
  it('holds per tab and set-up, and forgets the oldest tab past the cap', () => {
    expect(heldOrder('h1', setup, [a, b])).toEqual([a, b]);
    expect(heldOrder('h1', setup, [b, a])).toEqual([a, b]);
    // Another set-up sorts afresh.
    expect(heldOrder('h1', { ...setup, statuses: ['x'] }, [b, a])).toEqual([b, a]);
    heldOrder('h2', setup, [a, b]);
    for (let i = 0; i < 20; i += 1) heldOrder(`fill-${i}`, setup, []);
    // h2 was dropped: its cards sort afresh.
    expect(heldOrder('h2', setup, [b, a])).toEqual([b, a]);
  });
});
