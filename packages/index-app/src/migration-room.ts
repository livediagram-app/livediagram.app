// The migration door's write into one item's Durable Object (docs/migration.md "The apps' migration door"; the
// contract is @liveworkspace/migration contract.ts): an old livediagram document's part, with its own times, its
// changesets and its image rows, written in ONE transaction (ItemDb.transact) so a part lands whole or not at all.
//
// The rules, the same in every app:
//   - Nothing is ever deleted, and nothing the new side made is written over.
//   - A tab is written when the room has neither it nor a record of writing it (a first run), or replaced when the
//     room's tab is still at the revision the door last wrote (`migration_tabs`): nobody has saved it since. A
//     replace moves the revision on by one (the `tabs_rev_advances` trigger) and records the new one. Anything
//     else (saved on the new side since, or deleted there after an import, or an id the new side made itself) is
//     left alone and answered in `edited`.
//   - The item's own row (name, owner, team, times, provenance, deck) is written when the room is empty (not
//     started, or started with no tab and never imported) or its `saved_at` is still the one the door last wrote
//     (`migration_rows` kind `meta`): nobody has saved the item since.
//   - Changesets, image owners and image grants are only ever inserted (`INSERT OR IGNORE`), each changeset only
//     beside a tab the room holds.
// Each app hands in its table names and its own derivations (a tab's stats, the images a body places), and
// liveplanner its Plan rows through `extra`, inside the same transaction.
//
// The room's outbox triggers see these as ordinary writes: a link row inserted, a tab's data updated, its stats, its
// image references and the item row's `saved_at` each key the summary, collab and media pushes, so the index and the
// media service hear about an imported item as they do about any other.

import type {
  MigrationDoorAnswer,
  MigrationRoomPayload,
  MigrationTab,
} from '@liveworkspace/migration';
import type { ItemSql } from './item-db';

// The tables the door keeps (one appended schema step in each app's room, never an edit of an earlier one):
//   migration_tabs: the revision the door last wrote each tab at.
//   migration_rows: the same for the item's other rows: `meta` (keyed by the item id, its `saved_at`), and in
//                   liveplanner `types` (the item type catalogue's rev), `item` and `sheet` (each row's rev).
// Neither references the rows it records, so a tab deleted on the new side after an import keeps its record and is
// never brought back.
export function migrationSchema(): string {
  return `
CREATE TABLE IF NOT EXISTS migration_tabs (
  tab_id     TEXT    PRIMARY KEY,
  rev        INTEGER NOT NULL,
  written_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS migration_rows (
  kind       TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  rev        INTEGER NOT NULL,
  written_at INTEGER NOT NULL,
  PRIMARY KEY (kind, id)
) WITHOUT ROWID;
`;
}

// A column value as the item's SQLite binds it.
export type MigrationValue = string | number | null;

// How one app's room stores an item (each app's schema).
export type MigrationRoomShape = {
  // The item's own row: `document`, `design` or `plan`.
  itemTable: string;
  // The tab links (`document_tabs`, `design_tabs`, `plan_tabs`) and the item column they, and `agent_changesets`,
  // key by (`document_id`, `design_id`, `plan_id`).
  linkTable: string;
  itemColumn: string;
  // Which of the payload's optional item fields this app's row has.
  presentation: boolean;
  opensIn: boolean;
  tabKind: boolean;
  // Whether the room keeps image rows (`image_refs`, `image_owners`, `image_grants`).
  images: boolean;
  // A tab body's `tab_stats` columns (tab_id and written_at aside): the app's own counting.
  tabStats: (data: string) => Record<string, MigrationValue>;
  // The images a body places, for `image_refs` (only with `images`).
  imageRefs?: (data: string) => string[];
};

// What `extra` is handed: the open transaction's SQL, the tabs written (by id, with the body written), and whether the
// item row was written.
export type MigrationExtraContext = {
  sql: ItemSql;
  payload: MigrationRoomPayload;
  writtenTabs: ReadonlyMap<string, MigrationTab>;
  metaWritten: boolean;
  now: number;
};

// A row's recorded revision, read and written (`migration_rows`).
export function migrationRowRev(sql: ItemSql, kind: string, id: string): number | null {
  const row = sql
    .exec('SELECT rev FROM migration_rows WHERE kind = ? AND id = ?', kind, id)
    .toArray()[0];
  return typeof row?.rev === 'number' ? row.rev : null;
}

export function recordMigrationRow(
  sql: ItemSql,
  kind: string,
  id: string,
  rev: number,
  now: number,
): void {
  sql.exec(
    `INSERT INTO migration_rows (kind, id, rev, written_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (kind, id) DO UPDATE SET rev = excluded.rev, written_at = excluded.written_at`,
    kind,
    id,
    rev,
    now,
  );
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

// The item row: written when the room is empty or still holds what the door last wrote. Answers whether it was.
function writeMeta(sql: ItemSql, shape: MigrationRoomShape, p: MigrationRoomPayload, now: number) {
  const { itemTable: item, linkTable: link, itemColumn: col } = shape;
  const row = sql
    .exec(`SELECT saved_at, created_at FROM ${item} WHERE id = ?`, p.id)
    .toArray()[0] as { saved_at: number; created_at: number } | undefined;
  const recorded = migrationRowRev(sql, 'meta', p.id);
  const holdsTabs =
    sql.exec(`SELECT 1 AS held FROM ${link} WHERE ${col} = ? LIMIT 1`, p.id).toArray().length > 0;
  const empty = !row || row.created_at === 0 || (!holdsTabs && recorded === null);
  const unchanged = row !== undefined && recorded !== null && row.saved_at === recorded;
  if (!empty && !unchanged) return false;
  const cols: [string, MigrationValue][] = [
    ['id', p.id],
    ['saved_at', p.savedAt],
    ['created_at', p.createdAt],
    ['name', p.name],
    ['owner_id', p.ownerId],
    ['team_id', p.teamId],
    ['source', p.source],
  ];
  if (shape.presentation) cols.push(['presentation', p.presentation]);
  if (shape.opensIn) cols.push(['opens_in', p.opensIn]);
  if (shape.tabKind) cols.push(['tab_kind', p.tabKind]);
  const names = cols.map(([c]) => c);
  sql.exec(
    `INSERT INTO ${item} (${names.join(', ')}) VALUES (${placeholders(names.length)})
     ON CONFLICT (id) DO UPDATE SET ${names
       .slice(1)
       .map((c) => `${c} = excluded.${c}`)
       .join(', ')}`,
    ...cols.map(([, v]) => v),
  );
  recordMigrationRow(sql, 'meta', p.id, p.savedAt, now);
  return true;
}

function writeTabStats(sql: ItemSql, shape: MigrationRoomShape, tab: MigrationTab, now: number) {
  const stats = shape.tabStats(tab.data);
  const names = Object.keys(stats);
  sql.exec(
    `INSERT INTO tab_stats (tab_id, ${names.join(', ')}, written_at) VALUES (${placeholders(names.length + 2)})
     ON CONFLICT (tab_id) DO UPDATE SET ${[...names, 'written_at']
       .map((c) => `${c} = excluded.${c}`)
       .join(', ')}`,
    tab.id,
    ...names.map((n) => stats[n] ?? null),
    now,
  );
}

function writeImageRefs(sql: ItemSql, shape: MigrationRoomShape, tab: MigrationTab) {
  if (!shape.images || !shape.imageRefs) return;
  const ids = shape.imageRefs(tab.data);
  if (ids.length === 0) return;
  // Added, never removed: a reference the old side dropped only keeps an image from the sweep a little longer.
  sql.exec(
    'INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)',
    tab.id,
    JSON.stringify(ids),
  );
}

// A tab's first revision: past the newest changeset the old side recorded on it, so its history's revisions stay
// below the tab's (the contract carries no tab revision of its own).
function firstRev(p: MigrationRoomPayload, tabId: string): number {
  let rev = 1;
  for (const c of p.changesets) if (c.tabId === tabId && c.rev > rev) rev = c.rev;
  return rev;
}

function writeTabs(
  sql: ItemSql,
  shape: MigrationRoomShape,
  p: MigrationRoomPayload,
  now: number,
): { written: Map<string, MigrationTab>; edited: string[] } {
  const ids = JSON.stringify(p.tabs.map((t) => t.id));
  const revs = new Map(
    sql
      .exec('SELECT id, rev FROM tabs WHERE id IN (SELECT value FROM json_each(?))', ids)
      .toArray()
      .map((r) => [String(r.id), Number(r.rev)]),
  );
  const recorded = new Map(
    sql
      .exec(
        'SELECT tab_id, rev FROM migration_tabs WHERE tab_id IN (SELECT value FROM json_each(?))',
        ids,
      )
      .toArray()
      .map((r) => [String(r.tab_id), Number(r.rev)]),
  );
  const written = new Map<string, MigrationTab>();
  const edited: string[] = [];
  for (const tab of p.tabs) {
    const rev = revs.get(tab.id);
    const last = recorded.get(tab.id);
    let wroteRev: number;
    if (rev === undefined && last === undefined) {
      wroteRev = firstRev(p, tab.id);
      sql.exec(
        'INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES (?, ?, ?, ?, ?, ?)',
        tab.id,
        tab.name,
        tab.data,
        tab.updatedAt,
        tab.elementCount,
        wroteRev,
      );
    } else if (rev !== undefined && rev === last) {
      wroteRev = rev + 1;
      sql.exec(
        'UPDATE tabs SET name = ?, data = ?, updated_at = ?, element_count = ?, rev = ? WHERE id = ?',
        tab.name,
        tab.data,
        tab.updatedAt,
        tab.elementCount,
        wroteRev,
        tab.id,
      );
    } else {
      edited.push(tab.id);
      continue;
    }
    // The link after the tab (its foreign key), kept as it is when the tab is already linked (a reorder on the new
    // side moves no revision, and stays).
    sql.exec(
      `INSERT OR IGNORE INTO ${shape.linkTable} (${shape.itemColumn}, tab_id, order_index, added_at, folder)
       VALUES (?, ?, ?, ?, ?)`,
      p.id,
      tab.id,
      tab.orderIndex,
      tab.addedAt,
      tab.folder,
    );
    writeTabStats(sql, shape, tab, now);
    writeImageRefs(sql, shape, tab);
    sql.exec(
      `INSERT INTO migration_tabs (tab_id, rev, written_at) VALUES (?, ?, ?)
       ON CONFLICT (tab_id) DO UPDATE SET rev = excluded.rev, written_at = excluded.written_at`,
      tab.id,
      wroteRev,
      now,
    );
    written.set(tab.id, tab);
  }
  return { written, edited };
}

// The old changesets and their parts, inserted beside the tabs the room holds; one already here is kept.
function writeChangesets(sql: ItemSql, shape: MigrationRoomShape, p: MigrationRoomPayload) {
  for (const c of p.changesets) {
    sql.exec(
      `INSERT OR IGNORE INTO agent_changesets (id, ${shape.itemColumn}, tab_id, rev, base_rev, author_id,
         author_name, author_color, token_id, summary, fingerprints, added, changed, removed, created_tab, revert_of,
         created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
        WHERE EXISTS (SELECT 1 FROM tabs WHERE id = ?3)`,
      c.id,
      p.id,
      c.tabId,
      c.rev,
      c.baseRev,
      c.authorId ?? '',
      c.authorName ?? '',
      c.authorColor ?? '',
      c.tokenId,
      c.summary,
      c.fingerprints ?? '[]',
      c.added,
      c.changed,
      c.removed,
      c.createdTab,
      c.revertOf,
      c.createdAt,
    );
    for (const part of c.parts) {
      sql.exec(
        `INSERT OR IGNORE INTO agent_changeset_parts (changeset_id, part, data)
         SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM agent_changesets WHERE id = ?1)`,
        c.id,
        part.part,
        part.data,
      );
    }
  }
}

function writeImages(sql: ItemSql, shape: MigrationRoomShape, p: MigrationRoomPayload) {
  if (!shape.images) return;
  if (p.imageOwners.length > 0) {
    sql.exec(
      `INSERT OR IGNORE INTO image_owners (image_id, owner_id)
       SELECT value ->> '$.imageId', value ->> '$.owner' FROM json_each(?)`,
      JSON.stringify(p.imageOwners),
    );
  }
  if (p.imageGrants.length > 0) {
    sql.exec(
      `INSERT OR IGNORE INTO image_grants (image_id, created_at)
       SELECT value ->> '$.imageId', value ->> '$.createdAt' FROM json_each(?)`,
      JSON.stringify(p.imageGrants),
    );
  }
}

// The whole write, inside the caller's transaction (ItemDb.transact). `extra`: the app's own rows (liveplanner's
// Plan data), in the same transaction, after the tabs.
export function writeMigratedRoom(
  sql: ItemSql,
  shape: MigrationRoomShape,
  payload: MigrationRoomPayload,
  now: number,
  extra?: (context: MigrationExtraContext) => void,
): MigrationDoorAnswer {
  const meta = writeMeta(sql, shape, payload, now);
  const { written, edited } = writeTabs(sql, shape, payload, now);
  writeChangesets(sql, shape, payload);
  writeImages(sql, shape, payload);
  extra?.({ sql, payload, writtenTabs: written, metaWritten: meta, now });
  return { written: [...written.keys()], edited, meta };
}
