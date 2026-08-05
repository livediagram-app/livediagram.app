// Account + housekeeping events (spec/138 §4.5).
//
// The quiet end of the catalogue, and the only place the feed looks
// FORWARD: the two `*_expiring` events carry the expiry as their
// occurredAt, so they render in the band above Today. That band is why
// someone opens the Timeline before an integration breaks rather than
// after.

import { dedupeKeyForDay } from '../db/timeline';
import type { Env } from '../types';
import { userScope } from './audience';
import { record } from './record';

export async function recordTokenCreated(
  env: Env,
  token: { id: string; name: string },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: token.id,
      eventType: 'token_created',
      title: 'API Token Created',
      description: token.name,
      snapshot: { tokenName: token.name },
    },
    [userScope(ownerId)],
  );
}

// Future-dated. Emitted by the daily expiry-warning cron that already
// computes which tokens are inside the 7-day window (spec/61), so this
// costs one extra write on a pass that was happening anyway.
export async function recordTokenExpiring(
  env: Env,
  token: { id: string; name: string; expiresAt: number },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: null,
      sourceType: 'account',
      sourceId: token.id,
      eventType: 'token_expiring',
      title: 'API Token Expiring',
      description: token.name,
      occurredAt: token.expiresAt,
      snapshot: { tokenName: token.name, expiresAt: token.expiresAt },
    },
    [userScope(ownerId)],
  );
}

export async function recordThemeSaved(
  env: Env,
  theme: { id: string; name: string },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: theme.id,
      eventType: 'theme_saved',
      title: 'Theme Saved',
      description: theme.name,
      snapshot: { themeName: theme.name },
    },
    [userScope(ownerId)],
  );
}

// Coalesced per day like diagram editing: someone pasting a dozen
// screenshots into a diagram is one moment, not twelve. The snapshot's
// count is what the renderer reads to say "3 images uploaded".
export async function recordImageUploaded(env: Env, ownerId: string): Promise<void> {
  const now = Date.now();
  const dedupeKey = dedupeKeyForDay(ownerId, now);
  const previous = await env.DB.prepare(
    `SELECT snapshot FROM timeline_events
      WHERE source_type = 'account' AND source_id = ?1
        AND event_type = 'image_uploaded' AND dedupe_key = ?2`,
  )
    .bind(ownerId, dedupeKey)
    .first<{ snapshot: string }>();
  let count = 1;
  if (previous) {
    try {
      const parsed = JSON.parse(previous.snapshot) as { count?: unknown };
      if (typeof parsed.count === 'number') count = parsed.count + 1;
    } catch {
      // Unparseable snapshot: start the count again rather than lose
      // the event. The number is decoration, the event is the point.
    }
  }
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: ownerId,
      eventType: 'image_uploaded',
      dedupeKey,
      title: 'Images Uploaded',
      description: count === 1 ? '1 image' : `${count} images`,
      occurredAt: now,
      snapshot: { count },
    },
    [userScope(ownerId)],
  );
}
