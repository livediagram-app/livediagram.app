// Explorer Home's reads (docs/specs/013-workspace/explorer-home.md; blueprint "Reads"). Each one
// scopes by the documents the person can open FIRST (VISIBLE_DOCUMENTS_CTES) and filters after.
//
// Binds shared by both: ?1 = the person's owner id, ?2 = now.

import {
  HOME_OPENED_EVENT_TYPE,
  HOME_WITHIN_REACH_PER_ROW,
  useWindowStart,
  withinReach,
  type HomeDocument,
  type HomeJumpBackInItem,
  type WithinReach,
} from '@livediagram/api-schema';
import { WHAT_HAPPENED_EVENT_TYPES, type WhatHappenedRow } from '../home/what-happened';
import type { Env } from '../types';
import { VISIBLE_DOCUMENTS_CTES } from './document-visibility';
import { firstTabCountSql, isEmptyCount } from './tabs';

// Where each document lives and what its thumbnail needs. A shared document's team and folder
// are the owner's filing, so they are not disclosed.
const PLACE_COLUMNS = `
  v.id AS document_id, v.name AS document_name, v.via, v.share_code, v.scope_tab_id,
  CASE WHEN v.via = 'shared' THEN NULL ELSE v.team_id END AS team_id,
  CASE WHEN v.via = 'shared' THEN NULL ELSE pt.name END AS team_name,
  CASE WHEN v.via = 'shared' THEN NULL ELSE v.folder_id END AS folder_id,
  CASE WHEN v.via = 'shared' THEN NULL ELSE pf.name END AS folder_name,
  po.name AS owner_name, v.saved_at,
  ${firstTabCountSql('v.id', 'v.scope_tab_id')}`;

const PLACE_JOINS = `
  LEFT JOIN teams pt ON pt.id = v.team_id
  LEFT JOIN folders pf ON pf.id = v.folder_id
  LEFT JOIN participants po ON po.id = v.owner_id`;

type PlaceRow = {
  document_id: string;
  document_name: string;
  via: HomeDocument['via'];
  share_code: string | null;
  scope_tab_id: string | null;
  team_id: string | null;
  team_name: string | null;
  folder_id: string | null;
  folder_name: string | null;
  owner_name: string | null;
  saved_at: number;
  first_tab_count: number | null;
};

function placeOf(row: PlaceRow): HomeDocument {
  return {
    documentId: row.document_id,
    name: row.document_name,
    via: row.via,
    shareCode: row.via === 'shared' ? row.share_code : null,
    tabId: row.scope_tab_id,
    teamId: row.team_id,
    teamName: row.team_name,
    folderId: row.folder_id,
    folderName: row.folder_name,
    ownerName: row.owner_name,
    savedAt: row.saved_at,
    empty: isEmptyCount(row.first_tab_count),
  };
}

/** An event a real actor made: not the Timeline backfill's reconstructed edit, which may credit a
 *  teammate's save to the owner (docs/specs/013-workspace/timeline.md §5). On `e`. */
export const REAL_EDIT = `json_extract(e.snapshot, '$.backfilled') IS NOT 1`;

// ---------- Jump back in ----------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

type JumpBackInRow = PlaceRow & { use_days: number; last_used_at: number };

/** The person's server-side Within reach set (blueprint "Jump back in"): use days are the UTC days
 *  in the window with an open or a real edit by them; the last use is the later of their last open
 *  and last real edit. SQL narrows to the n most used and the 2n most recent (which by the merge
 *  property hold the whole set); `withinReach` then allocates exactly, over rows in id order. */
export async function readJumpBackIn(
  env: Env,
  personId: string,
  now: number,
  n: number = HOME_WITHIN_REACH_PER_ROW,
): Promise<WithinReach<HomeJumpBackInItem>> {
  const res = await env.DB.prepare(
    `WITH ${VISIBLE_DOCUMENTS_CTES},
     used AS (
       SELECT e.source_id AS document_id,
              COUNT(DISTINCT e.occurred_at / ${DAY_MS}) AS use_days,
              MAX(e.occurred_at) AS last_at
         FROM timeline_events e
        WHERE e.actor_id = ?1
          AND e.source_type = 'document'
          AND e.occurred_at >= ?3 AND e.occurred_at <= ?2
          AND (e.event_type = '${HOME_OPENED_EVENT_TYPE}'
               OR (e.event_type = 'document_edited' AND ${REAL_EDIT}))
        GROUP BY e.source_id
     ),
     candidates(document_id) AS (
       SELECT document_id FROM used
       UNION
       SELECT document_id FROM document_opens WHERE owner_id = ?1
     ),
     reach AS (
       SELECT c.document_id,
              COALESCE(u.use_days, 0) AS use_days,
              MAX(COALESCE(u.last_at, 0), COALESCE(o.last_opened_at, 0)) AS last_used_at
         FROM candidates c
         JOIN visible v ON v.id = c.document_id
         LEFT JOIN used u ON u.document_id = c.document_id
         LEFT JOIN document_opens o ON o.owner_id = ?1 AND o.document_id = c.document_id
     ),
     picked(document_id) AS (
       SELECT document_id FROM (
         SELECT document_id FROM reach WHERE use_days > 0
          ORDER BY use_days DESC, last_used_at DESC, document_id ASC LIMIT ?4)
       UNION
       SELECT document_id FROM (
         SELECT document_id FROM reach
          ORDER BY last_used_at DESC, document_id ASC LIMIT ?5)
     )
     SELECT r.use_days, r.last_used_at, ${PLACE_COLUMNS}
       FROM picked p
       JOIN reach r ON r.document_id = p.document_id
       JOIN visible v ON v.id = p.document_id
       ${PLACE_JOINS}
      ORDER BY v.id ASC`,
  )
    .bind(personId, now, useWindowStart(now), n, 2 * n)
    .all<JumpBackInRow>();
  const items = (res.results ?? []).map(
    (r): HomeJumpBackInItem => ({
      ...placeOf(r),
      useDays: r.use_days,
      lastUsedAt: r.last_used_at,
    }),
  );
  return withinReach(items, n, (d) => ({ uses: d.useDays, lastUsedAt: d.lastUsedAt }));
}

// ---------- What happened ---------------------------------------------

const WHAT_HAPPENED_TYPES_SQL = WHAT_HAPPENED_EVENT_TYPES.map((t) => `'${t}'`).join(', ');

/** The person's id and every identity they used to be. */
export async function readMe(env: Env, personId: string): Promise<Set<string>> {
  const res = await env.DB.prepare('SELECT alias_id FROM owner_aliases WHERE owner_id = ?1')
    .bind(personId)
    .all<{ alias_id: string }>();
  return new Set([personId, ...(res.results ?? []).map((r) => r.alias_id)]);
}

/** Other people's actions on the documents the person can open, newest first, from `since`. A
 *  tab-scoped share is left out: its actions name things on tabs the link does not reach. */
export async function readWhatHappenedRows(
  env: Env,
  personId: string,
  now: number,
  opts: { since: number; limit: number },
): Promise<WhatHappenedRow[]> {
  const res = await env.DB.prepare(
    `WITH me(id) AS (
       SELECT ?1
       UNION
       SELECT alias_id FROM owner_aliases WHERE owner_id = ?1
     ),
     ${VISIBLE_DOCUMENTS_CTES}
     SELECT e.id AS event_id, e.event_type, e.actor_id, e.occurred_at, e.description, e.snapshot,
            ap.name AS actor_name, ap.color AS actor_color, ap.picture_url AS actor_picture,
            ${PLACE_COLUMNS}
       FROM visible v
       JOIN timeline_event_scopes sc ON sc.scope_type = 'document' AND sc.scope_id = v.id
       JOIN timeline_events e ON e.id = sc.event_id
       LEFT JOIN participants ap ON ap.id = e.actor_id
       ${PLACE_JOINS}
      WHERE v.scope_tab_id IS NULL
        AND e.event_type IN (${WHAT_HAPPENED_TYPES_SQL})
        AND e.occurred_at >= ?3 AND e.occurred_at <= ?2
        AND e.actor_id IS NOT NULL
        AND e.actor_id NOT IN (SELECT id FROM me)
      ORDER BY e.occurred_at DESC, e.id DESC
      LIMIT ?4`,
  )
    .bind(personId, now, opts.since, opts.limit)
    .all<
      PlaceRow & {
        event_id: string;
        event_type: string;
        actor_id: string;
        occurred_at: number;
        description: string | null;
        snapshot: string;
        actor_name: string | null;
        actor_color: string | null;
        actor_picture: string | null;
      }
    >();
  return (res.results ?? []).map((r) => ({
    eventId: r.event_id,
    eventType: r.event_type,
    actorId: r.actor_id,
    occurredAt: r.occurred_at,
    description: r.description,
    snapshot: parseSnapshot(r.snapshot),
    document: placeOf(r),
    actor: { name: r.actor_name, color: r.actor_color, pictureUrl: r.actor_picture },
  }));
}

// A snapshot a future worker wrote in a shape this one cannot parse still has a verb: the
// event type carries the meaning, the snapshot only enriches it.
function parseSnapshot(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
