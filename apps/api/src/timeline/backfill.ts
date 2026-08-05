// One-shot backfill (spec/138 §5).
//
// A brand-new Timeline that is empty for a user with sixty diagrams
// reads as a broken feature, not a new one. On the first read of a
// scope we seed it from what the database already knows.
//
// Runs inside waitUntil after the response is served, and stamps
// `backfilled_at` so it never runs twice. Every insert hits the
// timeline UNIQUE key, so overlapping with events the live write path
// already emitted updates those rows rather than duplicating them.

import { dedupeKeyForDay, markScopeBackfilled } from '../db/timeline';
import type { Env } from '../types';
import { userScope } from './audience';
import { record } from './record';

// How far back the seed reaches. A cap rather than the whole library
// because this runs in one request: a user with a thousand diagrams
// would otherwise pay for a thousand upserts on their first page load.
export const BACKFILL_DIAGRAM_LIMIT = 200;

type DiagramSeedRow = {
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

  const diagrams = await env.DB.prepare(
    `SELECT id, name, created_at, saved_at FROM diagrams
      WHERE owner_id = ?1
      ORDER BY saved_at DESC
      LIMIT ?2`,
  )
    .bind(ownerId, BACKFILL_DIAGRAM_LIMIT)
    .all<DiagramSeedRow>();

  const rows = diagrams.results ?? [];
  // Log rather than silently truncate: a user with 400 diagrams should
  // not be told their history starts in March when it doesn't.
  if (rows.length === BACKFILL_DIAGRAM_LIMIT) {
    console.info('timeline backfill capped', ownerId, BACKFILL_DIAGRAM_LIMIT);
  }

  for (const row of rows) {
    await record(
      env,
      {
        actorId: ownerId,
        sourceType: 'diagram',
        sourceId: row.id,
        eventType: 'diagram_created',
        title: 'Diagram Created',
        description: row.name,
        occurredAt: row.created_at,
        snapshot: { diagramId: row.id, diagramName: row.name },
      },
      scope,
    );
    // Only when the diagram was actually touched after it was made —
    // otherwise every seeded diagram gets a redundant "Updated" bubble
    // one millisecond after its "Created" one.
    if (row.saved_at > row.created_at) {
      await record(
        env,
        {
          actorId: ownerId,
          sourceType: 'diagram',
          sourceId: row.id,
          eventType: 'diagram_edited',
          dedupeKey: dedupeKeyForDay(ownerId, row.saved_at),
          title: 'Diagram Updated',
          description: row.name,
          occurredAt: row.saved_at,
          snapshot: { diagramId: row.id, diagramName: row.name },
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
  // parsing every tab of every diagram — a cost with no ceiling, in a
  // request. The feed's older reaches are thinner than its recent ones;
  // that gap closes on its own within a week of use.

  await markScopeBackfilled(env, { scopeType: 'user', scopeId: ownerId });
}
