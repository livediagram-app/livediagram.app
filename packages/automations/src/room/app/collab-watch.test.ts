import { describe, expect, it, vi } from 'vitest';
import { queued, rowsOf, world, ANA, type World } from '../item/test-kit';
import {
  COLLAB_BASELINE_MORE_MS,
  COLLAB_BASELINE_TABS,
  COLLAB_SEEN_SCHEMA_STEP,
  CollabWatch,
  collabSummaryOf,
  tabElements,
  watchRules,
  type CollabRows,
} from './collab-watch';

const thread = (elementId: string, commentCount = 1, resolved = false) => ({
  elementId,
  resolved,
  commentCount,
  latestText: `Comment ${commentCount}`,
  latestAuthorId: 'ben',
  latestAuthorName: 'Ben Okafor',
  latestAuthorColor: '#222222',
});
const action = (actionId: string, status = 'open', assigneeUserId: string | null = null) => ({
  elementId: 'e1',
  actionId,
  name: `Action ${actionId}`,
  status,
  assigneeUserId,
  assigneeName: assigneeUserId ? 'Ben Okafor' : null,
});
const rows = (threads: unknown[] = [], actions: unknown[] = []) =>
  ({ threads, actions }) as unknown as CollabRows;

function watched(w: World) {
  w.sql.exec(COLLAB_SEEN_SCHEMA_STEP);
  const armed = { count: 0 };
  const watch = new CollabWatch({
    engine: () => w.engine,
    sql: () => w.sql,
    ready: () => w.state.ready,
    arm: () => void (armed.count += 1),
    links: 'document_tabs',
    rows: (data) => JSON.parse(data) as CollabRows,
  });
  const store = (id: string, found: CollabRows) => {
    w.sql.exec('INSERT INTO tabs (id, name, data) VALUES (?, ?, ?)', id, id, JSON.stringify(found));
    w.sql.exec('INSERT INTO document_tabs (document_id, tab_id) VALUES (?, ?)', 'item-1', id);
  };
  const seen = () => rowsOf(w.sql, 'SELECT tab_id FROM automation_collab_seen ORDER BY tab_id');
  return { watch, armed, store, seen };
}

const nobody = () => Promise.resolve(null);

describe('the rows the diff reads', () => {
  it('are the Inbox rows, with what a row lacks left empty', () => {
    expect(
      collabSummaryOf(
        [{ ...thread('e1'), latestAuthorName: null, latestAuthorColor: undefined }],
        [
          action('a1', 'open', 'ben'),
          { ...action('a2'), assigneeUserId: undefined, assigneeMemberId: 'm1' },
          { ...action('a3'), assigneeUserId: undefined },
        ],
      ),
    ).toMatchObject({
      threads: [{ elementId: 'e1', latestAuthorName: '', latestAuthorColor: '' }],
      actions: [{ assigneeId: 'ben' }, { assigneeId: 'm1' }, { assigneeId: null }],
    });
  });

  it('reads a stored tab body’s elements, and none from anything else', () => {
    expect(tabElements('{"elements":[{"id":"a"}]}')).toEqual([{ id: 'a' }]);
    expect(tabElements('{"elements":{}}')).toEqual([]);
    expect(tabElements('not json')).toEqual([]);
  });

  it('refuses a link table that is no plain name', () => {
    const w = world();
    expect(
      () =>
        new CollabWatch({
          engine: () => w.engine,
          sql: () => w.sql,
          ready: () => true,
          arm: () => {},
          links: 'tabs; DROP',
          rows: () => rows(),
        }),
    ).toThrow('not a table name');
  });
});

describe('while no rule listens', () => {
  it('reads nothing, keeps nothing and asks for no alarm', async () => {
    const w = world();
    const { watch, armed, store, seen } = watched(w);
    store('t1', rows([thread('e1')]));
    watch.restore();
    watch.rulesChanged();
    expect(watch.watching()).toBe(false);
    expect(watch.at).toBeNull();
    expect(watch.baseline(Date.now() + 10_000)).toBe(0);
    expect(await watch.note('t1', rows([thread('e1', 2)]), 1, nobody)).toBe(0);
    expect(seen()).toEqual([]);
    expect(armed.count).toBe(0);
    expect(queued(w.sql)).toEqual([]);
  });
});

describe('the baseline', () => {
  it('reads a few tabs a wake once a rule listens, making no event', () => {
    const w = world();
    const { watch, armed, store, seen } = watched(w);
    for (let i = 0; i < COLLAB_BASELINE_TABS + 2; i += 1)
      store(`t${String(i).padStart(2, '0')}`, rows([thread('e1')]));
    w.rule({ trigger: { kind: 'comment_added' } });
    watch.rulesChanged();
    expect(armed.count).toBe(1);
    // Again: it already knows.
    watch.rulesChanged();
    expect(armed.count).toBe(1);
    const at = watch.at!;
    expect(watch.baseline(at - 1)).toBe(0);
    expect(watch.baseline(at)).toBe(COLLAB_BASELINE_TABS);
    expect(watch.at).toBe(at + COLLAB_BASELINE_MORE_MS);
    expect(watch.baseline(at + COLLAB_BASELINE_MORE_MS)).toBe(2);
    expect(watch.at).toBeNull();
    expect(seen()).toHaveLength(COLLAB_BASELINE_TABS + 2);
    expect(watch.baseline(at + 10_000)).toBe(0);
    expect(queued(w.sql)).toEqual([]);
  });

  it('is checked once after a wake, and emptied when the last listening rule goes', () => {
    const w = world();
    const { watch, store, seen } = watched(w);
    store('t1', rows([thread('e1')]));
    const rule = w.rule({ trigger: { kind: 'thread_resolved' } });
    watch.restore();
    expect(watch.at).not.toBeNull();
    expect(watch.baseline(Date.now() + 1)).toBe(1);
    expect(seen()).toEqual([{ tab_id: 't1' }]);
    w.engine.store.remove(rule.id);
    watch.rulesChanged();
    expect(seen()).toEqual([]);
    expect(watch.at).toBeNull();
  });

  it('stands down when the rule went, or the schema did, before it ran', () => {
    const w = world();
    const { watch, store, seen } = watched(w);
    store('t1', rows());
    const rule = w.rule({ trigger: { kind: 'action_done' } });
    watch.rulesChanged();
    w.engine.store.remove(rule.id);
    expect(watch.baseline(Date.now() + 1)).toBe(0);
    expect(watch.at).toBeNull();
    expect(seen()).toEqual([]);
    w.rule({ trigger: { kind: 'action_done' } });
    watch.rulesChanged();
    w.state.ready = false;
    watch.rulesChanged();
    expect(watch.baseline(Date.now() + 1)).toBe(0);
    watch.forget();
    expect(watch.at).toBeNull();
  });
});

describe('a changed tab', () => {
  it('is kept the first time it is seen, and starts nothing', async () => {
    const w = world();
    const { watch, seen } = watched(w);
    w.rule({ trigger: { kind: 'comment_added' } });
    expect(await watch.note('t1', rows([thread('e1')]), 1, nobody)).toBe(0);
    expect(seen()).toEqual([{ tab_id: 't1' }]);
    // Unchanged: no write, no event.
    expect(await watch.note('t1', rows([thread('e1')]), 2, nobody)).toBe(0);
    expect(queued(w.sql)).toEqual([]);
  });

  it('queues a new comment by its own author, asking nobody who saved', async () => {
    const w = world();
    const { watch } = watched(w);
    w.rule({ trigger: { kind: 'comment_added' } });
    const sole = vi.fn(nobody);
    await watch.note('t1', rows([thread('e1')]), 1, sole);
    expect(await watch.note('t1', rows([thread('e1', 2)]), 2, sole)).toBe(1);
    expect(sole).not.toHaveBeenCalled();
    expect(queued(w.sql)).toMatchObject([
      { kind: 'comment_added', tab: 't1', by: { id: 'ben', name: 'Ben Okafor' } },
    ]);
  });

  it('names whoever alone saved for a resolve, an assign and a done, and nobody when several did', async () => {
    const w = world();
    const { watch } = watched(w);
    w.rule({ trigger: { kind: 'thread_resolved' } });
    w.rule({ trigger: { kind: 'action_done' } });
    await watch.note('t1', rows([thread('e1')], [action('a1')]), 1, nobody);
    expect(
      await watch.note('t1', rows([thread('e1', 1, true)], [action('a1')]), 2, () =>
        Promise.resolve(ANA),
      ),
    ).toBe(1);
    expect(
      await watch.note('t1', rows([thread('e1', 1, true)], [action('a1', 'done')]), 3, nobody),
    ).toBe(1);
    const events = queued(w.sql);
    expect(events).toMatchObject([
      { kind: 'thread_resolved', by: { id: ANA.id } },
      { kind: 'action_done' },
    ]);
    expect(events[1]!.by).toBeUndefined();
  });

  it('forgets a tab that is gone, and reads a damaged summary as none', async () => {
    const w = world();
    const { watch, seen } = watched(w);
    w.rule({ trigger: { kind: 'comment_added' } });
    await watch.note('t1', rows([thread('e1')]), 1, nobody);
    expect(await watch.note('t1', null, 2, nobody)).toBe(0);
    expect(seen()).toEqual([]);
    for (const damaged of ['not json', '{"t":1}']) {
      w.sql.exec(
        'INSERT OR REPLACE INTO automation_collab_seen (tab_id, summary) VALUES (?, ?)',
        't2',
        damaged,
      );
      expect(await watch.note('t2', rows([thread('e1', 3)]), 3, nobody)).toBe(0);
    }
    expect(queued(w.sql)).toEqual([]);
  });
});

describe('the watch wired to the rules', () => {
  it('follows every rule write', () => {
    const w = world();
    const { watch, armed } = watched(w);
    watchRules(w.engine, watch);
    const rule = w.rule({ trigger: { kind: 'comment_added' } });
    expect(watch.at).not.toBeNull();
    expect(armed.count).toBe(1);
    w.engine.store.remove(rule.id);
    expect(watch.at).toBeNull();
  });
});
