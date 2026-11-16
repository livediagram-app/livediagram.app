// Watches on a plan's Sheets (liveworkspace/docs/specs/004-index/sheet-sources.md "Keeping in step"): another app's item whose
// chart reads a Sheet asks, with each read, to be told when that Sheet changes. The room keeps each watch for a day
// from its last read, at most SHEET_WATCHERS_PER_SOURCE of them, and gathers the changes to watched Sheets for
// SHEET_CHANGE_SETTLE_MS before telling the index once, which tells each watching item's app. Ids only, never values.
import {
  SHEET_CHANGE_SHEETS_MAX,
  SHEET_WATCHERS_MAX,
  type IndexAppClient,
} from '@liveworkspace/index-client';

// Spec "Keeping in step": a day from the last read (an hour to a week), 50 a plan (10 to 500), 1.5 s to gather a burst
// of edits (250 ms to 10 s).
export const SHEET_WATCH_TTL_MS = 24 * 60 * 60 * 1000;
export const SHEET_WATCHERS_PER_SOURCE = 50;
export const SHEET_CHANGE_SETTLE_MS = 1_500;

type Sql = {
  exec: (query: string, ...bindings: unknown[]) => { toArray(): unknown[] };
};

type Signal = Pick<IndexAppClient, 'sheetChanged'>;

const SCHEMA = `CREATE TABLE IF NOT EXISTS sheet_watches (
  watcher TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  until INTEGER NOT NULL,
  PRIMARY KEY (watcher, sheet_id)
)`;

const chunks = <T>(list: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );

export class SheetWatches {
  private readonly pending = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly sql: Sql;
  // The index, or null where it is not configured (nothing is told).
  private readonly signal: () => Signal | null;
  private readonly now: () => number;
  private readonly settleMs: number;

  constructor(
    sql: Sql,
    signal: () => Signal | null,
    now: () => number = () => Date.now(),
    settleMs = SHEET_CHANGE_SETTLE_MS,
  ) {
    this.sql = sql;
    this.signal = signal;
    this.now = now;
    this.settleMs = settleMs;
  }

  // Made on every use (cheap), so a purge's deleteAll never leaves a stale "made" mark behind.
  private table(): void {
    this.sql.exec(SCHEMA);
  }

  // A read asked to watch: kept a day from now; lapsed watches go, and past the cap the soonest to lapse.
  watch(planId: string, sheetId: string, watcher: string): void {
    this.table();
    const now = this.now();
    this.sql.exec('DELETE FROM sheet_watches WHERE until <= ?', now);
    this.sql.exec(
      `INSERT INTO sheet_watches (watcher, sheet_id, plan_id, until) VALUES (?, ?, ?, ?)
       ON CONFLICT (watcher, sheet_id) DO UPDATE SET until = excluded.until, plan_id = excluded.plan_id`,
      watcher,
      sheetId,
      planId,
      now + SHEET_WATCH_TTL_MS,
    );
    this.sql.exec(
      `DELETE FROM sheet_watches WHERE rowid IN
         (SELECT rowid FROM sheet_watches ORDER BY until DESC LIMIT -1 OFFSET ?)`,
      SHEET_WATCHERS_PER_SOURCE,
    );
  }

  // A Sheet changed (any relayed `sheets` op). An unwatched Sheet costs one indexed probe and nothing else.
  changed(sheetId: string): void {
    this.table();
    const live = this.sql
      .exec(
        'SELECT 1 FROM sheet_watches WHERE sheet_id = ? AND until > ? LIMIT 1',
        sheetId,
        this.now(),
      )
      .toArray();
    if (live.length === 0) return;
    this.pending.add(sheetId);
    this.timer ??= setTimeout(() => void this.flush(), this.settleMs);
  }

  // Tell the index about the gathered Sheets, once; forget the watchers it answers gone.
  async flush(): Promise<void> {
    this.timer = null;
    const sheetIds = [...this.pending].slice(0, SHEET_CHANGE_SHEETS_MAX);
    this.pending.clear();
    if (sheetIds.length === 0) return;
    this.table();
    const rows = this.sql
      .exec(
        `SELECT DISTINCT watcher, plan_id FROM sheet_watches
         WHERE sheet_id IN (SELECT value FROM json_each(?)) AND until > ?`,
        JSON.stringify(sheetIds),
        this.now(),
      )
      .toArray() as { watcher: string; plan_id: string }[];
    const client = this.signal();
    if (!client || rows.length === 0) return;
    const byPlan = new Map<string, string[]>();
    for (const r of rows) byPlan.set(r.plan_id, [...(byPlan.get(r.plan_id) ?? []), r.watcher]);
    for (const [planId, watchers] of byPlan) {
      for (const part of chunks([...new Set(watchers)], SHEET_WATCHERS_MAX)) {
        try {
          const gone = await client.sheetChanged(planId, sheetIds, part);
          if (gone.length > 0) {
            this.sql.exec(
              'DELETE FROM sheet_watches WHERE watcher IN (SELECT value FROM json_each(?))',
              JSON.stringify(gone),
            );
          }
        } catch (err) {
          // The next change, or the watching item's next open, catches its readers up.
          console.warn('[sheets] sheet-changed failed', { error: String(err) });
        }
      }
    }
  }
}
