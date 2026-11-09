// The team audit log (liveworkspace/docs/specs/004-index/team-audit-log.md): what a team's admins can look back on, kept
// a year. Append-only: every statement here is an `INSERT OR IGNORE` keyed by (team, event id), so an event sent
// again, or one that moves its time on, adds nothing.
//
// Writing. Each statement goes in the batch that makes the change, after the Timeline event it copies (the event's
// id, kind, app, actor, title, detail and time are read back from `timeline_events`, so the two never disagree):
// - a team item's event (`itemAuditStatement`, from timeline.ts eventStatements): for the item's team, or for the
//   teams a move names (the one it left and the one it went to);
// - accounts' team events (`accountAuditStatement`, from bulkEventStatements): for each `t:<team>` scope named;
// - with no Timeline event of their own: a team item deleted for good (`deletedAuditStatement`, purge.ts) and a team
//   webhook added or removed (`webhookAuditStatement`, webhooks/routes.ts).
// Each is one statement whatever the count, through an index lookup, so logging never slows what it logs.
//
// Keeping. The daily run deletes rows past TEAM_AUDIT_RETENTION_MS, at most TEAM_AUDIT_SWEEP_MAX, the oldest first
// (`sweepTeamAudit`). Closing an account anonymises its rows (`teamAuditPurgeStatements`, account-purge.ts).

import {
  TEAM_AUDIT_ACCOUNT_TYPES,
  TEAM_AUDIT_ITEM_TYPES,
  TEAM_AUDIT_RETENTION_MS,
  TIMELINE_PLATFORM,
  type TeamAuditEventType,
  type TimelineEventType,
} from '@liveworkspace/index-client';
import type { Env } from './env';

type Db = D1Database;

// Rows the daily run deletes, at most.
export const TEAM_AUDIT_SWEEP_MAX = 5000;

const COLUMNS =
  'team_id, id, type, app, actor_id, actor_name, subject_id, item_id, title, detail, occurred_at';
// From the Timeline event `e` (the team's id selected first, as `team_id`).
const FROM_EVENT = `e.id, e.type, e.app, e.actor_id, e.actor_name,
  json_extract(e.detail, '$.personId'), e.item_id, e.title, e.detail, e.occurred_at`;

const itemTypes: ReadonlySet<string> = new Set(TEAM_AUDIT_ITEM_TYPES);
const accountTypes: ReadonlySet<string> = new Set(TEAM_AUDIT_ACCOUNT_TYPES);

/** Whether an item's Timeline event of this kind is logged for its team. */
export const isAuditedItemEvent = (type: TimelineEventType): boolean => itemTypes.has(type);

/**
 * The statement logging one item's Timeline event (already written in the batch, by id): for the item's team, or,
 * given `teams`, for those (a move's: the team it left and the one it went to). None when no team is involved.
 */
export function itemAuditStatement(
  db: Db,
  eventId: string,
  teams?: readonly (string | null)[],
): D1PreparedStatement | null {
  if (teams === undefined) {
    return db
      .prepare(
        `INSERT OR IGNORE INTO team_audit_events (${COLUMNS})
         SELECT i.team_id, ${FROM_EVENT}
         FROM timeline_events e JOIN items i ON i.id = e.item_id
         WHERE e.id = ? AND i.team_id IS NOT NULL`,
      )
      .bind(eventId);
  }
  const named = [...new Set(teams.filter((t): t is string => t !== null))];
  if (named.length === 0) return null;
  return db
    .prepare(
      `INSERT OR IGNORE INTO team_audit_events (${COLUMNS})
       SELECT t.value, ${FROM_EVENT}
       FROM json_each(?) t JOIN timeline_events e ON e.id = ?`,
    )
    .bind(JSON.stringify(named), eventId);
}

/**
 * The statement logging accounts' team events (written in the batch by bulkEventStatements) for each team scope
 * they name; a token's event, or a team's deletion, names none that counts. None when nothing in the batch does.
 */
export function accountAuditStatement(
  db: Db,
  events: readonly { id: string; type: TimelineEventType; scopes: readonly string[] }[],
): D1PreparedStatement | null {
  const pairs = events
    .filter((e) => accountTypes.has(e.type))
    .flatMap((e) =>
      [...new Set(e.scopes)].filter((s) => s.startsWith('t:')).map((s) => [s.slice(2), e.id]),
    );
  if (pairs.length === 0) return null;
  return db
    .prepare(
      `INSERT OR IGNORE INTO team_audit_events (${COLUMNS})
       SELECT json_extract(p.value, '$[0]'), ${FROM_EVENT}
       FROM json_each(?) p JOIN timeline_events e ON e.id = json_extract(p.value, '$[1]')`,
    )
    .bind(JSON.stringify(pairs));
}

/**
 * The statement logging team items deleted for good, for the batch that deletes their rows (before the delete):
 * each of `ids` that is in a team, its name then. A personal item logs nothing.
 */
export function deletedAuditStatement(
  db: Db,
  ids: readonly string[],
  actorId: string | null,
  at: number,
  detail: Record<string, string> | null = null,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO team_audit_events (${COLUMNS})
       SELECT team_id, 'del:' || id || ':' || ?, 'deleted', app, ?, NULL, NULL, id, title, ?, ?
       FROM items WHERE id IN (SELECT value FROM json_each(?)) AND team_id IS NOT NULL`,
    )
    .bind(at, actorId, detail ? JSON.stringify(detail) : null, at, JSON.stringify(ids));
}

export type WebhookAudit = {
  type: Extract<TeamAuditEventType, 'webhook_added' | 'webhook_removed'>;
  teamId: string;
  webhookId: string;
  name: string;
  kind: string;
  host: string;
  actorId: string;
  at: number;
};

/** The statement logging a team webhook added or removed, after the write in its batch that adds or deletes it. An
 *  add is logged only when the webhook is there: its insert is refused at the document's cap (webhooks/routes.ts). */
export function webhookAuditStatement(db: Db, audit: WebhookAudit): D1PreparedStatement {
  const added = audit.type === 'webhook_added';
  const id = `${added ? 'wh+' : 'wh-'}:${audit.webhookId}`;
  return db
    .prepare(
      `INSERT OR IGNORE INTO team_audit_events (${COLUMNS})
       SELECT ?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, ?6, ?7, ?8
       WHERE ?9 = 0 OR EXISTS (SELECT 1 FROM webhooks WHERE id = ?10)`,
    )
    .bind(
      audit.teamId,
      id,
      audit.type,
      TIMELINE_PLATFORM,
      audit.actorId,
      audit.name,
      JSON.stringify({ webhookId: audit.webhookId, kind: audit.kind, host: audit.host }),
      audit.at,
      added ? 1 : 0,
      audit.webhookId,
    );
}

/** The daily run: rows past the year go, at most TEAM_AUDIT_SWEEP_MAX, the oldest first. Returns how many. */
export async function sweepTeamAudit(
  env: Env,
  now = Date.now(),
  max = TEAM_AUDIT_SWEEP_MAX,
): Promise<number> {
  const result = await env.INDEX_DB.prepare(
    `DELETE FROM team_audit_events WHERE rowid IN (
       SELECT rowid FROM team_audit_events WHERE occurred_at < ? ORDER BY occurred_at LIMIT ?)`,
  )
    .bind(now - TEAM_AUDIT_RETENTION_MS, max)
    .run();
  return result.meta.changes ?? 0;
}

/**
 * Closing an account (account-purge.ts), each one chunked statement run until it changes fewer than `chunk` rows:
 * the log of each team that closed with them goes; where they acted, the actor becomes `anonymised` with no name;
 * where a team event is about them, its person becomes `anonymised` and their name leaves the detail.
 */
export function teamAuditPurgeStatements(
  db: Db,
  person: string,
  teams: string,
  anonymised: string,
  chunk: number,
): (() => D1PreparedStatement)[] {
  return [
    () =>
      db
        .prepare(
          `DELETE FROM team_audit_events WHERE rowid IN (
             SELECT rowid FROM team_audit_events
             WHERE team_id IN (SELECT value FROM json_each(?)) LIMIT ?)`,
        )
        .bind(teams, chunk),
    () =>
      db
        .prepare(
          `UPDATE team_audit_events SET actor_id = ?, actor_name = NULL WHERE rowid IN (
             SELECT rowid FROM team_audit_events WHERE actor_id = ? LIMIT ?)`,
        )
        .bind(anonymised, person, chunk),
    () =>
      db
        .prepare(
          `UPDATE team_audit_events SET subject_id = ?,
             detail = json_set(detail, '$.personId', ?, '$.memberName', NULL)
           WHERE rowid IN (SELECT rowid FROM team_audit_events WHERE subject_id = ? LIMIT ?)`,
        )
        .bind(anonymised, anonymised, person, chunk),
  ];
}
