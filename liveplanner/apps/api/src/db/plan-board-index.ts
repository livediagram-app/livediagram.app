// plan_board_statuses and the Inbox's Plan cards (docs/specs/013-workspace/inbox.md §2.4).
//
// Both tables are pushed by each plan's Durable Object (plan-room/plan-outbox.ts): `plan_board_statuses` a
// per-tab projection of each Plan board's column statuses (with the tab's name and order), `plan_cards` the cards
// the Inbox can list (assigned to someone, or holding comments), with only the fields it reads. The read finds
// the reader's open cards through the `plan_cards_assignee` expression index, using the board table only to drop
// cards a board marks Done and to pick a board to open each one on.

import type { ActivityCard } from '@liveplanner/api-schema';
import { itemPersonId } from '@liveplanner/items';
import type { Env } from '../types';

// ---------- Read ------------------------------------------------------

// The hashed person ids of the reader and every identity they used to be (§2.2): what an item's assignee id
// is (docs/specs/026-plan/blueprints/item-store.md "Security and trust").
export async function readerPersonIds(env: Env, ownerId: string): Promise<string[]> {
  const res = await env.DB.prepare('SELECT alias_id FROM owner_aliases WHERE owner_id = ?')
    .bind(ownerId)
    .all<{ alias_id: string }>();
  const ids = [ownerId, ...(res.results ?? []).map((r) => r.alias_id)];
  return Promise.all(ids.map((id) => itemPersonId(id)));
}

// Placing items on the Inbox (§2.4, §2.5): a `cards` CTE of the matching items in projects the reader can
// open, `top` the newest ?3 of them by `order` (only rows passing `keep`), and `placed` each with the board that
// shows it. `match` filters the items (it may read `i`, `v` and the read's own CTEs); `cols` adds columns to
// `cards`. A tab-scoped share sees only what its tab's boards show, so there a board on that tab must hold the
// item (§4). The board is one holding the item's status, then an All Cards board, then any board, by tab then
// board order (on a scoped share, the scoped tab's). Placing after the cut keeps the per-item board lookup to ?3
// rows, however many items match.
export function itemPlacementCtes(spec: {
  match: string;
  cols?: string;
  keep?: string;
  order: string;
}): string {
  return `,
  cards AS (
    SELECT i.project_id, i.id, i.item_key, i.type, i.updated_at,
           json_extract(i.fields, '$.title') AS title,
           json_extract(i.fields, '$.status') AS status,
           v.name AS project_name, v.team_id AS project_team_id, v.via, v.share_code,
           v.scope_tab_id${
             spec.cols
               ? `,
           ${spec.cols}`
               : ''
           }
      FROM plan_cards i
      JOIN visible v ON v.id = i.project_id
     WHERE ${spec.match}
       AND (v.scope_tab_id IS NULL
            OR EXISTS (
              SELECT 1 FROM plan_board_statuses pb
               WHERE pb.project_id = i.project_id AND pb.tab_id = v.scope_tab_id
                 AND pb.status IN (json_extract(i.fields, '$.status'), '*')))
  ),
  top AS (SELECT * FROM cards${spec.keep ? ` WHERE ${spec.keep}` : ''} ORDER BY ${spec.order} DESC LIMIT ?3),
  placed AS (
    SELECT c.*,
           (SELECT json_object('tabId', p.tab_id, 'tabName', p.tab_name,
                               'elementId', p.element_id, 'title', p.board_title)
              FROM (SELECT pb.tab_id, pb.tab_name, pb.element_id, pb.board_title,
                           CASE WHEN pb.status = c.status THEN 0 WHEN pb.status = '*' THEN 1 ELSE 2 END
                             AS fit,
                           pb.tab_order AS order_index, pb.board_order, pb.position
                      FROM plan_board_statuses pb
                     WHERE pb.project_id = c.project_id
                       AND (c.scope_tab_id IS NULL
                            OR (pb.tab_id = c.scope_tab_id
                                AND (pb.status = c.status OR pb.status = '*')))) p
             -- SQLite cannot read the outer row in a scalar subquery's ORDER BY, so the fit is ranked as a
             -- column of the derived table above.
             ORDER BY p.fit, p.order_index, p.board_order, p.position
             LIMIT 1) AS board
      FROM top c
  )`;
}

// Appended to the Activity read's scope CTEs (?1 owner, ?2 now, ?3 limit), with ?4 the JSON array of the
// reader's person ids. `cards` is every open card on the reader: assigned to them, not archived, not in the
// Trash, and in no column a board marks Done.
export const CARDS_CTES = `,
  mine(pid) AS (SELECT value FROM json_each(?4))${itemPlacementCtes({
    match: `json_extract(i.fields, '$.assignee.id') IN (SELECT pid FROM mine)
       AND json_extract(i.fields, '$.archived') IS NOT 1
       AND json_extract(i.fields, '$.status') IS NOT 'trash'
       -- A linked card's action is listed already (docs/specs/026-plan/linked-boards.md "The Inbox").
       AND json_extract(i.fields, '$.linked') IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM plan_board_statuses pb
          WHERE pb.project_id = i.project_id AND pb.status = json_extract(i.fields, '$.status')
            AND pb.done = 1)`,
    order: 'updated_at',
  })}`;

export const CARDS_SELECT = `
  SELECT project_id, id, item_key, type, updated_at, title, status,
         project_name, project_team_id, via, share_code, board
    FROM placed
   ORDER BY updated_at DESC`;

export type CardRow = {
  project_id: string;
  id: string;
  item_key: number;
  type: string;
  updated_at: number;
  title: string | null;
  status: string | null;
  project_name: string;
  project_team_id: string | null;
  via: 'own' | 'team' | 'shared';
  share_code: string | null;
  board: string | null;
};

// A 'shared' row whose link has lapsed never arrives: `visible` (project-visibility.ts) drops it.
export function cardsFromRows(rows: readonly CardRow[]): ActivityCard[] {
  return rows.map((r) => ({
    projectId: r.project_id,
    projectName: r.project_name,
    teamId: r.project_team_id,
    via: r.via,
    shareCode: r.via === 'shared' ? r.share_code : null,
    board: r.board ? (JSON.parse(r.board) as ActivityCard['board']) : null,
    id: r.id,
    key: r.item_key,
    type: r.type,
    title: typeof r.title === 'string' ? r.title : '',
    status: typeof r.status === 'string' ? r.status : null,
    updatedAt: r.updated_at,
  }));
}
