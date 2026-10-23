// Explorer Home's reads (docs/specs/013-workspace/explorer-home.md; blueprint "Reads"). Each one
// scopes by the designs the person can open FIRST (VISIBLE_DESIGNS_CTES) and filters after.
//
// Binds shared by both: ?1 = the person's owner id, ?2 = now.

import {
  DAY_MS,
  HOME_OPENED_EVENT_TYPE,
  HOME_WITHIN_REACH_PER_ROW,
  windowStartOf,
  withinReach,
  type HomeDesign,
  type HomeJumpBackInItem,
  type WithinReach,
} from '@livedesign/api-schema';
import { WHAT_HAPPENED_EVENT_TYPES, type WhatHappenedRow } from '../home/what-happened';
import type { Env, ParticipantDTO } from '../types';
import { readParticipants } from '../accounts/profiles';
import { VISIBLE_DESIGNS_CTES } from './design-visibility';
import { firstTabCountSql, isEmptyCount } from './tabs';

// Where each design lives and what its thumbnail needs. A shared design's team and folder
// are the owner's filing, so they are not disclosed.
const PLACE_COLUMNS = `
  v.id AS design_id, v.name AS design_name, v.via, v.share_code, v.scope_tab_id,
  CASE WHEN v.via = 'shared' THEN NULL ELSE v.team_id END AS team_id,
  CASE WHEN v.via = 'shared' THEN NULL ELSE pt.name END AS team_name,
  CASE WHEN v.via = 'shared' THEN NULL ELSE v.folder_id END AS folder_id,
  CASE WHEN v.via = 'shared' THEN NULL ELSE pf.name END AS folder_name,
  v.owner_id, v.saved_at,
  ${firstTabCountSql('v.id', 'v.scope_tab_id')}`;

const PLACE_JOINS = `
  LEFT JOIN teams pt ON pt.id = v.team_id
  LEFT JOIN folders pf ON pf.id = v.folder_id`;

type PlaceRow = {
  design_id: string;
  design_name: string;
  via: HomeDesign['via'];
  share_code: string | null;
  scope_tab_id: string | null;
  team_id: string | null;
  team_name: string | null;
  folder_id: string | null;
  folder_name: string | null;
  owner_id: string;
  saved_at: number;
  first_tab_count: number | null;
};

// `people` holds the owners' liveworkspace profiles (accounts/profiles.ts), read once per page.
function placeOf(row: PlaceRow, people: ReadonlyMap<string, ParticipantDTO>): HomeDesign {
  return {
    designId: row.design_id,
    name: row.design_name,
    via: row.via,
    shareCode: row.via === 'shared' ? row.share_code : null,
    tabId: row.scope_tab_id,
    teamId: row.team_id,
    teamName: row.team_name,
    folderId: row.folder_id,
    folderName: row.folder_name,
    ownerName: people.get(row.owner_id)?.name ?? null,
    savedAt: row.saved_at,
    empty: isEmptyCount(row.first_tab_count),
  };
}

/** An event a real actor made: not the Timeline backfill's reconstructed edit, which may credit a
 *  teammate's save to the owner (docs/specs/013-workspace/timeline.md §5). On `e`. */
const REAL_EDIT = `json_extract(e.snapshot, '$.backfilled') IS NOT 1`;

/** A making that counts as a use of the design for its maker: a creation or a copy whose event
 *  says `markUsed` (docs/specs/013-workspace/explorer-home.md "Making a design"). Makings recorded
 *  before the mark, and every bulk import, carry none. On `e`. */
const MARKED_MAKING = `(e.event_type IN ('design_created', 'design_duplicated')
  AND json_extract(e.snapshot, '$.markUsed') IS 1)`;

// ---------- Jump back in ----------------------------------------------

type JumpBackInRow = PlaceRow & { use_days: number; last_used_at: number };

// Exported for the query-plan guard in home-plans.test.ts.
export const JUMP_BACK_IN_SQL = `WITH ${VISIBLE_DESIGNS_CTES},
     used AS (
       SELECT e.source_id AS design_id,
              COUNT(DISTINCT e.occurred_at / ${DAY_MS}) AS use_days,
              MAX(e.occurred_at) AS last_at
         FROM timeline_events e
        WHERE e.actor_id = ?1
          AND e.source_type = 'design'
          AND e.occurred_at >= ?3 AND e.occurred_at <= ?2
          AND (e.event_type = '${HOME_OPENED_EVENT_TYPE}'
               OR (e.event_type = 'design_edited' AND ${REAL_EDIT})
               OR ${MARKED_MAKING})
        GROUP BY e.source_id
     ),
     candidates(design_id) AS (
       SELECT design_id FROM used
       UNION
       SELECT design_id FROM design_opens WHERE owner_id = ?1
     ),
     reach AS (
       SELECT c.design_id,
              COALESCE(u.use_days, 0) AS use_days,
              MAX(COALESCE(u.last_at, 0), COALESCE(o.last_opened_at, 0)) AS last_used_at
         FROM candidates c
         JOIN visible v ON v.id = c.design_id
         LEFT JOIN used u ON u.design_id = c.design_id
         LEFT JOIN design_opens o ON o.owner_id = ?1 AND o.design_id = c.design_id
     ),
     picked(design_id) AS (
       SELECT design_id FROM (
         SELECT design_id FROM reach WHERE use_days > 0
          ORDER BY use_days DESC, last_used_at DESC, design_id ASC LIMIT ?4)
       UNION
       SELECT design_id FROM (
         SELECT design_id FROM reach
          ORDER BY last_used_at DESC, design_id ASC LIMIT ?5)
     )
     -- Unordered: rows are put in id order in JS (readJumpBackIn). An ORDER BY v.id here let the
     -- planner walk every design in the database in id order to meet the few picked.
     SELECT r.use_days, r.last_used_at, ${PLACE_COLUMNS}
       FROM picked p
       JOIN reach r ON r.design_id = p.design_id
       JOIN visible v ON v.id = p.design_id
       ${PLACE_JOINS}`;

/** The person's server-side Within reach set (blueprint "Jump back in"): use days are the UTC days
 *  in the window with an open, a real edit or a marked making by them; the last use is the latest of
 *  those and their last open. SQL narrows to the n most used and the 2n most recent (which by the merge
 *  property hold the whole set); `withinReach` then allocates exactly, over rows in id order. */
export async function readJumpBackIn(
  env: Env,
  personId: string,
  now: number,
  n: number = HOME_WITHIN_REACH_PER_ROW,
): Promise<WithinReach<HomeJumpBackInItem>> {
  const res = await env.DB.prepare(JUMP_BACK_IN_SQL)
    .bind(personId, now, windowStartOf(now), n, 2 * n)
    .all<JumpBackInRow>();
  const rows = (res.results ?? []).sort((a, b) =>
    a.design_id < b.design_id ? -1 : a.design_id > b.design_id ? 1 : 0,
  );
  const people = await readParticipants(
    env,
    rows.map((r) => r.owner_id),
  );
  const items = rows.map((r): HomeJumpBackInItem => ({
    ...placeOf(r, people),
    useDays: r.use_days,
    lastUsedAt: r.last_used_at,
  }));
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

// Exported for the query-plan guard in home-plans.test.ts.
export const WHAT_HAPPENED_SQL = `WITH me(id) AS (
       SELECT ?1
       UNION
       SELECT alias_id FROM owner_aliases WHERE owner_id = ?1
     ),
     ${VISIBLE_DESIGNS_CTES}
     SELECT e.id AS event_id, e.event_type, e.actor_id, e.occurred_at, e.description, e.snapshot,
            ${PLACE_COLUMNS}
       -- The reader's designs lead (CROSS JOIN fixes the order), so the scopes are sought by
       -- (scope_type, scope_id); led by scope_type alone, the read walked every design's events.
       FROM visible v
       CROSS JOIN timeline_event_scopes sc ON sc.scope_type = 'design' AND sc.scope_id = v.id
       JOIN timeline_events e ON e.id = sc.event_id
       ${PLACE_JOINS}
      WHERE v.scope_tab_id IS NULL
        AND e.event_type IN (${WHAT_HAPPENED_TYPES_SQL})
        AND e.occurred_at >= ?3 AND e.occurred_at <= ?2
        AND e.actor_id IS NOT NULL
        AND e.actor_id NOT IN (SELECT id FROM me)
      ORDER BY e.occurred_at DESC, e.id DESC
      LIMIT ?4`;

/** Other people's actions on the designs the person can open, newest first, from `since`. A
 *  tab-scoped share is left out: its actions name things on tabs the link does not reach. */
export async function readWhatHappenedRows(
  env: Env,
  personId: string,
  now: number,
  opts: { since: number; limit: number },
): Promise<WhatHappenedRow[]> {
  const res = await env.DB.prepare(WHAT_HAPPENED_SQL)
    .bind(personId, now, opts.since, opts.limit)
    .all<
      PlaceRow & {
        event_id: string;
        event_type: string;
        actor_id: string;
        occurred_at: number;
        description: string | null;
        snapshot: string;
      }
    >();
  const rows = res.results ?? [];
  // The owners' and the actors' names, in one batched read for the page.
  const people = await readParticipants(
    env,
    rows.flatMap((r) => [r.owner_id, r.actor_id]),
  );
  return rows.map((r) => ({
    eventId: r.event_id,
    eventType: r.event_type,
    actorId: r.actor_id,
    occurredAt: r.occurred_at,
    description: r.description,
    snapshot: parseSnapshot(r.snapshot),
    design: placeOf(r, people),
    actor: {
      name: people.get(r.actor_id)?.name ?? null,
      color: people.get(r.actor_id)?.color ?? null,
    },
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
