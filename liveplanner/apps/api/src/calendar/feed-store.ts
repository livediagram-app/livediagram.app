// The plan's calendar feeds (docs/specs/026-plan/calendar-feed.md; blueprint calendar-feed.md "Data and
// persistence"), in its own SQLite: one row per person, tied to them, holding the SHA-256 of their feed token and
// their feed options. The token itself is never stored. Reset Link is a new issue over the same row, so the old hash
// is gone in the same statement.

import type { PlanEnv } from '../types';
import { feedTokenHash, newFeedToken } from './feed-token';

// A plan schema step (plan-room/plan-schema.ts), append-only like every other.
export const CALENDAR_FEEDS_SCHEMA = `
CREATE TABLE IF NOT EXISTS calendar_feeds (
  plan_id      TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  person_id    TEXT    NOT NULL,
  token_hash   TEXT    NOT NULL,
  board_id     TEXT,
  mine         INTEGER NOT NULL DEFAULT 0,
  include_done INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (plan_id, person_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS calendar_feeds_token ON calendar_feeds (token_hash);
`;

// Card types in place of a board (calendar-feed.md "What it shows"; owner, 2026-11-17): a JSON array of type ids, or
// NULL for every type. Asks before the ALTER, so it is safe however far a room got (plan-schema.ts V36).
export function addCalendarFeedTypes(
  exec: (sql: string) => { toArray: () => Record<string, unknown>[] },
): void {
  const have = new Set(
    exec('PRAGMA table_info(calendar_feeds)')
      .toArray()
      .map((c) => String(c.name)),
  );
  if (!have.has('type_ids')) exec('ALTER TABLE calendar_feeds ADD COLUMN type_ids TEXT NULL');
}

// What a feed shows (calendar-feed.md "What it shows"): some card types (null: every type), only the cards that
// name the person, and done cards or not. `boardId` is a feed made before card types; a save clears it.
export type CalendarFeedOptions = {
  typeIds: string[] | null;
  boardId: string | null;
  mine: boolean;
  includeDone: boolean;
};

const typeIdsOf = (raw: string | null): string[] | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((t) => typeof t === 'string') && parsed.length
      ? parsed
      : null;
  } catch {
    return null;
  }
};
const typeIdsText = (ids: string[] | null) => (ids && ids.length ? JSON.stringify(ids) : null);

// A feed as a fetch reads it: whose it is and what it shows. Plain data, so it crosses the room's RPC boundary.
export type CalendarFeed = CalendarFeedOptions & { personId: string };

type FeedRow = {
  person_id: string;
  board_id: string | null;
  type_ids: string | null;
  mine: number;
  include_done: number;
};

/** A fresh token for the person's feed on this plan, made or reset (the old token stops at once). Shown once. */
export async function issueCalendarFeed(
  env: PlanEnv,
  planId: string,
  personId: string,
  options: CalendarFeedOptions,
  now: number,
): Promise<string> {
  const token = newFeedToken();
  await env.PLAN_DB.prepare(
    `INSERT INTO calendar_feeds (plan_id, person_id, token_hash, board_id, type_ids, mine, include_done, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (plan_id, person_id) DO UPDATE SET token_hash = excluded.token_hash,
       board_id = excluded.board_id, type_ids = excluded.type_ids, mine = excluded.mine, include_done = excluded.include_done,
       created_at = excluded.created_at`,
  )
    .bind(
      planId,
      personId,
      await feedTokenHash(token),
      options.boardId,
      typeIdsText(options.typeIds),
      options.mine ? 1 : 0,
      options.includeDone ? 1 : 0,
      now,
    )
    .run();
  return token;
}

/** The person's feed on this plan turned off; whether there was one. */
export async function revokeCalendarFeed(
  env: PlanEnv,
  planId: string,
  personId: string,
): Promise<boolean> {
  const result = await env.PLAN_DB.prepare(
    'DELETE FROM calendar_feeds WHERE plan_id = ? AND person_id = ?',
  )
    .bind(planId, personId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** The person's own feed on this plan, as Subscribe to Calendar shows it (never its hash), or null for none. */
export async function calendarFeedFor(
  env: PlanEnv,
  planId: string,
  personId: string,
): Promise<(CalendarFeedOptions & { createdAt: number }) | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT board_id, type_ids, mine, include_done, created_at FROM calendar_feeds
      WHERE plan_id = ? AND person_id = ?`,
  )
    .bind(planId, personId)
    .first<Omit<FeedRow, 'person_id'> & { created_at: number }>();
  if (!row) return null;
  return {
    typeIds: typeIdsOf(row.type_ids),
    boardId: row.board_id,
    mine: row.mine === 1,
    includeDone: row.include_done === 1,
    createdAt: row.created_at,
  };
}

/** The person's feed's options changed, its token (so its link) kept; whether they had a feed. */
export async function setCalendarFeedOptions(
  env: PlanEnv,
  planId: string,
  personId: string,
  options: CalendarFeedOptions,
): Promise<boolean> {
  const result = await env.PLAN_DB.prepare(
    `UPDATE calendar_feeds SET board_id = ?, type_ids = ?, mine = ?, include_done = ?
      WHERE plan_id = ? AND person_id = ?`,
  )
    .bind(
      options.boardId,
      typeIdsText(options.typeIds),
      options.mine ? 1 : 0,
      options.includeDone ? 1 : 0,
      planId,
      personId,
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** The feed a token's hash names on this plan, or null for a token it never made (or one since reset). */
export async function calendarFeedOf(
  env: PlanEnv,
  planId: string,
  tokenHash: string,
): Promise<CalendarFeed | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT person_id, board_id, type_ids, mine, include_done FROM calendar_feeds
      WHERE plan_id = ? AND token_hash = ?`,
  )
    .bind(planId, tokenHash)
    .first<FeedRow>();
  if (!row) return null;
  return {
    personId: row.person_id,
    typeIds: typeIdsOf(row.type_ids),
    boardId: row.board_id,
    mine: row.mine === 1,
    includeDone: row.include_done === 1,
  };
}
