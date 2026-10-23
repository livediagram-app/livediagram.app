// One-shot backfill (docs/specs/013-workspace/timeline.md §5).
//
// A brand-new Timeline that is empty for a user with sixty designs
// reads as a broken feature, not a new one. On the first read of a
// scope we seed it from what the database already knows.
//
// Runs inside waitUntil after the response is served, and stamps
// `backfilled_at` so it never runs twice. Every insert hits the
// timeline UNIQUE key, so overlapping with events the live write path
// already emitted never duplicates them; the reconstructions (a creation,
// an edit) leave the real row as it is.

import { dedupeKeyForDay, markScopeBackfilled } from '../db/timeline';
import type { Env } from '../types';
import { userScope } from './audience';
import { record } from './record';

// How far back the seed reaches. A cap rather than the whole library
// because this runs in one request: a user with a thousand designs
// would otherwise pay for a thousand upserts on their first page load.
const BACKFILL_DESIGN_LIMIT = 200;

type DesignSeedRow = {
  id: string;
  name: string;
  created_at: number;
  saved_at: number;
};

type TeamSeedRow = {
  team_id: string;
  name: string;
  created_at: number;
};

export async function backfillUserScope(env: Env, ownerId: string): Promise<void> {
  const scope = [userScope(ownerId)];

  const liveDocs = await env.DB.prepare(
    `SELECT id, name, created_at, saved_at FROM designs
      WHERE owner_id = ?1
      ORDER BY saved_at DESC
      LIMIT ?2`,
  )
    .bind(ownerId, BACKFILL_DESIGN_LIMIT)
    .all<DesignSeedRow>();

  const rows = liveDocs.results ?? [];
  // Log rather than silently truncate: a user with 400 designs should
  // not be told their history starts in March when it doesn't.
  if (rows.length === BACKFILL_DESIGN_LIMIT) {
    console.info('timeline backfill capped', ownerId, BACKFILL_DESIGN_LIMIT);
  }

  for (const row of rows) {
    await record(
      env,
      {
        actorId: ownerId,
        sourceType: 'design',
        sourceId: row.id,
        eventType: 'design_created',
        title: 'Design Created',
        description: row.name,
        occurredAt: row.created_at,
        snapshot: { designId: row.id, designName: row.name },
        // A reconstruction: it never overwrites the real creation already recorded, whose snapshot
        // may say the making counts as a use (docs/specs/013-workspace/explorer-home.md "Making a
        // design").
        keepExisting: true,
      },
      scope,
    );
    // Only when the design was actually touched after it was made —
    // otherwise every seeded design gets a redundant "Updated" bubble
    // one millisecond after its "Created" one.
    if (row.saved_at > row.created_at) {
      await record(
        env,
        {
          actorId: ownerId,
          sourceType: 'design',
          sourceId: row.id,
          eventType: 'design_edited',
          dedupeKey: dedupeKeyForDay(ownerId, row.saved_at),
          title: 'Design Updated',
          description: row.name,
          occurredAt: row.saved_at,
          // A reconstruction: the last save may have been a teammate's, so Explorer Home, which
          // counts only real edits, leaves it out; and it never overwrites a real edit already
          // recorded for that day (docs/specs/013-workspace/timeline.md §5).
          snapshot: { designId: row.id, designName: row.name, backfilled: true },
          keepExisting: true,
        },
        scope,
      );
    }
  }

  const teams = await env.DB.prepare(
    `SELECT m.team_id, t.name, m.created_at
       FROM team_members m
       JOIN teams t ON t.id = m.team_id
      WHERE m.user_id = ?1 AND m.status = 'joined'`,
  )
    .bind(ownerId)
    .all<TeamSeedRow>();

  for (const team of teams.results ?? []) {
    await record(
      env,
      {
        actorId: ownerId,
        sourceType: 'team',
        sourceId: `${team.team_id}:${ownerId}:joined`,
        eventType: 'team_member_joined',
        title: 'Member Joined',
        description: `You joined ${team.name}`,
        occurredAt: team.created_at,
        snapshot: { teamId: team.team_id, teamName: team.name, memberName: null },
      },
      scope,
    );
  }

  // Comments and assigned actions are deliberately NOT seeded. They
  // live inside element JSON in `tabs`, so backfilling them means
  // parsing every tab of every design — a cost with no ceiling, in a
  // request. The feed's older reaches are thinner than its recent ones;
  // that gap closes on its own within a week of use.

  await markScopeBackfilled(env, { scopeType: 'user', scopeId: ownerId });
}
