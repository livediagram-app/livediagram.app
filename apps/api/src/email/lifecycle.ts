// docs/specs/014-identity/transactional-email.md: onboarding-series orchestration. Ties the email_lifecycle table to
// the templates + Resend client. Two entry points: an inline first-sighting
// welcome (immediate) and the daily cron sweep (welcome catch-up + week 1 / 2).

import { getNotificationPrefs } from '../db';
import {
  dueForActivation,
  dueForStage,
  dueForWinback,
  markActivationSent,
  markStageSent,
  markWinbackSent,
  recordSighting,
  type LifecycleStage,
} from '../db/email-lifecycle';
import type { Env } from '../types';
import { emailEnabled, sendEmail } from './client';
import {
  activationEmail,
  week1Email,
  week2Email,
  welcomeEmail,
  winBackEmail,
  type RenderedEmail,
} from './templates';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVATION_DELAY_MS = 3 * 24 * 60 * 60 * 1000; // nudge zero-diagram signups ~day 3
const WINBACK_QUIET_MS = 4 * WEEK_MS; // re-engage after ~4 weeks of no activity
const SWEEP_LIMIT = 100; // bounded per daily run, oldest-first

const STAGE_BUILDER: Record<LifecycleStage, (env: Env) => RenderedEmail> = {
  welcome: welcomeEmail,
  week1: week1Email,
  week2: week2Email,
};

// First authenticated sighting → sign-up (docs/specs/014-identity/transactional-email.md §4). Best-effort: stamps
// welcome_sent_at only on a successful send, so a failed inline send is left for
// the next daily sweep to retry. Runs in ctx.waitUntil, so it never blocks the request.
export async function welcomeOnSighting(env: Env, ownerId: string, email: string): Promise<void> {
  if (!emailEnabled(env)) return;
  const isNew = await recordSighting(env, ownerId, email);
  if (!isNew) return;
  const { sent } = await sendEmail(env, { to: email, ...welcomeEmail(env) });
  if (sent) await markStageSent(env, ownerId, 'welcome');
}

// Daily cron (docs/specs/014-identity/transactional-email.md §5). Welcome is swept too so inline-failed / email-was-off
// rows get caught up; week 1 / 2 fire once their row is old enough.
export async function runLifecycleSweep(env: Env): Promise<void> {
  if (!emailEnabled(env)) return;
  const now = Date.now();
  // Welcome is the immediate first touch and isn't gated on a preference (the
  // user can't have toggled before it fires). Every LATER tip/check-in respects
  // notifyTips, so the "Tips and check-ins" toggle genuinely turns them all off.
  await sweepStage(env, 'welcome', now, false);
  // Activation nudge (docs/specs/014-identity/transactional-email.md #4): zero-diagram signups ~3 days in. Runs before
  // week 1 so an empty account hears this first; dueForActivation excludes rows
  // that already reached week 1.
  await sweepActivation(env, now - ACTIVATION_DELAY_MS);
  await sweepStage(env, 'week1', now - WEEK_MS, true);
  await sweepStage(env, 'week2', now - 2 * WEEK_MS, true);
  await sweepWinback(env, now - WINBACK_QUIET_MS);
}

// Whether the owner has opted out of tips / check-ins (docs/specs/014-identity/transactional-email.md). Shared by the
// later onboarding stages, the activation nudge, and win-back.
async function tipsOptedOut(env: Env, ownerId: string): Promise<boolean> {
  const prefs = await getNotificationPrefs(env, ownerId);
  return !prefs.notifyTips;
}

// Win-back (docs/specs/014-identity/transactional-email.md #5): one-shot re-engagement for owners quiet ~4 weeks.
// Opt-out (notifyTips). Each quiet owner is considered exactly once: we stamp
// winback_sent_at whether we send or they've opted out (only a failed send is
// left to retry), so an opted-out owner isn't re-queried every day.
async function sweepWinback(env: Env, cutoff: number): Promise<void> {
  const rows = await dueForWinback(env, cutoff, SWEEP_LIMIT);
  for (const row of rows) {
    if (await tipsOptedOut(env, row.ownerId)) {
      await markWinbackSent(env, row.ownerId);
      continue;
    }
    const { sent } = await sendEmail(env, { to: row.email, ...winBackEmail(env) });
    if (sent) await markWinbackSent(env, row.ownerId);
  }
}

async function sweepStage(
  env: Env,
  stage: LifecycleStage,
  cutoff: number,
  respectTips: boolean,
): Promise<void> {
  const rows = await dueForStage(env, stage, cutoff, SWEEP_LIMIT);
  for (const row of rows) {
    // Opted out of tips: stamp the stage so we stop re-checking, but send nothing.
    if (respectTips && (await tipsOptedOut(env, row.ownerId))) {
      await markStageSent(env, row.ownerId, stage);
      continue;
    }
    const { sent } = await sendEmail(env, { to: row.email, ...STAGE_BUILDER[stage](env) });
    if (sent) await markStageSent(env, row.ownerId, stage);
  }
}

async function sweepActivation(env: Env, cutoff: number): Promise<void> {
  const rows = await dueForActivation(env, cutoff, SWEEP_LIMIT);
  for (const row of rows) {
    // The activation nudge is a tip too — respect the opt-out (stamp + skip).
    if (await tipsOptedOut(env, row.ownerId)) {
      await markActivationSent(env, row.ownerId);
      continue;
    }
    const { sent } = await sendEmail(env, { to: row.email, ...activationEmail(env) });
    if (sent) await markActivationSent(env, row.ownerId);
  }
}
