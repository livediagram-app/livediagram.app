// The plan-level reads and writes of a plan's own SQLite (docs/specs/015-api/api.md "Storage") that the
// projects module used to make against D1: the tab outline a project read carries, the type catalogue, the plan
// row a create makes, and a copy's export and import. Runs inside the plan's Durable Object, on `env.PLAN_DB`.
import { readItemTypeCatalogue, type ItemTypeCatalogue } from '@liveplanner/items';
import { rowToTabSummary, type TabRow } from '../tab-row';
import type { PlanEnv, TabSummaryDTO } from '../types';

export {
  COPY_PLAN,
  chunksOf,
  copiedThreads,
  exportPlanCopy,
  importPlanCopy,
  insertItemRowsStatements,
  readContentTabRows,
  remapTabDataLinks,
  resendPlanTab,
  sheetRefsOfData,
} from './plan-copy';
export type { ContentTabRow, PlanCopy } from './plan-copy';

// What the plan knows of itself (plan-schema.ts): its name, owner, team, provenance and creation intent. Null
// until the plan is started, by a create or by its first open with a grant (startPlan).
export type PlanMeta = {
  name: string;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  opensIn: string | null;
  tabKind: string | null;
  templateFamily: string | null;
  createdAt: number;
};

// What a project read takes from the plan: its tabs in order (no body), its type catalogue, and what it knows
// of itself.
export type PlanOutline = {
  tabs: TabSummaryDTO[];
  itemTypes: ItemTypeCatalogue | null;
  itemTypesRev: number;
  // The plan's last save.
  savedAt: number;
  meta: PlanMeta | null;
};

type PlanHeadRow = {
  item_types: string | null;
  item_types_rev: number;
  saved_at: number;
  created_at: number;
  name: string;
  owner_id: string;
  team_id: string | null;
  source: string | null;
  opens_in: string | null;
  tab_kind: string | null;
  template_family: string | null;
};

const PLAN_HEAD_COLS =
  'item_types, item_types_rev, saved_at, created_at, name, owner_id, team_id, source, opens_in, tab_kind, template_family';

function metaOf(head: PlanHeadRow | null): PlanMeta | null {
  if (!head || !head.created_at) return null;
  return {
    name: head.name,
    ownerId: head.owner_id,
    teamId: head.team_id,
    source: head.source,
    opensIn: head.opens_in,
    tabKind: head.tab_kind,
    templateFamily: head.template_family,
    createdAt: head.created_at,
  };
}

export async function readPlanOutline(env: PlanEnv, planId: string): Promise<PlanOutline> {
  const [tabs, plan] = await env.PLAN_DB.batch([
    env.PLAN_DB.prepare(
      `SELECT t.id, dt.plan_id, t.name, dt.order_index, '' AS data, t.updated_at, dt.folder, t.connection
         FROM plan_tabs dt
         JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.plan_id = ?
        ORDER BY dt.order_index ASC`,
    ).bind(planId),
    env.PLAN_DB.prepare(`SELECT ${PLAN_HEAD_COLS} FROM plan WHERE id = ?`).bind(planId),
  ]);
  const head = (plan?.results?.[0] ?? null) as PlanHeadRow | null;
  return {
    tabs: ((tabs?.results ?? []) as TabRow[]).map(rowToTabSummary),
    itemTypes: readItemTypeCatalogue(head?.item_types ?? null),
    itemTypesRev: head?.item_types_rev ?? 0,
    savedAt: head?.saved_at ?? 0,
    meta: metaOf(head),
  };
}

// The plan's tabs alone, in order: id, name and the kind each tab's last write kept beside it (tab_stats), so no
// tab's body is read, parsed or sent. For the tab picker's read (routes/projects.ts, `GET /api/projects/:id/tabs`).
export async function readPlanTabs(
  env: PlanEnv,
  planId: string,
): Promise<{ id: string; name: string; kind: string | null }[]> {
  const { results } = await env.PLAN_DB.prepare(
    `SELECT t.id, t.name, s.kind
       FROM plan_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
       LEFT JOIN tab_stats s ON s.tab_id = dt.tab_id
      WHERE dt.plan_id = ?
      ORDER BY dt.order_index ASC`,
  )
    .bind(planId)
    .all<{ id: string; name: string; kind: string | null }>();
  return results ?? [];
}

// What the plan knows of itself, alone (no tabs): for the doors that only need its owner or name.
export async function readPlanMeta(env: PlanEnv, planId: string): Promise<PlanMeta | null> {
  const head = await env.PLAN_DB.prepare(`SELECT ${PLAN_HEAD_COLS} FROM plan WHERE id = ?`)
    .bind(planId)
    .first<PlanHeadRow>();
  return metaOf(head ?? null);
}

// What the plan knows of itself, its last save and its type catalogue, in one read: the Drive file's head
// (project-file.ts), without the tab outline.
export async function readPlanHead(
  env: PlanEnv,
  planId: string,
): Promise<{ meta: PlanMeta | null; savedAt: number; itemTypes: ItemTypeCatalogue | null }> {
  const head = await env.PLAN_DB.prepare(`SELECT ${PLAN_HEAD_COLS} FROM plan WHERE id = ?`)
    .bind(planId)
    .first<PlanHeadRow>();
  return {
    meta: metaOf(head ?? null),
    savedAt: head?.saved_at ?? 0,
    itemTypes: readItemTypeCatalogue(head?.item_types ?? null),
  };
}

// What a create or a first open writes about the plan (startPlan, upsertPlanMeta). A started plan keeps its
// owner, team, provenance and intent; only its name and last save move after.
export type PlanStart = {
  name: string;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  opensIn: string | null;
  tabKind: string | null;
  templateFamily: string | null;
  savedAt: number;
  createdAt: number;
  itemTypes?: ItemTypeCatalogue | null;
};

// Start the plan (docs/specs/015-api/api.md "Storage"), or on a plan already started rename it and move its
// last save. On a genuine start the type catalogue the create carries goes in too
// (docs/specs/026-plan/item-types.md "Storage and sync"); a started plan keeps its catalogue.
export async function initPlan(env: PlanEnv, planId: string, d: PlanStart): Promise<void> {
  await env.PLAN_DB.prepare(
    `INSERT INTO plan (id, item_types, saved_at, created_at, name, owner_id, team_id, source, opens_in, tab_kind,
                       template_family)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     ON CONFLICT (id) DO UPDATE SET
       item_types = CASE WHEN plan.created_at = 0 THEN COALESCE(plan.item_types, excluded.item_types)
                         ELSE plan.item_types END,
       saved_at = excluded.saved_at,
       name = excluded.name,
       created_at = CASE WHEN plan.created_at = 0 THEN excluded.created_at ELSE plan.created_at END,
       owner_id = CASE WHEN plan.created_at = 0 THEN excluded.owner_id ELSE plan.owner_id END,
       team_id = CASE WHEN plan.created_at = 0 THEN excluded.team_id ELSE plan.team_id END,
       source = CASE WHEN plan.created_at = 0 THEN excluded.source ELSE plan.source END,
       opens_in = CASE WHEN plan.created_at = 0 THEN excluded.opens_in ELSE plan.opens_in END,
       tab_kind = CASE WHEN plan.created_at = 0 THEN excluded.tab_kind ELSE plan.tab_kind END,
       template_family = CASE WHEN plan.created_at = 0 THEN excluded.template_family
                              ELSE plan.template_family END`,
  )
    .bind(
      planId,
      d.itemTypes ? JSON.stringify(d.itemTypes) : null,
      d.savedAt,
      d.createdAt,
      d.name,
      d.ownerId,
      d.teamId,
      d.source,
      d.opensIn,
      d.tabKind,
      d.templateFamily,
    )
    .run();
}

// A rename (and its save time) on a started plan; false when the plan is not started.
export async function renamePlan(
  env: PlanEnv,
  planId: string,
  name: string,
  savedAt: number,
): Promise<boolean> {
  const res = await env.PLAN_DB.prepare(
    'UPDATE plan SET name = ?, saved_at = ? WHERE id = ? AND created_at > 0',
  )
    .bind(name, savedAt, planId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// docs/specs/014-identity/transactional-email.md (#1) throttle: claim the right to email the owner about a new
// comment, at most once per window. One conditional UPDATE, so a burst of comment saves can't each fire one.
export async function claimCommentNotify(
  env: PlanEnv,
  planId: string,
  now: number,
  cutoff: number,
): Promise<boolean> {
  const res = await env.PLAN_DB.prepare(
    'UPDATE plan SET comment_notified_at = ? WHERE id = ? AND (comment_notified_at IS NULL OR comment_notified_at < ?)',
  )
    .bind(now, planId, cutoff)
    .run();
  return res.meta.changes === 1;
}

// A plan's card types alone, for a snapshot that draws its cards. Null for a plan with no catalogue.
export async function getPlanItemTypes(
  env: PlanEnv,
  planId: string,
): Promise<ItemTypeCatalogue | null> {
  const row = await env.PLAN_DB.prepare('SELECT item_types FROM plan WHERE id = ?')
    .bind(planId)
    .first<{ item_types: string | null }>();
  return readItemTypeCatalogue(row?.item_types ?? null);
}

// Type catalogue write (docs/specs/026-plan/item-types.md "Storage and sync"): its own statement, so no meta save
// can rewrite it. `itemTypes` is already validated; null puts back the default types. Raises the catalogue's
// revision; with `expectedRev` it lands only while the stored revision is that one. Returns the new revision, or
// null when the stored one had moved on.
export async function setPlanItemTypes(
  env: PlanEnv,
  planId: string,
  itemTypes: ItemTypeCatalogue | null,
  expectedRev?: number,
): Promise<number | null> {
  const row = await env.PLAN_DB.prepare(
    `UPDATE plan SET item_types = ?, item_types_rev = item_types_rev + 1, saved_at = ?
      WHERE id = ? AND (? IS NULL OR item_types_rev = ?) RETURNING item_types_rev`,
  )
    .bind(
      itemTypes ? JSON.stringify(itemTypes) : null,
      Date.now(),
      planId,
      expectedRev ?? null,
      expectedRev ?? null,
    )
    .first<{ item_types_rev: number }>();
  return row?.item_types_rev ?? null;
}
