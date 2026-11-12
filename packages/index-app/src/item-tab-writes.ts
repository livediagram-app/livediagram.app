// Writing an item's tabs inside its Durable Object (item-tab-tables.ts): one tab's write statements, an upsert with
// or without a compare-and-swap on its revision, a rename, a create's seeding, a delete, and the compare-and-swap of
// a tab's body alone. Each product's `db/tabs.ts` binds these to its tables and hands in what its tabs carry beside
// the body: its tab size check, its stats row, and its reference indexes (images, components, sheets).

import { connectionLeftStatement, tabConnectionOf, tabConnectionStatement } from './connected-tabs';
import type { TabConnection } from '@liveworkspace/index-client';
import type { OutboxTable } from './outbox';
import { shareLeaveStatements } from './share-schedule';
import { checkItemTabTables, type ItemTabTables } from './item-tab-tables';

/** A tab as a write takes it: its id and name are columns, the rest is its `data` JSON. */
export type WritableTab = { id: string; name: string };

/** A tab's body as stored: the tab without its id and name. */
export type ItemTabData<Tab extends WritableTab> = Omit<Tab, 'id' | 'name'>;

/** A tab's version as a compare-and-swap reads it. */
export type ItemTabVersion = { rev: number; updatedAt: number };

// How a tab write moves the revision (docs/specs/024-agents/agent-changesets.md "The tab revision"): `advance` from
// whatever is stored, or to exactly `expected + 1`, which the trigger `tabs_rev_advances` turns into a
// compare-and-swap (CS3).
export type TabRevWrite = { advance: true } | { expected: number };

/** What a delete answers: the tab's stored body as it was removed. */
export type DeletedTab = { data: string };

export type ItemTabWritesConfig<
  Env,
  Tab extends WritableTab,
  Stats extends { elementCount: number },
> = {
  db: (env: Env) => D1Database;
  tables: ItemTabTables;
  /** The item's outbox, read when a delete keys a connected tab's removal (a function, so a cycle can't see it unset). */
  outbox: () => OutboxTable;
  /** What every tab write does to a tab first (its action panel lists bounded); default none. */
  prepareTab?: (tab: Tab) => Tab;
  /** How much a tab has to draw: its `element_count`. */
  drawnCount: (tab: Tab) => number;
  /** Refuses (throws) a body over the tab size cap, naming the write. */
  assertFits: (tabId: string, data: string, write: string) => void;
  /** The tab's stats row (the Details view's numbers), from the body just stored. */
  statsOf: (body: ItemTabData<Tab>, data: string) => Stats;
  statsStatement: (
    env: Env,
    tabId: string,
    stats: Stats,
    writtenAt: number,
    ifStoredRev?: number,
  ) => D1PreparedStatement;
  /** The reference indexes a write replaces, after the tabs upsert, which their rows' foreign keys need. */
  refsOnWrite: (env: Env, tab: Tab) => D1PreparedStatement[];
  /** The references a body swap only adds (it can lose to a concurrent save); default none. */
  refsOnSwap?: (env: Env, tabId: string, body: ItemTabData<Tab>) => D1PreparedStatement[];
  /** A delete's own statements: after the connection key, and after the tab body's delete. */
  onDelete?: {
    afterLeft?: (env: Env, itemId: string, tabId: string) => D1PreparedStatement[];
    afterBody?: (env: Env, itemId: string, tabId: string) => D1PreparedStatement[];
    /** The body goes even while another item still links it; by default it stays for them. */
    bodyEvenIfLinked?: boolean;
  };
};

// The revision the first statement of a tabWriteStatements batch returned.
export function revFromBatch(results: readonly unknown[]): number {
  const first = results[0] as { results?: { rev?: unknown }[] } | undefined;
  const rev = first?.results?.[0]?.rev;
  if (typeof rev !== 'number') throw new Error('tab write returned no revision');
  return rev;
}

// A batch the trigger aborted because the tab moved since it was read.
export function isTabRevStale(err: unknown): boolean {
  return err instanceof Error && err.message.includes('tab_rev_stale');
}

export function itemTabWrites<Env, Tab extends WritableTab, Stats extends { elementCount: number }>(
  config: ItemTabWritesConfig<Env, Tab, Stats>,
) {
  const { db, drawnCount, assertFits, statsOf, statsStatement, refsOnWrite } = config;
  const { item, links, key } = checkItemTabTables(config.tables);
  const prepareTab = config.prepareTab ?? ((tab: Tab) => tab);
  const refsOnSwap = config.refsOnSwap ?? (() => []);
  const savedAt = (env: Env, now: number, itemId: string) =>
    db(env).prepare(`UPDATE ${item} SET saved_at = ? WHERE id = ?`).bind(now, itemId);
  const link = (env: Env) =>
    db(env).prepare(
      `INSERT INTO ${links} (${key}, tab_id, order_index, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (${key}, tab_id) DO UPDATE SET order_index = excluded.order_index`,
    );

  // The statements of one tab write. Splits the tab into columns plus a `data` JSON blob (everything except id and
  // name) so list queries can return summaries without parsing element trees. The body goes to `tabs` (RETURNING its
  // new `rev`, always first), its position to its link row, its stats row, the item's `saved_at`, and the reference
  // indexes, replaced in the SAME transaction as the blob they mirror so they can never drift. The collaboration index
  // and the listing summary follow from the outbox the triggers fill in this same transaction. Exported so a changeset
  // batches its record beside the write: a lost compare-and-swap then aborts the whole batch.
  function tabWriteStatements(
    env: Env,
    itemId: string,
    input: Tab,
    orderIndex: number,
    revision: TabRevWrite,
    now = Date.now(),
  ): D1PreparedStatement[] {
    const tab = prepareTab(input);
    // A connected tab's connection is its own column (tabConnectionStatement), set only by the editor's save and the
    // index's reverse write: never part of the body, and never written by a body write.
    const { id, name, connection: _connection, ...rest } = tab as Tab & { connection?: unknown };
    const data = JSON.stringify(rest);
    assertFits(id, data, 'upsertTab');
    const advance = 'advance' in revision;
    const insertRev = advance ? 1 : revision.expected + 1;
    return [
      db(env)
        .prepare(
          `INSERT INTO tabs (id, name, data, updated_at, element_count, rev)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         data = excluded.data,
         updated_at = excluded.updated_at,
         element_count = excluded.element_count,
         rev = ${advance ? 'tabs.rev + 1' : 'excluded.rev'}
       RETURNING rev`,
        )
        .bind(id, name, data, now, drawnCount(tab), insertRev),
      link(env).bind(itemId, id, orderIndex, now),
      statsStatement(env, id, statsOf(rest as ItemTabData<Tab>, data), now),
      savedAt(env, now, itemId),
      ...refsOnWrite(env, tab),
    ];
  }

  // Full upsert for a single tab, advancing its revision from whatever is stored. One batch: extra serial storage
  // hops were once the largest latency item on a save. Answers the new revision.
  async function upsertTab(
    env: Env,
    itemId: string,
    input: Tab,
    orderIndex: number,
  ): Promise<number> {
    const results = await db(env).batch(
      tabWriteStatements(env, itemId, input, orderIndex, { advance: true }),
    );
    return revFromBatch(results);
  }

  // A tab write at the revision the caller read: lands as `expectedRev + 1`, or throws `tab_rev_stale`
  // (isTabRevStale) and writes nothing when the tab moved since (CS3, CS4). `connection`: the editor's save of a
  // connected tab sets it in the same batch; left out, the stored connection stays as it is.
  async function upsertTabAtRev(
    env: Env,
    itemId: string,
    input: Tab,
    orderIndex: number,
    expectedRev: number,
    connection?: TabConnection,
  ): Promise<number> {
    const results = await db(env).batch([
      ...tabWriteStatements(env, itemId, input, orderIndex, { expected: expectedRev }),
      ...(connection ? [tabConnectionStatement(db(env), input.id, connection)] : []),
    ]);
    return revFromBatch(results);
  }

  // A tab rename (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames"): the name column only,
  // advancing the revision (CS42). Answers the new revision, or null for no tab.
  async function renameTab(env: Env, tabId: string, name: string): Promise<number | null> {
    const row = await db(env)
      .prepare('UPDATE tabs SET name = ?, rev = rev + 1, updated_at = ? WHERE id = ? RETURNING rev')
      .bind(name, Date.now(), tabId)
      .first<{ rev: number }>();
    return row?.rev ?? null;
  }

  // Bulk-seed a fresh item's tabs in one batch (the create path), then bump `saved_at` exactly once, rather than a
  // write per tab. Same ON CONFLICT semantics as upsertTab so a retried create stays idempotent. `savedAt`: the item's
  // last-modified date after seeding, its own when a create carried one; absent, now.
  async function seedTabs(env: Env, itemId: string, tabs: Tab[], seededAt?: number): Promise<void> {
    if (tabs.length === 0) return;
    const now = Date.now();
    const prepared = tabs.map(prepareTab);
    // A connected tab a create carries (an Offline Mode sync's, an import's) keeps exactly `{ id, app, itemId }` in
    // its column, never in its body (connected-tabs.md "Copies carry nothing"): the index opens it only in its own
    // host and tab, so anywhere else it offers Connect Again.
    const bodies = prepared.map(
      ({ connection: _connection, ...tab }: Tab & { connection?: unknown }) => tab,
    );
    // Every tab measured before any is written: a create seeds all or none.
    for (const { id, name: _name, ...rest } of bodies) {
      assertFits(id, JSON.stringify(rest), 'seedTabs');
    }
    const stmts = bodies.flatMap((tab, idx) => {
      const { id, name, ...rest } = tab;
      const connection = tabConnectionOf(prepared[idx]);
      const data = JSON.stringify(rest);
      return [
        db(env)
          .prepare(
            `INSERT INTO tabs (id, name, data, updated_at, element_count, rev)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           data = excluded.data,
           updated_at = excluded.updated_at,
           element_count = excluded.element_count,
           rev = tabs.rev + 1`,
          )
          .bind(id, name, data, now, drawnCount(tab as Tab)),
        link(env).bind(itemId, id, idx, now),
        statsStatement(env, id, statsOf(rest as ItemTabData<Tab>, data), now),
        ...(connection ? [tabConnectionStatement(db(env), id, connection)] : []),
      ];
    });
    stmts.push(savedAt(env, seededAt ?? now, itemId));
    // The collaboration index of every seeded tab follows from the outbox: a JSON import or a copy from a share link
    // can carry actions and threads in on create.
    for (const tab of prepared) stmts.push(...refsOnWrite(env, tab));
    await db(env).batch(stmts);
  }

  // Remove the tab from the item: its link row and its body (what hangs off the body by a foreign key goes with it),
  // in one transaction. Answers the tab's stored body as it was removed (null when this item did not hold it), read by
  // the delete itself so a comment written a moment before cannot slip between a read and the delete: the caller
  // retracts the tab's comment events from the item's feed with it. A connected tab's removal goes to the index through
  // the outbox, keyed in the same batch (connectionLeftStatement, connected-tabs.md "Removing").
  async function deleteTabRow(
    env: Env,
    itemId: string,
    tabId: string,
    opts: { keepLast?: boolean } = {},
  ): Promise<DeletedTab | null | 'last'> {
    const d1 = db(env);
    // `keepLast` (a token's delete, which may not take the last tab): the count rides the delete itself, so two
    // deletes that each read two tabs before either ran can't take both.
    const unlink = d1
      .prepare(
        `DELETE FROM ${links} WHERE ${key} = ? AND tab_id = ?
          AND (? = 0 OR (SELECT COUNT(*) FROM ${links} WHERE ${key} = ?) > 1)
        RETURNING (SELECT t.data FROM tabs t WHERE t.id = ${links}.tab_id) AS data`,
      )
      .bind(itemId, tabId, opts.keepLast ? 1 : 0, itemId);
    const body = config.onDelete?.bodyEvenIfLinked
      ? d1.prepare('DELETE FROM tabs WHERE id = ?').bind(tabId)
      : d1
          .prepare(
            `DELETE FROM tabs WHERE id = ? AND NOT EXISTS (SELECT 1 FROM ${links} WHERE tab_id = ?)`,
          )
          .bind(tabId, tabId);
    const rest = [
      // A connected tab that has left: an outbox key, so the room's drain tells the index (removeConnection) and
      // tries again after a failure. After the unlink, before the tab's row goes.
      connectionLeftStatement(d1, config.outbox(), links, itemId, tabId),
      ...(config.onDelete?.afterLeft?.(env, itemId, tabId) ?? []),
      // A shared tab (tab-shares.ts): every other holder hears that this item left, and nothing else it owed them
      // about the tab is sent. Before the tab's delete, which takes its `tab_shares` rows.
      ...shareLeaveStatements(d1, tabId),
      body,
      ...(config.onDelete?.afterBody?.(env, itemId, tabId) ?? []),
    ];
    type Row = { data?: string | null };
    const rowOf = (r: unknown) => (r as { results?: Row[] } | undefined)?.results?.[0];
    let row: Row | undefined;
    if (!opts.keepLast) {
      row = rowOf((await d1.batch([unlink, ...rest]))[0]);
    } else {
      // A refused unlink must not tell the tab's other holders it left, so the rest runs only after one that
      // happened. The room's SQLite answers both at once, with no I/O between them to let another request in.
      row = rowOf((await d1.batch([unlink]))[0]);
      if (!row) {
        const held = await d1
          .prepare(`SELECT 1 AS held FROM ${links} WHERE ${key} = ? AND tab_id = ?`)
          .bind(itemId, tabId)
          .first('held');
        return held ? 'last' : null;
      }
      await d1.batch(rest);
    }
    if (row?.data == null) return null;
    return { data: row.data };
  }

  // Compare-and-swap one tab's `data` blob (docs/specs/013-workspace/share-roles.md "Integrity"; the loop that calls
  // it is @liveworkspace/api-kit tab-swap.ts). Writes `nextData` only while the row is still at `expected`, the
  // version the caller read, and reports whether it did. The `tabs_rev_advances` trigger advances `rev` on every write
  // of `data`, so the same version is the same body: the body is never bound again to be compared. `updated_at` rules
  // out a tab deleted and inserted again under its id at the same revision.
  //
  // Only `data` and `updated_at` move: such a write never renames, reorders or relinks the tab, and it touches no
  // action or thread, so the collaboration index has nothing to mirror. A reference index is only ever ADDED to here:
  // the swap can lose to a concurrent save, and a delete would then drop references the winner wrote.
  async function swapTabData(
    env: Env,
    itemId: string,
    tabId: string,
    expected: ItemTabVersion,
    nextData: string,
    // The tab `nextData` serialises, as the caller built it: its stats and references are read from it, not parsed
    // again. Its element count is also the tab's element_count.
    nextBody: ItemTabData<Tab>,
  ): Promise<boolean> {
    assertFits(tabId, nextData, 'swapTabData');
    const now = Date.now();
    const nextStats = statsOf(nextBody, nextData);
    const [res] = await db(env).batch([
      db(env)
        .prepare(
          'UPDATE tabs SET data = ?, updated_at = ?, element_count = ?, rev = rev + 1 WHERE id = ? AND rev = ? AND updated_at = ?',
        )
        .bind(nextData, now, nextStats.elementCount, tabId, expected.rev, expected.updatedAt),
      // Only if the swap above won: then the tab is at the next revision, written now.
      statsStatement(env, tabId, nextStats, now, expected.rev + 1),
      // Add only, so harmless when the swap lost: the references are a superset, which keeps bytes.
      ...refsOnSwap(env, tabId, nextBody),
    ]);
    if ((res?.meta?.changes ?? 0) === 0) return false;
    await savedAt(env, now, itemId).run();
    return true;
  }

  return {
    tabWriteStatements,
    upsertTab,
    upsertTabAtRev,
    renameTab,
    seedTabs,
    deleteTabRow,
    swapTabData,
  };
}
