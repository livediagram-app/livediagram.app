import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import {
  TAB_STATS_BACKFILL_MAX_ROWS,
  TAB_STATS_BACKFILL_PAGE_ROWS,
  runTabStatsBackfill,
  tabStatsBackfillStatement,
} from './tab-stats-backfill';

// docs/specs/013-workspace/explorer-details-view.md "Counting the existing tabs".

const T0 = 1_700_000_000_000;
let db: SqliteD1;
let log: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

function tabWithoutStats(id: string, data: string) {
  db.sql
    .prepare('INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, ?)')
    .run(id, id, data, T0);
}

function stats(id: string) {
  return db.sql
    .prepare(
      'SELECT mode, element_count, comment_count, data_bytes FROM tab_stats WHERE tab_id = ?',
    )
    .get(id);
}

const counted = () =>
  (db.sql.prepare('SELECT COUNT(*) AS n FROM tab_stats').get() as { n: number }).n;

beforeEach(() => {
  db = sqliteD1();
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('runTabStatsBackfill', () => {
  it('counts every tab without stats from its stored body, and logs once', async () => {
    tabWithoutStats(
      't1',
      JSON.stringify({ opensIn: 'draw', elements: [{ id: 'a' }, { id: 'b' }] }),
    );
    tabWithoutStats(
      't2',
      JSON.stringify({ elements: [{ id: 'c', commentThread: { comments: [{}, {}, {}] } }] }),
    );
    expect(await runTabStatsBackfill(db.env)).toBe(2);
    expect(stats('t1')).toMatchObject({ mode: 'draw', element_count: 2, comment_count: 0 });
    expect(stats('t2')).toMatchObject({ mode: 'diagram', element_count: 1, comment_count: 3 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('tab-stats: backfilled n=2 left=none');
  });

  // A document's Type is the mode of its newest `written_at`: a backfilled old tab dated by the
  // run would outrank a tab edited since.
  it("dates each row by the tab's own last write, not the run", async () => {
    tabWithoutStats('old', '{"elements":[]}');
    vi.useFakeTimers({ now: T0 + 365 * 24 * 60 * 60 * 1000 });
    try {
      await runTabStatsBackfill(db.env);
    } finally {
      vi.useRealTimers();
    }
    expect(db.sql.prepare('SELECT written_at FROM tab_stats WHERE tab_id = ?').get('old')).toEqual({
      written_at: T0,
    });
  });

  it('leaves a tab a write already counted', async () => {
    tabWithoutStats('t1', '{"elements":[]}');
    db.sql
      .prepare(
        'INSERT INTO tab_stats (tab_id, mode, element_count, comment_count, data_bytes, written_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('t1', 'plan', 9, 9, 9, T0);
    expect(await runTabStatsBackfill(db.env)).toBe(0);
    expect(stats('t1')).toMatchObject({ mode: 'plan', element_count: 9 });
  });

  it('counts a corrupt body as empty, warns, and never retries it', async () => {
    tabWithoutStats('bad', '{oops');
    expect(await runTabStatsBackfill(db.env)).toBe(1);
    expect(stats('bad')).toMatchObject({ mode: 'diagram', element_count: 0, data_bytes: 5 });
    expect(warn).toHaveBeenCalledWith('tab-stats: corrupt tab bad counted empty');
    expect(await runTabStatsBackfill(db.env)).toBe(0);
  });

  it('stops at its row bound and says more are left', async () => {
    for (let i = 0; i < TAB_STATS_BACKFILL_PAGE_ROWS * 2 + 3; i++) tabWithoutStats(`t${i}`, '{}');
    expect(await runTabStatsBackfill(db.env, { maxRows: TAB_STATS_BACKFILL_PAGE_ROWS })).toBe(
      TAB_STATS_BACKFILL_PAGE_ROWS,
    );
    expect(log).toHaveBeenLastCalledWith(
      `tab-stats: backfilled n=${TAB_STATS_BACKFILL_PAGE_ROWS} left=more`,
    );
    expect(await runTabStatsBackfill(db.env)).toBe(TAB_STATS_BACKFILL_PAGE_ROWS + 3);
    expect(counted()).toBe(TAB_STATS_BACKFILL_PAGE_ROWS * 2 + 3);
  });

  it('stops when its time budget runs out', async () => {
    for (let i = 0; i < TAB_STATS_BACKFILL_PAGE_ROWS * 3; i++) tabWithoutStats(`t${i}`, '{}');
    let t = 0;
    // Each clock read moves 40 s on: the first page starts inside the 60 s budget, the second does not.
    const clock = () => (t += 40_000);
    expect(await runTabStatsBackfill(db.env, { clock })).toBe(TAB_STATS_BACKFILL_PAGE_ROWS);
  });

  it('is bounded by default', () => {
    expect(TAB_STATS_BACKFILL_MAX_ROWS).toBeGreaterThan(0);
  });
});

describe('tabStatsBackfillStatement', () => {
  it('never replaces a row a racing write put there', async () => {
    tabWithoutStats('t1', '{}');
    db.sql
      .prepare(
        'INSERT INTO tab_stats (tab_id, mode, element_count, comment_count, data_bytes, written_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('t1', 'plan', 9, 9, 9, T0);
    await tabStatsBackfillStatement(
      db.env,
      't1',
      { mode: 'diagram', elementCount: 0, commentCount: 0, dataBytes: 2 },
      T0 + 1,
    ).run();
    expect(stats('t1')).toMatchObject({ mode: 'plan', element_count: 9 });
  });
});
