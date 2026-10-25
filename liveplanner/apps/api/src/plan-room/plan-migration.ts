// The migration door's write into a plan's own SQLite (docs/specs/015-api/api.md "Internal", docs/migration.md
// "The apps' migration door"): an old livediagram.app document's liveplanner part (its Board, Sheet, Dashboard and
// Form tabs, and its Plan rows), with its own times, in one transaction. The tab, item-row and changeset rules are
// the kit's (@liveworkspace/index-app migration-room.ts); this names the plan's tables and adds Plan's rows, by the
// same rule: a row is written when the plan has neither it nor a record of writing it, replaced when it is still at
// the revision the door last wrote (`migration_rows`), and otherwise left as the new side has it. Nothing is deleted.
//
//   - The plan row's item type catalogue, by its rev (`types`); its items' next key only ever moves up, past every
//     key the plan holds, so a card made on the new side never collides with an imported one; its items rev moves on
//     when any item was written, so open boards read the new set.
//   - Items by their rev (`item`). One whose key the new side already gave another card is skipped and logged.
//   - Sheets by their rev (`sheet`), inserted before any `sheet_refs` row (the reference triggers settle a sheet as
//     its rows come and go, and must find it), then their cells upserted (never removed), then each written sheet's
//     counts recounted as a sheet write keeps them (db/sheets.ts recountStatement).
//   - `sheet_refs` for every Sheet element on a tab written (db/sheet-refs.ts sheetRefIds), added, never removed.
//   - Form links inserted under their code, never updated: their counters and suspension are the new side's.
// liveplanner keeps no images: the payload's image owners and grants have nowhere to go.

import {
  migrationRowRev,
  recordMigrationRow,
  writeMigratedRoom,
  type ItemDb,
  type ItemSql,
  type MigrationExtraContext,
  type MigrationRoomShape,
} from '@liveworkspace/index-app';
import type {
  MigrationDoorAnswer,
  MigrationPlanData,
  MigrationRoomPayload,
} from '@liveworkspace/migration';
import { tabStatsOfData } from '../db/tab-stats';
import { sheetRefsOfData } from './plan-content';

export const PLAN_MIGRATION_SHAPE: MigrationRoomShape = {
  itemTable: 'plan',
  linkTable: 'plan_tabs',
  itemColumn: 'plan_id',
  presentation: false,
  opensIn: true,
  tabKind: true,
  images: false,
  tabStats: (data) => {
    const { stats } = tabStatsOfData(data);
    return {
      mode: stats.mode,
      kind: stats.kind,
      element_count: stats.elementCount,
      comment_count: stats.commentCount,
      data_bytes: stats.dataBytes,
    };
  },
};

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

function writeItemTypes(sql: ItemSql, planId: string, plan: MigrationPlanData, now: number) {
  const row = sql
    .exec('SELECT item_types, item_types_rev FROM plan WHERE id = ?', planId)
    .toArray()[0];
  if (!row) return;
  const rev = Number(row.item_types_rev);
  const recorded = migrationRowRev(sql, 'types', planId);
  const fresh = row.item_types === null && recorded === null;
  if (!fresh && recorded !== rev) return;
  if (plan.itemTypes === null) return;
  const next = Math.max(fresh ? rev : rev + 1, plan.itemTypesRev);
  sql.exec(
    'UPDATE plan SET item_types = ?, item_types_rev = ? WHERE id = ?',
    plan.itemTypes,
    next,
    planId,
  );
  recordMigrationRow(sql, 'types', planId, next, now);
}

function writeItems(sql: ItemSql, planId: string, plan: MigrationPlanData, now: number): number {
  let written = 0;
  let collided = 0;
  for (const item of plan.items) {
    const row = sql
      .exec('SELECT rev FROM items WHERE plan_id = ? AND id = ?', planId, item.id)
      .toArray()[0];
    const rev = num(row?.rev);
    const recorded = migrationRowRev(sql, 'item', item.id);
    let wrote: number;
    if (rev === null && recorded === null) {
      wrote = item.rev;
      sql.exec(
        `INSERT OR IGNORE INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at,
           created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        planId,
        item.id,
        item.type,
        item.itemKey,
        item.rank,
        item.fields,
        wrote,
        item.createdAt,
        item.updatedAt,
        item.createdBy ?? '',
        item.updatedBy ?? '',
      );
      if (Number(sql.exec('SELECT changes() AS n').toArray()[0]?.n ?? 0) === 0) {
        collided++;
        continue;
      }
    } else if (rev !== null && rev === recorded) {
      // Its key stays: the plan may have given the old one to another card since.
      wrote = rev + 1;
      sql.exec(
        `UPDATE items SET type = ?, rank = ?, fields = ?, rev = ?, updated_at = ?, updated_by = ?
          WHERE plan_id = ? AND id = ?`,
        item.type,
        item.rank,
        item.fields,
        wrote,
        item.updatedAt,
        item.updatedBy ?? '',
        planId,
        item.id,
      );
    } else continue;
    recordMigrationRow(sql, 'item', item.id, wrote, now);
    written++;
  }
  if (collided > 0) console.warn('[migration] items skipped: key taken', { planId, collided });
  return written;
}

function writePlanCounters(
  sql: ItemSql,
  planId: string,
  plan: MigrationPlanData,
  itemsWritten: number,
): void {
  sql.exec(
    `UPDATE plan SET
       items_next_key = MAX(items_next_key, ?2,
         (SELECT COALESCE(MAX(item_key), 0) + 1 FROM items WHERE plan_id = ?1)),
       items_rev = CASE WHEN ?3 > 0 THEN MAX(items_rev + 1, ?4) ELSE items_rev END
     WHERE id = ?1`,
    planId,
    plan.itemsNextKey,
    itemsWritten,
    plan.itemsRev,
  );
}

function writeSheets(sql: ItemSql, planId: string, plan: MigrationPlanData, now: number) {
  const written = new Set<string>();
  for (const sheet of plan.sheets) {
    const row = sql
      .exec('SELECT rev FROM sheets WHERE plan_id = ? AND id = ?', planId, sheet.id)
      .toArray()[0];
    const rev = num(row?.rev);
    const recorded = migrationRowRev(sql, 'sheet', sheet.id);
    let wrote: number;
    if (rev === null && recorded === null) {
      wrote = sheet.rev;
      sql.exec(
        `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        planId,
        sheet.id,
        sheet.tabId,
        sheet.title,
        sheet.layout,
        wrote,
        sheet.createdAt,
        sheet.updatedAt,
        sheet.updatedBy ?? '',
      );
    } else if (rev !== null && rev === recorded) {
      wrote = rev + 1;
      sql.exec(
        `UPDATE sheets SET title = ?, layout = ?, rev = ?, updated_at = ?, updated_by = ?
          WHERE plan_id = ? AND id = ?`,
        sheet.title,
        sheet.layout,
        wrote,
        sheet.updatedAt,
        sheet.updatedBy ?? '',
        planId,
        sheet.id,
      );
    } else continue;
    recordMigrationRow(sql, 'sheet', sheet.id, wrote, now);
    written.add(sheet.id);
  }
  // The written sheets' cells, upserted in chunks of one JSON parameter each (a Durable Object string's 2 MB cap).
  const cells = plan.cells.filter((c) => written.has(c.sheetId));
  for (const chunk of jsonChunks(cells)) {
    sql.exec(
      `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input, format)
       SELECT ?1, value ->> '$.sheetId', value ->> '$.rowId', value ->> '$.colId', value ->> '$.input',
              value ->> '$.format'
         FROM json_each(?2) WHERE true
       ON CONFLICT (plan_id, sheet_id, row_id, col_id) DO UPDATE SET input = excluded.input, format = excluded.format`,
      planId,
      chunk,
    );
  }
  for (const id of written) {
    sql.exec(
      `UPDATE sheets SET
         cell_count = (SELECT COUNT(*) FROM sheet_cells WHERE plan_id = ?1 AND sheet_id = ?2),
         cell_bytes = (SELECT COALESCE(SUM(COALESCE(length(input), 0) + COALESCE(length(format), 0)), 0)
                         FROM sheet_cells WHERE plan_id = ?1 AND sheet_id = ?2)
       WHERE plan_id = ?1 AND id = ?2`,
      planId,
      id,
    );
  }
}

const CHUNK_BYTES = 1_000_000;

function jsonChunks(rows: readonly unknown[]): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let size = 2;
  for (const row of rows) {
    const json = JSON.stringify(row);
    if (current.length > 0 && size + json.length + 1 > CHUNK_BYTES) {
      out.push(`[${current.join(',')}]`);
      current = [];
      size = 2;
    }
    current.push(json);
    size += json.length + 1;
  }
  if (current.length > 0) out.push(`[${current.join(',')}]`);
  return out;
}

function writeFormLinks(sql: ItemSql, planId: string, plan: MigrationPlanData) {
  if (plan.formLinks.length === 0) return;
  sql.exec(
    `INSERT OR IGNORE INTO form_links (code, project_id, tab_id, open, created_at, responses, last_response_at,
       deleted_at)
     SELECT value ->> '$.code', ?1, value ->> '$.tabId', value ->> '$.open', value ->> '$.createdAt',
            value ->> '$.responses', value ->> '$.lastResponseAt', value ->> '$.deletedAt'
       FROM json_each(?2)`,
    planId,
    JSON.stringify(plan.formLinks),
  );
}

function writePlanRows({ sql, payload, writtenTabs, now }: MigrationExtraContext): void {
  const plan = payload.plan;
  if (plan) {
    writeItemTypes(sql, payload.id, plan, now);
    const items = writeItems(sql, payload.id, plan, now);
    writePlanCounters(sql, payload.id, plan, items);
    writeSheets(sql, payload.id, plan, now);
  }
  // After the sheets, so the reference triggers find them.
  for (const tab of writtenTabs.values()) {
    const ids = sheetRefsOfData(tab.data);
    if (ids.length === 0) continue;
    sql.exec(
      'INSERT OR IGNORE INTO sheet_refs (tab_id, sheet_id) SELECT ?, value FROM json_each(?)',
      tab.id,
      JSON.stringify(ids),
    );
  }
  if (plan) writeFormLinks(sql, payload.id, plan);
}

export function importMigratedPlan(
  db: ItemDb,
  payload: MigrationRoomPayload,
  now = Date.now(),
): MigrationDoorAnswer {
  return db.transact((sql) =>
    writeMigratedRoom(sql, PLAN_MIGRATION_SHAPE, payload, now, writePlanRows),
  );
}
