// Explorer Home's reads (docs/specs/013-workspace/explorer-home.md; blueprint "Reads"). Each one
// scopes by the documents the person can open FIRST (VISIBLE_DOCUMENTS_CTES) and filters after.
//
// Binds shared by all three: ?1 = the person's owner id, ?2 = now.

import {
  HOME_OPENED_EVENT_TYPE,
  type HomeDocument,
  type HomeJumpBackInItem,
  type HomeTimelineEntry,
  type HomeTimelineKind,
  type HomeTimelinePage,
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

// ---------- Jump back in ----------------------------------------------

/** The person's documents, strongest frecency first. The key orders as the score does at every
 *  instant, so the rank index answers in order. */
export async function readJumpBackIn(
  env: Env,
  personId: string,
  now: number,
  limit: number,
): Promise<HomeJumpBackInItem[]> {
  const res = await env.DB.prepare(
    `WITH ${VISIBLE_DOCUMENTS_CTES}
     SELECT o.open_days, o.last_opened_at, ${PLACE_COLUMNS}
       FROM document_opens o
       JOIN visible v ON v.id = o.document_id
       ${PLACE_JOINS}
      WHERE o.owner_id = ?1
      ORDER BY o.frecency_key DESC, o.document_id ASC
      LIMIT ?3`,
  )
    .bind(personId, now, limit)
    .all<PlaceRow & { open_days: number; last_opened_at: number }>();
  return (res.results ?? []).map((r) => ({
    ...placeOf(r),
    lastOpenedAt: r.last_opened_at,
    openDays: r.open_days,
  }));
}

// ---------- Timeline --------------------------------------------------

/** An event a real actor made: not the Timeline backfill's reconstructed edit, which may credit a
 *  teammate's save to the owner (docs/specs/013-workspace/timeline.md §5). On `e`. */
export const REAL_EDIT = `json_extract(e.snapshot, '$.backfilled') IS NOT 1`;

const KIND_OF: Record<string, HomeTimelineKind> = {
  document_created: 'created',
  // A duplicate is a document the person created (spec).
  document_duplicated: 'created',
  document_edited: 'updated',
  [HOME_OPENED_EVENT_TYPE]: 'opened',
};

const TIMELINE_EVENT_TYPES_SQL = Object.keys(KIND_OF)
  .map((t) => `'${t}'`)
  .join(', ');

export type HomeCursor = { occurredAt: number; id: string };

/** `<occurredAt>:<id>`, or null when it is not one. */
export function parseHomeCursor(raw: string): HomeCursor | null {
  const at = raw.indexOf(':');
  if (at <= 0) return null;
  const occurredAt = Number(raw.slice(0, at));
  const id = raw.slice(at + 1);
  if (!Number.isFinite(occurredAt) || !id) return null;
  return { occurredAt, id };
}

/** One page of the person's own created / updated / opened events, newest first, on documents
 *  they can still open. Keyset on (occurred_at, id): the column grows at the head while it is
 *  read, and an offset would skip or repeat. */
export async function readHomeTimeline(
  env: Env,
  personId: string,
  now: number,
  opts: { limit: number; cursor: HomeCursor | null },
): Promise<HomeTimelinePage> {
  const binds: unknown[] = [personId, now, opts.limit + 1];
  let keyset = '';
  if (opts.cursor) {
    binds.push(opts.cursor.occurredAt, opts.cursor.id);
    keyset = 'AND (e.occurred_at < ?4 OR (e.occurred_at = ?4 AND e.id < ?5))';
  }
  const res = await env.DB.prepare(
    `WITH ${VISIBLE_DOCUMENTS_CTES}
     SELECT e.id AS event_id, e.event_type, e.occurred_at, ${PLACE_COLUMNS}
       FROM timeline_events e
       JOIN visible v ON v.id = e.source_id
       ${PLACE_JOINS}
      WHERE e.actor_id = ?1
        AND e.source_type = 'document'
        AND e.event_type IN (${TIMELINE_EVENT_TYPES_SQL})
        AND e.occurred_at <= ?2
        AND ${REAL_EDIT}
        ${keyset}
      ORDER BY e.occurred_at DESC, e.id DESC
      LIMIT ?3`,
  )
    .bind(...binds)
    .all<PlaceRow & { event_id: string; event_type: string; occurred_at: number }>();
  const rows = res.results ?? [];
  const page = rows.slice(0, opts.limit);
  const last = page[page.length - 1];
  const items: HomeTimelineEntry[] = page.map((r) => ({
    ...placeOf(r),
    id: r.event_id,
    kind: KIND_OF[r.event_type]!,
    occurredAt: r.occurred_at,
  }));
  return {
    items,
    nextCursor: rows.length > opts.limit && last ? `${last.occurred_at}:${last.event_id}` : null,
  };
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
