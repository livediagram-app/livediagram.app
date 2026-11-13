// The team audit log (liveworkspace/docs/specs/004-index/team-audit-log.md): what a team's admins can look back on, kept
// a year. Append-only: every statement here is an `INSERT OR IGNORE` keyed by (team, event id), so an event sent
// again, or one that moves its time on, adds nothing.
//
// Writing. Each statement goes in the batch that makes the change, after the event it copies (the event's
// id, kind, app, actor, title, detail and time are read back from `events`, so the two never disagree):
// - a team item's event (`itemAuditStatement`, from events.ts eventStatements): for the item's team, or for the
//   teams a move names (the one it left and the one it went to);
// - accounts' team events (`accountAuditStatement`, from bulkEventStatements): for the team its detail names;
// - with no event of their own: a team item deleted for good (`deletedAuditStatement`, purge.ts) and a team
//   webhook added or removed (`webhookAuditStatement`, webhooks/routes.ts).
// Each is one statement whatever the count, through an index lookup, so logging never slows what it logs.
//
// Keeping. The daily run deletes rows past TEAM_AUDIT_RETENTION_MS, the oldest first, a chunk a statement until a
// statement takes less than a chunk or the run's bound is spent (`sweepTeamAudit`). Closing an account anonymises its rows (`teamAuditPurgeStatements`, account-purge.ts).

import {
  TEAM_AUDIT_ACCOUNT_TYPES,
  TEAM_AUDIT_ITEM_TYPES,
  TEAM_AUDIT_RETENTION_MS,
  PLATFORM_APP,
  type TeamAuditEventType,
  type EventType,
} from '@liveworkspace/index-client';
import type { Env } from './env';

type Db = D1Database;

// The daily sweep: TEAM_AUDIT_SWEEP_CHUNK rows a statement (by rowid through team_audit_age, so a statement never
// holds more than a chunk), at most TEAM_AUDIT_SWEEP_ROUNDS statements or TEAM_AUDIT_SWEEP_MS a run, whichever comes
// first: up to 100,000 rows a day, however big the backlog. What is left waits a day.
export const TEAM_AUDIT_SWEEP_CHUNK = 500;
export const TEAM_AUDIT_SWEEP_ROUNDS = 200;
export const TEAM_AUDIT_SWEEP_MS = 60_000;

const COLUMNS =
  'team_id, id, type, app, actor_id, actor_name, subject_id, item_id, title, detail, occurred_at';
// From the event `e` (the team's id selected first, as `team_id`).
const FROM_EVENT = `e.id, e.type, e.app, e.actor_id, e.actor_name,
  json_extract(e.detail, '$.personId'), e.item_id, e.title, e.detail, e.occurred_at`;

const itemTypes: ReadonlySet<string> = new Set(TEAM_AUDIT_ITEM_TYPES);
const accountTypes: ReadonlySet<string> = new Set(TEAM_AUDIT_ACCOUNT_TYPES);

/** Whether an item's event of this kind is logged for its team. */
export const isAuditedItemEvent = (type: EventType): boolean => itemTypes.has(type);

/**
 * The statement logging one item's event (already written in the batch, by id): for the item's team, or,
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
         FROM events e JOIN items i ON i.id = e.item_id
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
       FROM json_each(?) t JOIN events e ON e.id = ?`,
    )
    .bind(JSON.stringify(named), eventId);
}

/**
 * The statement logging accounts' team events (written in the batch by bulkEventStatements) for the team each names
 * in its detail (`teamId`). None when nothing in the batch is a team event.
 */
export function accountAuditStatement(
  db: Db,
  events: readonly { id: string; type: EventType; detail?: Record<string, string | null> | null }[],
): D1PreparedStatement | null {
  const pairs = events.flatMap((e) => {
    const team = e.detail?.teamId;
    return accountTypes.has(e.type) && team ? [[team, e.id]] : [];
  });
  if (pairs.length === 0) return null;
  return db
    .prepare(
      `INSERT OR IGNORE INTO team_audit_events (${COLUMNS})
       SELECT json_extract(p.value, '$[0]'), ${FROM_EVENT}
       FROM json_each(?) p JOIN events e ON e.id = json_extract(p.value, '$[1]')`,
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
      PLATFORM_APP,
      audit.actorId,
      audit.name,
      JSON.stringify({ webhookId: audit.webhookId, kind: audit.kind, host: audit.host }),
      audit.at,
      added ? 1 : 0,
      audit.webhookId,
    );
}

/** The daily run: rows past the year go, the oldest first. Returns how many went and whether some are left. */
export async function sweepTeamAudit(
  env: Env,
  now = Date.now(),
  {
    chunk = TEAM_AUDIT_SWEEP_CHUNK,
    rounds = TEAM_AUDIT_SWEEP_ROUNDS,
    ms = TEAM_AUDIT_SWEEP_MS,
  } = {},
): Promise<{ deleted: number; more: boolean }> {
  const statement = env.INDEX_DB.prepare(
    `DELETE FROM team_audit_events WHERE rowid IN (
       SELECT rowid FROM team_audit_events WHERE occurred_at < ? ORDER BY occurred_at LIMIT ?)`,
  ).bind(now - TEAM_AUDIT_RETENTION_MS, chunk);
  // Wall time from when the step starts (`now` is the cutoff's clock, which a test may set in the past).
  const deadline = Date.now() + ms;
  let deleted = 0;
  for (let round = 0; round < rounds; round++) {
    if (round > 0 && Date.now() >= deadline) break;
    const changes = (await statement.run()).meta.changes ?? 0;
    deleted += changes;
    if (changes < chunk) return { deleted, more: false };
  }
  return { deleted, more: true };
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
