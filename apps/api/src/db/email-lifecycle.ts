// spec/64: the email_lifecycle table: one row per authenticated owner, tracking
// which onboarding emails have been sent. The first sighting creates the row
// (treated as sign-up); the daily cron drives the welcome / week-1 / week-2
// stages off the *_sent_at stamps, which keep every send idempotent.

import type { Env } from '../types';

export type LifecycleStage = 'welcome' | 'week1' | 'week2';

// Static column whitelist: the `${col}` interpolation below is one of these
// literals, never anything caller-supplied (same pattern as the *_COLS consts).
const STAGE_COLUMN: Record<LifecycleStage, string> = {
  welcome: 'welcome_sent_at',
  week1: 'week1_sent_at',
  week2: 'week2_sent_at',
};

// First authenticated sighting. INSERT OR IGNORE keyed on the owner id; returns
// true only when a NEW row was created, which the caller treats as sign-up
// (send the welcome immediately). One cheap write, only ever run when email is
// enabled.
export async function recordSighting(env: Env, ownerId: string, email: string): Promise<boolean> {
  const res = await env.DB.prepare(
    'INSERT OR IGNORE INTO email_lifecycle (owner_id, email, created_at) VALUES (?, ?, ?)',
  )
    .bind(ownerId, email, Date.now())
    .run();
  return res.meta.changes === 1;
}

export type LifecycleRow = { ownerId: string; email: string };

// Rows still owed `stage` and old enough for it: `cutoff` is the latest
// qualifying created_at (now for welcome; now-7d / now-14d for the series).
// Backfilled suppression rows carry email '' (and all stamps set), so the
// empty-email guard skips them defensively.
export async function dueForStage(
  env: Env,
  stage: LifecycleStage,
  cutoff: number,
  limit: number,
): Promise<LifecycleRow[]> {
  const col = STAGE_COLUMN[stage];
  const { results } = await env.DB.prepare(
    `SELECT owner_id, email FROM email_lifecycle WHERE ${col} IS NULL AND created_at <= ? AND email <> '' ORDER BY created_at ASC LIMIT ?`,
  )
    .bind(cutoff, limit)
    .all<{ owner_id: string; email: string }>();
  return (results ?? []).map((r) => ({ ownerId: r.owner_id, email: r.email }));
}

export async function markStageSent(
  env: Env,
  ownerId: string,
  stage: LifecycleStage,
): Promise<void> {
  const col = STAGE_COLUMN[stage];
  await env.DB.prepare(`UPDATE email_lifecycle SET ${col} = ? WHERE owner_id = ?`)
    .bind(Date.now(), ownerId)
    .run();
}

// Called from deleteAccount so a deleted user leaves no lifecycle row behind.
export async function deleteEmailLifecycle(env: Env, ownerId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM email_lifecycle WHERE owner_id = ?').bind(ownerId).run();
}

// The verified address stored for an authenticated owner at first sighting.
// The only server-trusted way to reach a Clerk owner by email outside the
// request that carried their token (spec/65 notifications fire on someone
// else's request). Returns null for a guest owner, an owner with no
// lifecycle row (email off when they signed in), or a backfilled
// suppression row carrying the empty-string sentinel.
export async function getOwnerEmail(env: Env, ownerId: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT email FROM email_lifecycle WHERE owner_id = ?')
    .bind(ownerId)
    .first<{ email: string }>();
  const email = row?.email?.trim();
  return email ? email : null;
}
