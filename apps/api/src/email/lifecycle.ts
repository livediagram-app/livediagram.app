// spec/64: onboarding-series orchestration. Ties the email_lifecycle table to
// the templates + Resend client. Two entry points: an inline first-sighting
// welcome (immediate) and the daily cron sweep (welcome catch-up + week 1 / 2).

import {
  dueForStage,
  markStageSent,
  recordSighting,
  type LifecycleStage,
} from '../db/email-lifecycle';
import type { Env } from '../types';
import { emailEnabled, sendEmail } from './client';
import { week1Email, week2Email, welcomeEmail, type RenderedEmail } from './templates';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_LIMIT = 100; // bounded per daily run, oldest-first

const STAGE_BUILDER: Record<LifecycleStage, (env: Env) => RenderedEmail> = {
  welcome: welcomeEmail,
  week1: week1Email,
  week2: week2Email,
};

// First authenticated sighting → sign-up (spec/64 §4). Best-effort: stamps
// welcome_sent_at only on a successful send, so a failed inline send is left for
// the next daily sweep to retry. Runs in ctx.waitUntil, so it never blocks the request.
export async function welcomeOnSighting(env: Env, ownerId: string, email: string): Promise<void> {
  if (!emailEnabled(env)) return;
  const isNew = await recordSighting(env, ownerId, email);
  if (!isNew) return;
  const { sent } = await sendEmail(env, { to: email, ...welcomeEmail(env) });
  if (sent) await markStageSent(env, ownerId, 'welcome');
}

// Daily cron (spec/64 §5). Welcome is swept too so inline-failed / email-was-off
// rows get caught up; week 1 / 2 fire once their row is old enough.
export async function runLifecycleSweep(env: Env): Promise<void> {
  if (!emailEnabled(env)) return;
  const now = Date.now();
  await sweepStage(env, 'welcome', now);
  await sweepStage(env, 'week1', now - WEEK_MS);
  await sweepStage(env, 'week2', now - 2 * WEEK_MS);
}

async function sweepStage(env: Env, stage: LifecycleStage, cutoff: number): Promise<void> {
  const rows = await dueForStage(env, stage, cutoff, SWEEP_LIMIT);
  for (const row of rows) {
    const { sent } = await sendEmail(env, { to: row.email, ...STAGE_BUILDER[stage](env) });
    if (sent) await markStageSent(env, row.ownerId, stage);
  }
}
