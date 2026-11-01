// The returning old guest, the browser's one-time door after the move from the old livehuddle.app
// (docs/migration.md step 6; docs/specs/015-api/api.md "Migration"): `POST /api/legacy-guest/claim`, body a
// LegacyGuestClaim, as the caller's guest or account. The old guest id the browser kept is checked by the accounts
// Worker (its signature, or the old rule for an unsigned id), and what was migrated under it merged into the caller.
//
// A claim that will never succeed (a bad signature, an id never migrated, an unsigned id after the cut-over, one
// already claimed) answers 200 `{ merged: false }`, so the editor forgets the old keys; only what may clear on a retry
// (401, 429, 5xx) is an error. Claims are rate-limited per network and per caller (SHARE_RATE_LIMITER, the api's
// guessing limiter, under their own keys), so no one can try signatures fast.

import { claimLegacyGuest } from '@liveworkspace/auth-client';
import type { LegacyGuestClaimAnswer } from '@liveworkspace/migration';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { accountCredentials } from '../auth/accounts';
import { json, notFound, rateLimited } from '../responses';
import { readBody, type RouteContext } from './context';
import { browserCaller, identityRequired } from './migration';

// An old guest id: `crypto.randomUUID()`, lowercase. Its signature: base64url HMAC-SHA-256, 43 characters.
const LEGACY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{16,128}$/;

async function overClaimLimit(ctx: RouteContext, callerId: string): Promise<boolean> {
  const limiter = ctx.env.SHARE_RATE_LIMITER;
  if (!limiter) return false;
  for (const key of [`legacy-claim-ip:${clientRateKey(ctx.request)}`, `legacy-claim:${callerId}`]) {
    if (!(await limiter.limit({ key })).success) return true;
  }
  return false;
}

export async function handleLegacyGuestClaim(ctx: RouteContext): Promise<Response> {
  if (ctx.request.method !== 'POST' || ctx.segments.length !== 3 || ctx.segments[2] !== 'claim')
    return notFound();
  const callerId = browserCaller(ctx);
  if (!callerId) return identityRequired();
  if (await overClaimLimit(ctx, callerId)) {
    console.warn('[legacy-guest] claim rate-limited');
    return rateLimited();
  }
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const { legacyId, signature } = body;
  // A malformed id or signature is one the old site never made: nothing to merge, ever.
  const never: LegacyGuestClaimAnswer = { merged: false, reason: 'unknown' };
  if (typeof legacyId !== 'string' || !LEGACY_ID.test(legacyId)) return json(never);
  if (signature !== null && (typeof signature !== 'string' || !SIGNATURE.test(signature)))
    return json(never);
  const credentials = accountCredentials(ctx.env);
  if (!credentials) return json({ error: 'accounts_unavailable' }, { status: 503 });
  let outcome: Awaited<ReturnType<typeof claimLegacyGuest>>;
  try {
    outcome = await claimLegacyGuest(credentials, { legacyId, signature, into: callerId });
  } catch (err) {
    console.error('[legacy-guest] accounts unreachable', { error: String(err) });
    return json(
      { error: 'accounts_unavailable' },
      { status: 503, headers: { 'Retry-After': '5' } },
    );
  }
  if (outcome.merged) {
    console.info('[legacy-guest] claimed', { signed: signature !== null });
    return json({ merged: true } satisfies LegacyGuestClaimAnswer);
  }
  if (outcome.reason === 'unavailable') {
    console.warn('[legacy-guest] claim unavailable', { status: outcome.status });
    return json(
      { error: 'accounts_unavailable' },
      { status: 503, headers: { 'Retry-After': '5' } },
    );
  }
  console.info('[legacy-guest] nothing to claim', { reason: outcome.reason });
  return json({ merged: false, reason: outcome.reason } satisfies LegacyGuestClaimAnswer);
}
