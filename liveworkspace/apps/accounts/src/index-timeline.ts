// Teams' and API tokens' events on the Timeline (liveworkspace/docs/specs/003-accounts/accounts.md "On the Timeline"). The
// index keeps one Timeline for every app; teams and tokens are this Worker's, so it tells the index what
// happened to them: an invitation sent, joined or declined, a role changed, a member removed or leaving, a
// team renamed or deleted, a token made, revoked or about to expire.
//
// Each event is written to index_timeline_outbox in the batch that makes its change (`timelineStatement`),
// so no change is ever recorded without its event. After the response, the request's events go to the index
// in one call (`POST ${INDEX_URL}/internal/timeline`, the merge key, at most TIMELINE_BATCH a call); the
// frequent cron resends whatever is still waiting. An event's id is its own and stable, so sending one twice
// changes nothing at the index. An event carries its actor's name (the index keeps it beside the event, as
// for an app's) and, for a member, their name or address, so a Timeline can say who without asking here.
import type { Env } from './env.ts';
import { indexPurgeConfig, type IndexPurgeConfig } from './index-purge.ts';

// The index's limits (@liveworkspace/index-client APP_EVENTS_MAX, ACCOUNT_EVENT_SCOPES_MAX).
export const TIMELINE_BATCH = 100;
export const TIMELINE_SCOPES_MAX = 250;
// Calls the cron makes per run, at most.
export const TIMELINE_CALLS_PER_RUN = 10;
// An event the index keeps refusing (a malformed one: a 4xx) is dropped after this many tries.
export const TIMELINE_MAX_ATTEMPTS = 96;
// The most events kept waiting: with no index to send to (INDEX_URL or its key unset), or one that is down for
// days, the oldest beyond this go, so the outbox never grows without bound. A day's worth many times over.
export const TIMELINE_OUTBOX_MAX = 5_000;
const TIMELINE_TIMEOUT_MS = 5_000;

export type TimelineType =
  | 'team_invite_sent'
  | 'team_joined'
  | 'team_declined'
  | 'team_role_changed'
  | 'team_member_removed'
  | 'team_renamed'
  | 'team_deleted'
  | 'token_created'
  | 'token_revoked'
  | 'token_expiring';

export type TimelineEvent = {
  id: string;
  type: TimelineType;
  actorId: string | null;
  actorName?: string | null;
  // The team's or token's name.
  title: string;
  detail?: Record<string, string | null>;
  at: number;
  // Who sees it: `t:<team>` for a team's members, `p:<account>` for one person.
  scopes: string[];
};

// Set once a request wrote an event, so a request that wrote none sends nothing.
let written = false;

/**
 * The statement that queues one event, for the batch that makes its change. `guard` is SQL that must hold for
 * the event to be queued (a token minted only under the limit): it runs after the change in the same batch.
 */
export function timelineStatement(
  db: D1Database,
  event: TimelineEvent,
  guard?: { sql: string; args: unknown[] },
): D1PreparedStatement {
  written = true;
  const scopes = [...new Set(event.scopes)].slice(0, TIMELINE_SCOPES_MAX);
  const body = JSON.stringify({ ...event, scopes });
  return db
    .prepare(
      `INSERT OR IGNORE INTO index_timeline_outbox (id, body, createdAt) SELECT ?, ?, ?${
        guard ? ` WHERE ${guard.sql}` : ''
      }`,
    )
    .bind(event.id, body, event.at, ...(guard?.args ?? []));
}

/** `t:<team>` and each person's `p:<id>`, the scopes a team event names. */
export const teamScopes = (teamId: string | null, people: (string | null | undefined)[]) => [
  ...(teamId ? [`t:${teamId}`] : []),
  ...people.flatMap((id) => (id ? [`p:${id}`] : [])),
];

type OutboxRow = { id: string; body: string; attempts: number };

async function post(config: IndexPurgeConfig, events: unknown[]): Promise<number> {
  const send = config.indexService ? config.indexService.fetch.bind(config.indexService) : fetch;
  try {
    const response = await send(`${config.indexUrl}/internal/timeline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.indexKey}` },
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(TIMELINE_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return response.status;
  } catch {
    return 0;
  }
}

/**
 * Sends what is waiting, oldest first, up to `calls` calls of TIMELINE_BATCH. A batch the index took is
 * cleared; one it didn't is tried again later, and dropped after TIMELINE_MAX_ATTEMPTS. Never throws.
 */
export async function flushTimeline(
  db: D1Database,
  config: IndexPurgeConfig,
  calls = 1,
): Promise<{ sent: number; waiting: boolean }> {
  if (!config.indexUrl || !config.indexKey) return { sent: 0, waiting: false };
  let sent = 0;
  try {
    for (let i = 0; i < calls; i++) {
      const { results } = await db
        .prepare(
          'SELECT id, body, attempts FROM index_timeline_outbox ORDER BY createdAt, id LIMIT ?',
        )
        .bind(TIMELINE_BATCH)
        .all<OutboxRow>();
      if (results.length === 0) return { sent, waiting: false };
      const ids = JSON.stringify(results.map((r) => r.id));
      const status = await post(
        config,
        results.map((r) => JSON.parse(r.body) as unknown),
      );
      if (status >= 200 && status < 300) {
        await db
          .prepare('DELETE FROM index_timeline_outbox WHERE id IN (SELECT value FROM json_each(?))')
          .bind(ids)
          .run();
        sent += results.length;
        if (results.length < TIMELINE_BATCH) return { sent, waiting: false };
        continue;
      }
      await db.batch([
        db
          .prepare(
            `UPDATE index_timeline_outbox SET attempts = attempts + 1
             WHERE id IN (SELECT value FROM json_each(?))`,
          )
          .bind(ids),
        db
          .prepare('DELETE FROM index_timeline_outbox WHERE attempts >= ?')
          .bind(TIMELINE_MAX_ATTEMPTS),
      ]);
      console.warn('[timeline] events not taken; the cron sends them again', { status });
      return { sent, waiting: true };
    }
    return { sent, waiting: true };
  } catch (error) {
    console.warn('[timeline] flush failed', error);
    return { sent, waiting: true };
  }
}

/**
 * Drops the oldest waiting events beyond TIMELINE_OUTBOX_MAX (the cron's, every run), whether or not an index is
 * configured. Returns how many went. Never throws.
 */
export async function trimTimelineOutbox(
  db: D1Database,
  max = TIMELINE_OUTBOX_MAX,
): Promise<number> {
  try {
    const result = await db
      .prepare(
        `DELETE FROM index_timeline_outbox WHERE id IN (
           SELECT id FROM index_timeline_outbox ORDER BY createdAt DESC, id DESC LIMIT -1 OFFSET ?
         )`,
      )
      .bind(max)
      .run();
    return result.meta.changes ?? 0;
  } catch (error) {
    console.warn('[timeline] trim failed', error);
    return 0;
  }
}

/** After a request that wrote an event: sends it once the response has gone. Nothing written costs nothing. */
export function flushTimelineAfter(env: Env, ctx: Pick<ExecutionContext, 'waitUntil'>): void {
  if (!written) return;
  written = false;
  ctx.waitUntil(flushTimeline(env.AUTH_DB, indexPurgeConfig(env)));
}
