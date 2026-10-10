// Counting the tabs written before tab stats existed (migration 0084,
// docs/specs/013-workspace/explorer-details-view.md "Counting the existing tabs"). Tabs written
// since count themselves in their own batch; this reaches the rest.
//
// Driven by the daily cron. Each run reads a small page of tabs without stats, counts their bodies
// with the same tabStatsOf every write uses, and inserts the rows, until it runs out of tabs, rows
// or time; the rest wait a day. An insert never replaces a row: a write that lands between the read
// and the insert has already counted the newer body.

import { tabStatsOfData, type TabStats } from './db/tab-stats';
import type { Env } from './types';

// Bodies parsed at once: each at most MAX_TAB_BYTES (under 2 MB), so a page stays under 20 MB.
export const TAB_STATS_BACKFILL_PAGE_ROWS = 10;
// Tabs one run may count; the rest wait a day.
export const TAB_STATS_BACKFILL_MAX_ROWS = 5000;
// Wall-clock budget per run, as the image-refs backfill's.
export const TAB_STATS_BACKFILL_BUDGET_MS = 60 * 1000;

// The backfill's insert: a row only where none exists.
export function tabStatsBackfillStatement(
  env: Env,
  tabId: string,
  stats: TabStats,
  writtenAt: number,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO tab_stats (tab_id, mode, element_count, comment_count, data_bytes, written_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tab_id) DO NOTHING`,
  ).bind(tabId, stats.mode, stats.elementCount, stats.commentCount, stats.dataBytes, writtenAt);
}

// Count up to `maxRows` uncounted tabs within the time budget; answers how many it counted.
export async function runTabStatsBackfill(
  env: Env,
  {
    maxRows = TAB_STATS_BACKFILL_MAX_ROWS,
    clock = Date.now,
  }: { maxRows?: number; clock?: () => number } = {},
): Promise<number> {
  const start = clock();
  let counted = 0;
  let left: 'more' | 'none' = 'more';
  while (counted < maxRows && clock() - start < TAB_STATS_BACKFILL_BUDGET_MS) {
    const limit = Math.min(TAB_STATS_BACKFILL_PAGE_ROWS, maxRows - counted);
    const { results } = await env.DB.prepare(
      `SELECT t.id, t.data FROM tabs t
        WHERE NOT EXISTS (SELECT 1 FROM tab_stats s WHERE s.tab_id = t.id)
        LIMIT ?`,
    )
      .bind(limit)
      .all<{ id: string; data: string }>();
    const now = Date.now();
    const statements = results.map((row) => {
      const { stats, corrupt } = tabStatsOfData(row.data);
      if (corrupt) console.warn(`tab-stats: corrupt tab ${row.id} counted empty`);
      return tabStatsBackfillStatement(env, row.id, stats, now);
    });
    if (statements.length > 0) await env.DB.batch(statements);
    counted += results.length;
    if (results.length < limit) {
      left = 'none';
      break;
    }
  }
  console.log(`tab-stats: backfilled n=${counted} left=${left}`);
  return counted;
}
