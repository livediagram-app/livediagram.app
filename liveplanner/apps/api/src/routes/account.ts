// /api/account — deleting an account.

import { bearerTokenOf } from '@liveplanner/api-schema';
import { closeAccount } from '@liveworkspace/auth-client';
import { deleteAccount } from '../db';
import { emailEnabled, sendEmail } from '../email/client';
import { accountDeletedEmail } from '../email/templates';
import { json, missingAuth, notFound } from '../responses';
import { configured, signedOutCookies } from './auth';
import type { RouteContext } from './context';

// Deleting the person's account: their liveplanner data, then their liveworkspace account, which
// closes it in every liveworkspace app (docs/specs/014-identity/auth-and-guest-access.md
// "Deleting an account"). Signed-in only, with no X-Owner-Id fallback, because the whole point is
// to wipe what belongs to a verified account.
//
// The data goes first. Were the account closed first and the data delete then to fail, nobody
// could sign in to finish it; this way round a failure leaves a signed-in person who can try
// again, and the data delete is idempotent (a second run finds nothing to remove).
export async function handleAccount(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, accountUserId, accountEmail } = ctx;
  if (!(segments[1] === 'account' && segments.length === 2)) return notFound();
  if (request.method === 'DELETE') {
    if (!accountUserId) return missingAuth();
    const deleted = await deleteAccount(env, accountUserId);
    const accounts = configured(env);
    const accessToken = bearerTokenOf(request.headers.get('Authorization'));
    if (accounts && accessToken) {
      try {
        await closeAccount(accounts, accessToken);
      } catch (err) {
        console.warn('[account] close_failed', err instanceof Error ? err.message : 'unknown');
        return json({ error: 'account_not_closed', deleted }, { status: 502 });
      }
    }
    // docs/specs/014-identity/transactional-email.md: a parting confirmation (best-effort, after the rows are gone).
    if (accountEmail && emailEnabled(env)) {
      ctx.waitUntil?.(sendEmail(env, { to: accountEmail, ...accountDeletedEmail(env) }));
    }
    // The refresh token died with the account, so the cookie holding it goes too.
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    for (const cookie of signedOutCookies()) headers.append('Set-Cookie', cookie);
    return json({ deleted }, { headers });
  }
  return notFound();
}
