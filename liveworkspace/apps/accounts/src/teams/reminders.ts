// Invitation reminders and expiry, and who hears an answer (teams.ts).

import { type SendWindow, SEND_WINDOW, windowFilter } from '../send-window.ts';
import type { SettingsApp } from '../settings.ts';
import {
  appOrNull,
  BUMP,
  EXPIRE_BATCH,
  INVITATION_TTL_MS,
  INVITER_APP,
  MAX_DECLINE_HASHES,
  MAX_REMINDER_ATTEMPTS,
  REMINDER_AGES_MS,
  REMINDER_BATCH,
  REV,
} from './shared.ts';
import { newDeclineToken } from './tokens.ts';

// --- Reminders and expiry ---

export interface ReminderEmail {
  to: string;
  teamName: string;
  inviterName: string | null;
  // The app the inviter signed up through, which the reminder is counted under; null isn't counted.
  inviterApp: SettingsApp | null;
  // 1, 2 or 3.
  stage: number;
  declineToken: string;
}

// The hourly sweep (liveworkspace/docs/specs/003-accounts/accounts.md "Reminders and expiry"). First, invitations
// nobody answered in 28 days expire, whether or not email is set up. Then each one still waiting hears the
// latest reminder it is due (1, 7 and 21 days after its clock started), one email per invitation per
// run; a reminder it skipped is stamped 0. A reminder waits for the send window of the account at the invited
// address, by the default zone for an address with no account (send-window.ts). A failed send is tried again in
// the next run inside the window, three times at most.
export async function sweepInvitations(
  db: D1Database,
  send: ((email: ReminderEmail) => Promise<void>) | null,
  now = Date.now(),
  window: SendWindow | null = SEND_WINDOW,
): Promise<{ expired: number; reminded: number; failed: number }> {
  const [, expiry] = await db.batch<unknown>([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET status = 'declined', expiredAt = ?, updatedAt = ?, rev = ${REV}
         WHERE id IN (SELECT id FROM team_member
                      WHERE status = 'invited' AND clockStartedAt <= ?
                      ORDER BY clockStartedAt, id LIMIT ?)`,
      )
      .bind(now, now, now - INVITATION_TTL_MS, EXPIRE_BATCH),
  ]);
  const expired = (expiry as { meta?: { changes?: number } })?.meta?.changes ?? 0;
  let reminded = 0;
  let failed = 0;
  if (!send) return { expired, reminded, failed };
  const inWindow = windowFilter('r.timeZone', window, now);
  if (inWindow === 'closed') return { expired, reminded, failed };

  // Latest stage first, so an invitation that fell behind gets only the reminder it is due now.
  for (let stage = REMINDER_AGES_MS.length; stage >= 1; stage--) {
    const from = REMINDER_AGES_MS[stage - 1]!;
    const until = (REMINDER_AGES_MS as readonly number[])[stage] ?? INVITATION_TTL_MS;
    const column = `reminder${stage}SentAt`;
    const { results } = await db
      .prepare(
        `SELECT m.id, m.email, m.declineTokenHashes, t.name AS teamName, u.name AS inviterName,
                ${INVITER_APP} AS inviterApp
         FROM team_member m JOIN team t ON t.id = m.teamId LEFT JOIN "user" u ON u.id = m.invitedBy
         LEFT JOIN "user" r ON r.email = m.email
         WHERE m.status = 'invited' AND t.deletedAt IS NULL
           AND m.clockStartedAt <= ? AND m.clockStartedAt > ?
           AND m.${column} IS NULL AND m.reminderAttempts < ?
           ${inWindow ? `AND ${inWindow.sql}` : ''}
         ORDER BY m.clockStartedAt, m.id LIMIT ?`,
      )
      .bind(
        now - from,
        now - until,
        MAX_REMINDER_ATTEMPTS,
        ...(inWindow ? [inWindow.bind] : []),
        REMINDER_BATCH,
      )
      .all<{
        id: string;
        email: string;
        declineTokenHashes: string;
        teamName: string;
        inviterName: string | null;
        inviterApp: string | null;
      }>();
    for (const row of results) {
      const decline = await newDeclineToken(row.id);
      try {
        await send({
          to: row.email,
          teamName: row.teamName,
          inviterName: row.inviterName,
          inviterApp: appOrNull(row.inviterApp),
          stage,
          declineToken: decline.token,
        });
      } catch {
        failed++;
        await db
          .prepare(`UPDATE team_member SET reminderAttempts = reminderAttempts + 1 WHERE id = ?`)
          .bind(row.id)
          .run();
        continue;
      }
      reminded++;
      const hashes = [...row.declineTokenHashes.split(' ').filter(Boolean), decline.hash].slice(
        -MAX_DECLINE_HASHES,
      );
      const skipped = Array.from({ length: stage - 1 }, (_, i) => `reminder${i + 1}SentAt`)
        .map((c) => `${c} = COALESCE(${c}, 0)`)
        .join(', ');
      await db
        .prepare(
          `UPDATE team_member SET ${column} = ?, reminderAttempts = 0, declineTokenHashes = ?
           ${skipped ? `, ${skipped}` : ''} WHERE id = ?`,
        )
        .bind(now, hashes.join(' '), row.id)
        .run();
    }
  }
  return { expired, reminded, failed };
}

// --- Telling the admins ---

// Who to tell when someone answers an invitation: the team's joined admins, each at their account's
// address, except anyone who turned the notice off (the `notifyInviteResponse` setting, "all" scope).
export async function inviteResponseRecipients(
  db: D1Database,
  teamId: string,
  // The account that answered: an invitation as an admin makes them one, and they never hear of their own answer.
  responderId: string | null = null,
): Promise<{ email: string; name: string }[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.email, u.name FROM team_member m JOIN "user" u ON u.id = m.userId
       WHERE m.teamId = ?1 AND m.status = 'joined' AND m.role = 'admin' AND (?2 IS NULL OR m.userId <> ?2)
       LIMIT 50`,
    )
    .bind(teamId, responderId)
    .all<{ id: string; email: string; name: string }>();
  if (!results.length) return [];
  let optedOut = new Set<string>();
  try {
    const { results: off } = await db
      .prepare(
        `SELECT owner_id FROM settings WHERE scope = 'all'
           AND json_extract(prefs, '$.notifyInviteResponse') = 0
           AND owner_id IN (${results.map(() => '?').join(', ')})`,
      )
      .bind(...results.map((r) => r.id))
      .all<{ owner_id: string }>();
    optedOut = new Set(off.map((r) => r.owner_id));
  } catch {
    // No settings table yet: nobody has turned the notice off.
  }
  return results.filter((r) => !optedOut.has(r.id)).map(({ email, name }) => ({ email, name }));
}
