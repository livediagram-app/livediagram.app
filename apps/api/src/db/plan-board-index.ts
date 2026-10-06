// plan_board_statuses and the Activity page's Plan cards (docs/specs/013-workspace/activity-page.md §2.4).
//
// The table is a per-tab projection of each Plan board's column statuses, written by collabIndexStatements in
// the tab save's own batch (so every write path in §2.1 keeps it) and copied with a duplicated tab. The read
// finds the reader's open cards straight from the item store through the `items_assignee` expression index,
// using the table only to drop cards a board marks Done and to pick a board to open each one on.

import type { Element } from '@livediagram/document';
import type { ActivityCard } from '@livediagram/api-schema';
import { itemPersonId } from '@livediagram/items';
import { planBoardRowsFromElements } from '../collab-index/plan-board-rows';
import type { Env } from '../types';

// ---------- Writes ----------------------------------------------------

// A full replace of the tab's board rows. A tab with no board costs one DELETE that touches nothing (a
// primary-key prefix lookup).
export function planBoardIndexStatements(
  env: Env,
  tabId: string,
  elements: readonly Element[],
): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM plan_board_statuses WHERE tab_id = ?').bind(tabId),
  ];
  for (const r of planBoardRowsFromElements(elements)) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO plan_board_statuses
           (tab_id, element_id, board_title, status, done, board_order, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(tabId, r.elementId, r.boardTitle, r.status, r.done ? 1 : 0, r.boardOrder, r.position),
    );
  }
  return stmts;
}

export function planBoardIndexCopyStatement(
  env: Env,
  fromTabId: string,
  toTabId: string,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO plan_board_statuses
       (tab_id, element_id, board_title, status, done, board_order, position)
     SELECT ?1, element_id, board_title, status, done, board_order, position
       FROM plan_board_statuses WHERE tab_id = ?2`,
  ).bind(toTabId, fromTabId);
}

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

// Appended to the Activity read's scope CTEs (?1 owner, ?2 now, ?3 limit), with ?4 the JSON array of the
// reader's person ids. `cards` is every open card on the reader, in a document they can open; a tab-scoped
// share sees only what its tab's boards show, so there a board on that tab must hold the card (§4). `top` is
// the newest ?3 of them, and only those are placed: `board` is a board holding the card's status, then an All
// Cards board, then any board, by tab then board order (on a scoped share, the scoped tab's). Placing after
// the cut keeps the per-card board lookup to ?3 rows, however many cards match.
export const CARDS_CTES = `,
  mine(pid) AS (SELECT value FROM json_each(?4)),
  cards AS (
    SELECT i.document_id, i.id, i.item_key, i.type, i.updated_at,
           json_extract(i.fields, '$.title') AS title,
           json_extract(i.fields, '$.status') AS status,
           v.name AS document_name, v.team_id AS document_team_id, v.via, v.share_code,
           v.scope_tab_id
      FROM items i
      JOIN visible v ON v.id = i.document_id
     WHERE json_extract(i.fields, '$.assignee.id') IN (SELECT pid FROM mine)
       AND json_extract(i.fields, '$.archived') IS NOT 1
       AND json_extract(i.fields, '$.status') IS NOT 'trash'
       AND NOT EXISTS (
         SELECT 1 FROM document_tabs dt
           JOIN plan_board_statuses pb
             ON pb.tab_id = dt.tab_id AND pb.status = json_extract(i.fields, '$.status')
          WHERE dt.document_id = i.document_id AND pb.done = 1)
       AND (v.scope_tab_id IS NULL
            OR EXISTS (
              SELECT 1 FROM plan_board_statuses pb
               WHERE pb.tab_id = v.scope_tab_id
                 AND pb.status IN (json_extract(i.fields, '$.status'), '*')))
  ),
  top AS (SELECT * FROM cards ORDER BY updated_at DESC LIMIT ?3),
  placed AS (
    SELECT c.*,
           (SELECT json_object('tabId', p.tab_id, 'tabName', p.tab_name,
                               'elementId', p.element_id, 'title', p.board_title)
              FROM (SELECT pb.tab_id, t.name AS tab_name, pb.element_id, pb.board_title,
                           CASE WHEN pb.status = c.status THEN 0 WHEN pb.status = '*' THEN 1 ELSE 2 END
                             AS fit,
                           dt.order_index, pb.board_order, pb.position
                      FROM document_tabs dt
                      JOIN plan_board_statuses pb ON pb.tab_id = dt.tab_id
                      JOIN tabs t ON t.id = pb.tab_id
                     WHERE dt.document_id = c.document_id
                       AND (c.scope_tab_id IS NULL
                            OR (pb.tab_id = c.scope_tab_id
                                AND (pb.status = c.status OR pb.status = '*')))) p
             -- SQLite cannot read the outer row in a scalar subquery's ORDER BY, so the fit is ranked as a
             -- column of the derived table above.
             ORDER BY p.fit, p.order_index, p.board_order, p.position
             LIMIT 1) AS board
      FROM top c
  )`;

export const CARDS_SELECT = `
  SELECT document_id, id, item_key, type, updated_at, title, status,
         document_name, document_team_id, via, share_code, board
    FROM placed
   ORDER BY updated_at DESC`;

export type CardRow = {
  document_id: string;
  id: string;
  item_key: number;
  type: string;
  updated_at: number;
  title: string | null;
  status: string | null;
  document_name: string;
  document_team_id: string | null;
  via: 'own' | 'team' | 'shared';
  share_code: string | null;
  board: string | null;
};

// A 'shared' row whose link has lapsed has nowhere to go and is dropped, as the other kinds drop it.
export function cardsFromRows(rows: readonly CardRow[]): ActivityCard[] {
  const out: ActivityCard[] = [];
  for (const r of rows) {
    if (r.via === 'shared' && !r.share_code) continue;
    out.push({
      documentId: r.document_id,
      documentName: r.document_name,
      teamId: r.document_team_id,
      via: r.via,
      shareCode: r.via === 'shared' ? r.share_code : null,
      board: r.board ? (JSON.parse(r.board) as ActivityCard['board']) : null,
      id: r.id,
      key: r.item_key,
      type: r.type,
      title: typeof r.title === 'string' ? r.title : '',
      status: typeof r.status === 'string' ? r.status : null,
      updatedAt: r.updated_at,
    });
  }
  return out;
}
