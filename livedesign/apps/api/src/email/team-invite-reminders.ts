// docs/specs/013-workspace/teams.md "Reminders and expiry": the daily cron step for team invites nobody has
// answered. Expiry first, whether or not email is configured (one rule on every deployment), then the three
// reminder stages, latest first, each a bounded batch. Best-effort throughout: a failure is logged and counted
// against the invite (reminder_attempts), never thrown into the cron.

import { mintDeclineToken } from '../db/team-invite-decline';
import {
  dueForInviteReminder,
  expireStaleInvites,
  markInviteReminderSent,
  recordInviteReminderFailure,
  type InviteReminderStage,
} from '../db/team-invite-reminders';
import { MAX_SEND_ATTEMPTS } from '../db/team-invite-reminders';
import type { Env } from '../types';
import { emailEnabled, sendEmail } from './client';
import { teamInviteReminderEmail } from './templates';

// Invites one reminder stage takes a run, oldest first: the lifecycle series' bound.
export const INVITE_REMINDER_BATCH = 100;
// Invites one run expires. A plain UPDATE through the pending index, so a larger bound than the sends.
export const INVITE_EXPIRY_BATCH = 500;

// Latest first: an invite the sweep fell behind on hears only the latest reminder it is due (the windows are
// disjoint, so the order changes nothing else).
const STAGES: readonly InviteReminderStage[] = [3, 2, 1];

export type InviteSweepResult = { expired: number; sent: number; failed: number };

export async function runTeamInviteSweep(
  env: Env,
  now: number = Date.now(),
): Promise<InviteSweepResult> {
  const result: InviteSweepResult = { expired: 0, sent: 0, failed: 0 };
  try {
    result.expired = await expireStaleInvites(env, now, INVITE_EXPIRY_BATCH);
  } catch (err) {
    console.error('[team-invites] expiry failed', err);
  }
  if (emailEnabled(env)) {
    for (const stage of STAGES) {
      try {
        await sendStage(env, stage, now, result);
      } catch (err) {
        console.error(`[team-invites] reminder ${stage} failed`, err);
      }
    }
  }
  console.log(
    `[team-invites] sweep: expired ${result.expired}, reminded ${result.sent}, failed ${result.failed}`,
  );
  return result;
}

async function sendStage(
  env: Env,
  stage: InviteReminderStage,
  now: number,
  result: InviteSweepResult,
): Promise<void> {
  const due = await dueForInviteReminder(env, stage, now, INVITE_REMINDER_BATCH);
  for (const invite of due) {
    // A fresh token per email; its hash is stored only once the email is out, so a failed send leaves
    // nothing behind and the invite never holds more than one hash per email it was sent.
    const decline = await mintDeclineToken(invite.memberId);
    const { sent } = await sendEmail(env, {
      to: invite.email,
      ...teamInviteReminderEmail(env, invite.teamName, stage, decline.token),
    });
    if (sent) {
      await markInviteReminderSent(env, invite.memberId, stage, decline.hash);
      result.sent += 1;
      continue;
    }
    result.failed += 1;
    if ((await recordInviteReminderFailure(env, invite.memberId)) === MAX_SEND_ATTEMPTS) {
      console.warn(
        `[team-invites] giving up on an invite after ${MAX_SEND_ATTEMPTS} failed reminders`,
      );
    }
  }
}
