// A plan's snapshots (docs/specs/013-workspace/snapshots.md; liveworkspace/docs/specs/013-snapshots/snapshots.md): the
// thin door onto @liveworkspace/snapshots. A snapshot is the plan's own `.liveplanner` file (project-file.ts), and a
// revert reads it back keeping every id, then writes it in place in three steps: the Sheets (so the tabs' references
// find them), the card types and cards (a card made since goes, a card removed since comes back with its key, a card
// that lived through keeps its history with its revision moved on), then the tabs. Comment threads and Automations
// rules stay as they are (blueprint SND2). The room then forgets its ledger and closes every socket.

import type { Tab } from '@liveplanner/project';
import {
  serveSnapshots,
  type SnapshotCaller,
  type SnapshotDb,
  type SnapshotDoor,
} from '@liveworkspace/snapshots/server';
import { replaceTabs } from '../db/tabs';
import { authorOf } from '../routes/changesets';
import { gateEdit, type PlanRouteContext } from '../routes/context';
import type { PlanEnv } from '../types';
import { chunksOf, type PlanCopy } from './plan-copy';
import { exportProjectFile, readProjectFile } from './project-file';

const idsOf = (rows: readonly Record<string, unknown>[]) => JSON.stringify(rows.map((r) => r.id));

// The plan's Sheets become the snapshot's: one made since goes with its cells, each of the snapshot's is written back
// whole (its revision moved on, so a stale write is refused).
function sheetStatements(env: PlanEnv, planId: string, copy: PlanCopy, now: number) {
  const db = env.PLAN_DB;
  return [
    db
      .prepare(
        `DELETE FROM sheets WHERE plan_id = ?1 AND id NOT IN (SELECT value FROM json_each(?2))`,
      )
      .bind(planId, idsOf(copy.sheets)),
    db
      .prepare(
        `DELETE FROM sheet_cells WHERE plan_id = ?1 AND sheet_id IN (SELECT value FROM json_each(?2))`,
      )
      .bind(planId, idsOf(copy.sheets)),
    ...chunksOf(copy.sheets).map((chunk) =>
      db
        .prepare(
          `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, cell_count, cell_bytes, created_at, updated_at, updated_by)
           SELECT ?1, value ->> '$.id', value ->> '$.tab_id', value ->> '$.title', value ->> '$.layout', 0,
                  value ->> '$.cell_count', value ->> '$.cell_bytes', ?2, ?2, value ->> '$.updated_by'
             FROM json_each(?3) WHERE true
           ON CONFLICT (plan_id, id) DO UPDATE SET tab_id = excluded.tab_id, title = excluded.title,
             layout = excluded.layout, rev = sheets.rev + 1, cell_count = excluded.cell_count,
             cell_bytes = excluded.cell_bytes, updated_at = excluded.updated_at, updated_by = excluded.updated_by,
             unreferenced_since = NULL`,
        )
        .bind(planId, now, chunk),
    ),
    ...chunksOf(copy.cells).map((chunk) =>
      db
        .prepare(
          `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input, format)
           SELECT ?1, value ->> '$.sheet_id', value ->> '$.row_id', value ->> '$.col_id', value ->> '$.input',
                  value ->> '$.format'
             FROM json_each(?2)`,
        )
        .bind(planId, chunk),
    ),
  ];
}

// The card types and cards become the snapshot's, the store's revision moved on once.
function itemStatements(env: PlanEnv, planId: string, copy: PlanCopy, now: number) {
  const db = env.PLAN_DB;
  return [
    db
      .prepare(
        `DELETE FROM items WHERE plan_id = ?1 AND id NOT IN (SELECT value FROM json_each(?2))`,
      )
      .bind(planId, idsOf(copy.items)),
    ...chunksOf(copy.items).map((chunk) =>
      db
        .prepare(
          `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
           SELECT ?1, value ->> '$.id', value ->> '$.type', value ->> '$.item_key', value ->> '$.rank',
                  value ->> '$.fields', value ->> '$.rev', value ->> '$.created_at', ?2,
                  value ->> '$.created_by', value ->> '$.updated_by'
             FROM json_each(?3) WHERE true
           ON CONFLICT (plan_id, id) DO UPDATE SET type = excluded.type, rank = excluded.rank,
             fields = excluded.fields, rev = MAX(items.rev, excluded.rev) + 1, updated_at = excluded.updated_at,
             updated_by = excluded.updated_by`,
        )
        .bind(planId, now, chunk),
    ),
    db
      .prepare(
        `UPDATE plan SET item_types = ?2, items_rev = items_rev + 1,
           items_next_key = MAX(items_next_key, ?3), saved_at = MAX(saved_at, ?4)
         WHERE id = ?1`,
      )
      .bind(planId, copy.itemTypes, copy.itemsNextKey, now),
  ];
}

export function planSnapshotDoor(env: PlanEnv, planId: string): SnapshotDoor {
  return {
    exportFile: async () => {
      const file = await exportProjectFile(env, planId, null);
      if (file.status !== 'ok') return null;
      return typeof file.body === 'string' ? file.body : new TextDecoder().decode(file.body);
    },
    replaceContent: async (text) => {
      const now = Date.now();
      const read = readProjectFile(text, now, { keepIds: true });
      if (!read.ok) return read.failure === 'too_large' ? 'too_large' : 'invalid';
      const { copy } = read.content;
      await env.PLAN_DB.batch([
        ...sheetStatements(env, planId, copy, now),
        ...itemStatements(env, planId, copy, now),
      ]);
      await replaceTabs(
        env,
        planId,
        copy.tabs.map((t) => ({
          tab: {
            ...(JSON.parse(t.data) as Omit<Tab, 'id' | 'name'>),
            id: t.id,
            name: t.name,
          } as Tab,
          folder: t.folder,
        })),
        now,
      );
      return 'ok';
    },
    afterRevert: (generation) => env.SNAPSHOT_REVERTED?.(generation),
  };
}

// Editors of the whole plan: a tab-scoped link, a workbench embed and a Participant or Viewer see nothing, and an API
// token is refused before anything is read.
async function snapshotCaller(ctx: PlanRouteContext, planId: string): Promise<SnapshotCaller> {
  const owner = ctx.resolveOwner();
  const mayUse = owner !== null && !ctx.workbench && (await gateEdit(ctx, planId));
  return {
    token: ctx.token !== null,
    mayUse,
    person: mayUse && owner !== null ? await authorOf(ctx, owner) : null,
  };
}

// Every plan request the room answers passes here: `/api/projects/<id>/snapshots...` is answered, a write on the plan
// from before a revert is fenced, and the rest go on to `handle`.
export function servePlanSnapshots(
  ctx: PlanRouteContext,
  handle: () => Promise<Response>,
): Promise<Response> {
  const [api, collection, planId, ...rest] = ctx.segments;
  if (api !== 'api' || collection !== 'projects' || !planId) return handle();
  return serveSnapshots({
    db: ctx.env.PLAN_DB as unknown as SnapshotDb,
    itemId: planId,
    request: ctx.request,
    rest,
    caller: () => snapshotCaller(ctx, planId),
    door: () => planSnapshotDoor(ctx.env, planId),
    handle,
  });
}
