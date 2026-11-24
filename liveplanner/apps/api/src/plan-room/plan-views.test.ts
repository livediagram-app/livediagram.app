// View As Diagram kept live (docs/specs/026-plan/view-as-diagram.md "Live"): a plan remembers at most
// PLAN_VIEWS_PER_PLAN_MAX diagrams; a card or type change, settled, redraws only those whose graph moved, sends them to
// the index once, and forgets the ones it says are gone or whose board is gone. A plan with no view reads nothing.
import { DatabaseSync } from 'node:sqlite';
import type { PlanGraph } from '@liveplanner/items';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import {
  PLAN_VIEWS_PER_PLAN_MAX,
  type PlanViewRedraw,
  type PlanViewRedrawStatus,
} from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanViews, type PlanViewRow } from './plan-views';

let db: DatabaseSync;
beforeEach(() => {
  vi.useFakeTimers();
  db = new DatabaseSync(':memory:');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const graph = (title: string): PlanGraph => ({ title, lanes: [], nodes: [], edges: [], total: 0 });
const view = (diagramId: string, over: Partial<PlanViewRow> = {}): PlanViewRow => ({
  diagramId,
  tabId: 't1',
  board: 'b1',
  filtered: false,
  person: 'user_ada',
  ...over,
});

function views({
  graphs = new Map<string, PlanGraph | null>(),
  status = (): PlanViewRedrawStatus => 'ok',
  planId = 'P',
  readable = true,
}: {
  graphs?: Map<string, PlanGraph | null>;
  status?: () => PlanViewRedrawStatus;
  planId?: string | null;
  readable?: boolean;
} = {}) {
  const told = vi.fn(async (_plan: string, sent: readonly PlanViewRedraw[]) => ({
    views: sent.map((v) => ({ diagramId: v.diagramId, status: status() })),
  }));
  const draw = vi.fn(async (rows: readonly PlanViewRow[]) =>
    readable
      ? new Map(
          rows.map((r) => [
            r.diagramId,
            graphs.has(r.diagramId) ? graphs.get(r.diagramId)! : graph('now'),
          ]),
        )
      : null,
  );
  const store = new PlanViews(
    () => nodeItemSql(db),
    () => planId,
    draw,
    () => ({ planDiagramsChanged: told }),
    10,
  );
  return { store, told, draw };
}

const items = { kind: 'items', upserts: [], removed: [], rev: 1 };

describe('plan views', () => {
  beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));

  it('costs nothing without a view: no wait, no draw', async () => {
    const { store, draw } = views();
    store.changed(items);
    await vi.runAllTimersAsync();
    expect(draw).not.toHaveBeenCalled();
  });

  it('redraws a watched view on a card change, settled, only once its graph moved from the one drawn', async () => {
    const { store, told, draw } = views();
    store.noteDrawn(view('d1'), graph('now'));
    store.watch(view('d1'));
    store.changed({ kind: 'presence' });
    store.changed(items);
    store.changed({ kind: 'item-types' });
    await vi.runAllTimersAsync();
    expect(draw).toHaveBeenCalledTimes(1);
    // Nothing drawn changed: nothing sent.
    expect(told).not.toHaveBeenCalled();

    const moved = views({ graphs: new Map([['d1', graph('moved')]]) });
    moved.store.changed(items);
    await vi.runAllTimersAsync();
    expect(moved.told).toHaveBeenCalledTimes(1);
    expect(moved.told.mock.calls[0]![1]).toEqual([
      { diagramId: 'd1', tabId: 't1', person: 'user_ada', graph: graph('moved') },
    ]);
    // Its new hash is kept: the same graph again sends nothing.
    moved.store.changed(items);
    await vi.runAllTimersAsync();
    expect(moved.told).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest PLAN_VIEWS_PER_PLAN_MAX views', () => {
    const { store } = views();
    for (let i = 0; i <= PLAN_VIEWS_PER_PLAN_MAX + 2; i++) store.watch(view(`d${i}`), i);
    expect(store.count()).toBe(PLAN_VIEWS_PER_PLAN_MAX);
    for (let i = 0; i <= PLAN_VIEWS_PER_PLAN_MAX + 2; i++)
      store.noteDrawn(view('x', { board: `b${i}` }), graph('x'));
  });

  it('forgets a view the index says is gone, and one whose board is gone', async () => {
    const first = views({ graphs: new Map([['d2', null]]), status: () => 'gone' });
    first.store.watch(view('d1'));
    first.store.watch(view('d2'));
    first.store.changed(items);
    await vi.runAllTimersAsync();
    expect(first.store.count()).toBe(0);
    // With none left, a change reads nothing more.
    first.store.changed(items);
    await vi.runAllTimersAsync();
    expect(first.draw).toHaveBeenCalledTimes(1);
  });

  it('keeps a view the index could not redraw, to try on the next change', async () => {
    const { store, told } = views({ status: () => 'failed' });
    store.watch(view('d1'));
    store.changed(items);
    await vi.runAllTimersAsync();
    store.changed(items);
    await vi.runAllTimersAsync();
    expect(told).toHaveBeenCalledTimes(2);
    expect(store.count()).toBe(1);
  });

  it('does nothing when the plan cannot be read, and only logs a failed call', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unread = views({ readable: false });
    unread.store.watch(view('d1'));
    await unread.store.flush();
    expect(unread.told).not.toHaveBeenCalled();
    const broken = new PlanViews(
      () => nodeItemSql(db),
      () => 'P',
      async () => new Map([['d1', graph('other')]]),
      () => ({
        planDiagramsChanged: async () => {
          throw new Error('down');
        },
      }),
    );
    await broken.flush();
    expect(warn).toHaveBeenCalledWith('[plan] plan views not redrawn', { error: 'Error: down' });
    // No plan id or no storage: nothing at all.
    const none = views({ planId: null });
    await none.store.flush();
    expect(none.draw).not.toHaveBeenCalled();
    const noSql = new PlanViews(
      () => undefined,
      () => 'P',
      none.draw,
      () => null,
    );
    noSql.watch(view('d1'));
    noSql.changed(items);
    expect(noSql.count()).toBe(0);
  });
});
