// The forward-looking half of the feed (spec/138 §4.5).
//
// Everything else on the Timeline is emitted by the write that caused
// it. These two can't be: nothing HAPPENS when a credential drifts
// within a week of expiring, so a daily pass has to notice. It rides
// the 03:00 cron that already sweeps retention.
//
// Deliberately NOT folded into the existing token-expiry email sweep
// (email/token-expiry.ts), which returns early when RESEND_API_KEY is
// unset. A self-hosted deployment with no email provider still deserves
// to be told its integration is about to break — that is exactly the
// kind of silent change this feed exists to surface (spec/03: never
// degrade the core product on a missing SaaS key).
//
// Idempotent by construction: both emits hit the timeline UNIQUE key on
// (source_type, source_id, event_type), so re-running every day for the
// seven days a credential sits in the window updates one row rather
// than writing seven.

import type { Env } from '../types';
import { recordTokenExpiring } from './account-events';
import { recordShareLinkExpiring } from './diagram-events';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// Bounded per run. The feed is a courtesy, not a ledger: a deployment
// with more than this many credentials lapsing on one day has a bigger
// problem than a missing bubble, and the next day's pass picks up the
// remainder anyway.
const SWEEP_LIMIT = 200;

export async function runTimelineExpirySweep(env: Env, now = Date.now()): Promise<number> {
  let emitted = 0;

  const tokens = await env.DB.prepare(
    `SELECT id, owner_id, name, expires_at FROM api_tokens
      WHERE revoked = 0 AND expires_at > ?1 AND expires_at <= ?2
      ORDER BY expires_at ASC LIMIT ?3`,
  )
    .bind(now, now + WINDOW_MS, SWEEP_LIMIT)
    .all<{ id: string; owner_id: string; name: string | null; expires_at: number }>();

  for (const token of tokens.results ?? []) {
    await recordTokenExpiring(
      env,
      { id: token.id, name: token.name ?? 'API token', expiresAt: token.expires_at },
      token.owner_id,
    );
    emitted += 1;
  }

  // Share links carry their expiry on the link, not the diagram, so the
  // join is what turns "this code lapses Friday" into "your Payments
  // diagram stops being shareable Friday" — which is the sentence the
  // owner can actually act on.
  const links = await env.DB.prepare(
    `SELECT d.id, d.name, d.owner_id, d.team_id, s.expires_at
       FROM share_links s
       JOIN diagrams d ON d.id = s.diagram_id
      WHERE s.expires_at IS NOT NULL AND s.expires_at > ?1 AND s.expires_at <= ?2
      ORDER BY s.expires_at ASC LIMIT ?3`,
  )
    .bind(now, now + WINDOW_MS, SWEEP_LIMIT)
    .all<{
      id: string;
      name: string;
      owner_id: string;
      team_id: string | null;
      expires_at: number;
    }>();

  for (const link of links.results ?? []) {
    await recordShareLinkExpiring(
      env,
      { id: link.id, name: link.name, ownerId: link.owner_id, teamId: link.team_id },
      link.expires_at,
    );
    emitted += 1;
  }

  return emitted;
}
