// docs/specs/014-identity/transactional-email.md (#3): the daily sweep that warns owners whose API token (docs/specs/015-api/public-api-and-tokens.md) is
// within a week of its 6-month expiry, once per token (the expiry_warned_at
// stamp makes it idempotent). Transactional, not opt-out: a lapsing token
// silently breaks a script / connected tool, so the heads-up is account-
// important. Best-effort; a no-key deployment or a missing address is a no-op.

import { apiTokensExpiringSoon, getOwnerEmail, markApiTokenExpiryWarned } from '../db';
import type { Env } from '../types';
import { emailEnabled, sendEmail } from './client';
import { tokenExpiringEmail } from './templates';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_LIMIT = 100; // bounded per daily run, soonest-expiring first

export async function runTokenExpirySweep(env: Env): Promise<void> {
  if (!emailEnabled(env)) return;
  const now = Date.now();
  const tokens = await apiTokensExpiringSoon(env, now, WEEK_MS, SWEEP_LIMIT);
  for (const t of tokens) {
    // Owner address comes from trusted server state (email_lifecycle), not a
    // header. No stored address (e.g. email just enabled) → skip without
    // stamping, so a later run retries while the token is still in-window.
    const to = await getOwnerEmail(env, t.ownerId);
    if (!to) continue;
    const { sent } = await sendEmail(env, { to, ...tokenExpiringEmail(env, t.name, t.expiresAt) });
    if (sent) await markApiTokenExpiryWarned(env, t.id);
  }
}
