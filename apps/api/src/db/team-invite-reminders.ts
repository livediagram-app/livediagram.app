// Team invite reminders and expiry (docs/specs/013-workspace/teams.md "Reminders and expiry"): the daily
// sweep's reads and writes on `team_members` (migration 0095). An invite still 'invited' is reminded 1, 7
// and 21 days after it was sent, and becomes 'expired' (rejected) 28 days after.

import type { Env } from '../types';
import { MAX_SEND_ATTEMPTS } from './email-lifecycle';

const DAY_MS = 24 * 60 * 60 * 1000;

export type InviteReminderStage = 1 | 2 | 3;

// docs/specs/013-workspace/teams.md: when each reminder is due, measured from the invite's created_at.
// Safe range: strictly increasing and all below INVITE_EXPIRY_MS.
export const INVITE_REMINDER_DELAYS_MS: Record<InviteReminderStage, number> = {
  1: DAY_MS,
  2: 7 * DAY_MS,
  3: 21 * DAY_MS,
};

// docs/specs/013-workspace/teams.md: an invite nobody answered is rejected ('expired') this long after it was
// sent, a week after the last reminder. Safe range: above the last reminder's delay.
export const INVITE_EXPIRY_MS = 28 * DAY_MS;

// Where each stage's window ends: the next stage's delay, and expiry after the last. The windows are disjoint,
// so one run sends an invite at most one reminder; a sweep that fell behind sends only the latest one due.
const WINDOW_END_MS: Record<InviteReminderStage, number> = {
  1: INVITE_REMINDER_DELAYS_MS[2],
  2: INVITE_REMINDER_DELAYS_MS[3],
  3: INVITE_EXPIRY_MS,
};

// Static column whitelist: the `${col}` interpolations below are these literals, never caller input.
const STAMP_COLUMN: Record<InviteReminderStage, string> = {
  1: 'reminder1_sent_at',
  2: 'reminder2_sent_at',
  3: 'reminder3_sent_at',
};

export type DueInviteReminder = {
  memberId: string;
  email: string;
  teamName: string;
};

// Pending invites owed `stage` now: inside its window, not yet stamped, under the attempt cap, oldest first.
// Reads team_members_pending_idx (created_at WHERE status = 'invited').
export async function dueForInviteReminder(
  env: Env,
  stage: InviteReminderStage,
  now: number,
  limit: number,
): Promise<DueInviteReminder[]> {
  const col = STAMP_COLUMN[stage];
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.email, t.name
       FROM team_members m JOIN teams t ON t.id = m.team_id
      WHERE m.status = 'invited' AND m.email IS NOT NULL AND m.${col} IS NULL
        AND m.created_at <= ? AND m.created_at > ? AND m.reminder_attempts < ?
      ORDER BY m.created_at ASC
      LIMIT ?`,
  )
    .bind(
      now - INVITE_REMINDER_DELAYS_MS[stage],
      now - WINDOW_END_MS[stage],
      MAX_SEND_ATTEMPTS,
      limit,
    )
    .all<{ id: string; email: string; name: string }>();
  return (results ?? []).map((r) => ({ memberId: r.id, email: r.email, teamName: r.name }));
}

// A reminder went out: stamp it, stamp any earlier stage it stood in for as skipped (0), reset the attempt
// count, and store the hash of the decline token the email carries. Guarded on 'invited', so an invite
// answered while the email was in flight keeps its answer.
export async function markInviteReminderSent(
  env: Env,
  memberId: string,
  stage: InviteReminderStage,
  declineTokenHash: string,
): Promise<void> {
  const earlier = ([1, 2, 3] as const)
    .filter((s) => s < stage)
    .map((s) => `${STAMP_COLUMN[s]} = COALESCE(${STAMP_COLUMN[s]}, 0), `)
    .join('');
  await env.DB.prepare(
    `UPDATE team_members
        SET ${earlier}${STAMP_COLUMN[stage]} = ?1, reminder_attempts = 0,
            decline_token_hashes = CASE
              WHEN decline_token_hashes IS NULL OR decline_token_hashes = '' THEN ?2
              ELSE decline_token_hashes || ' ' || ?2 END
      WHERE id = ?3 AND status = 'invited'`,
  )
    .bind(Date.now(), declineTokenHash, memberId)
    .run();
}

// A reminder failed to send: count it against the invite and answer the new count. At MAX_SEND_ATTEMPTS the
// invite leaves every reminder query for good (the address is dead); the invite itself still expires.
export async function recordInviteReminderFailure(env: Env, memberId: string): Promise<number> {
  const row = await env.DB.prepare(
    `UPDATE team_members SET reminder_attempts = reminder_attempts + 1
      WHERE id = ? RETURNING reminder_attempts`,
  )
    .bind(memberId)
    .first<{ reminder_attempts: number }>();
  return row?.reminder_attempts ?? 0;
}

// Reject every invite nobody answered within INVITE_EXPIRY_MS, at most `limit` a run, oldest first; how many.
// The subquery bounds the write and reads team_members_pending_idx.
export async function expireStaleInvites(env: Env, now: number, limit: number): Promise<number> {
  const res = await env.DB.prepare(
    `UPDATE team_members SET status = 'expired', updated_at = ?1
      WHERE id IN (
        SELECT id FROM team_members
         WHERE status = 'invited' AND created_at <= ?2
         ORDER BY created_at ASC
         LIMIT ?3)`,
  )
    .bind(now, now - INVITE_EXPIRY_MS, limit)
    .run();
  return res.meta.changes ?? 0;
}
