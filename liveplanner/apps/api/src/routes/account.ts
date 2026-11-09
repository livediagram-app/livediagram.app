// /api/account: deleting an account, and the code emailed to confirm it.

import { bearerTokenOf } from '@liveplanner/api-schema';
import { confirmDeletionCode, requestDeletionCode } from '@liveworkspace/auth-client';
import { deleteAccount } from '../db';
import { emailEnabled, sendEmail } from '../email/client';
import { accountDeletedEmail } from '../email/templates';
import { json, missingAuth, notFound } from '../responses';
import { configured, signedOutCookies } from './auth';
import { purgeOwnItems } from '@liveworkspace/index-app';
import { indexFor, INDEX_APP } from '../index-service';
import type { RouteContext } from './context';

// The person's own plans, gone for good through the index (which has each plan's Durable Object drop its
// content), ROOM_PURGE_CONCURRENCY at a time and at most 1,000 a run (@liveworkspace/index-app `purgeOwnItems`).
// Team plans stay with the team. Answers how many went and whether some are left.
async function purgeOwnPlans(ctx: RouteContext): Promise<{ plans: number; more: boolean }> {
  const client = indexFor(ctx.env, { kind: 'bearer', token: ctx.bearer ?? null });
  if (!client) return { plans: 0, more: false };
  const { count, more } = await purgeOwnItems(client, INDEX_APP, ctx.accountUserId);
  return { plans: count, more };
}

// Deleting the person's account: their liveplanner data, then their liveworkspace account, which
// closes it in every liveworkspace app (docs/specs/014-identity/auth-and-guest-access.md
// "Deleting an account"). Signed-in only, because the whole point is to wipe what belongs to a
// verified account.
//
// The data goes first. Were the account closed first and the data delete then to fail, nobody
// could sign in to finish it; this way round a failure leaves a signed-in person who can try
// again, and the data delete is idempotent (a second run finds nothing to remove).
export async function handleAccount(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, accountUserId, accountEmail } = ctx;
  if (segments[1] !== 'account') return notFound();
  const accessToken = bearerTokenOf(request.headers.get('Authorization'));
  // Being signed in is not enough to delete the account: the code emailed to it is (docs/specs/014-identity/
  // auth-and-guest-access.md "Deleting an account"). This asks for one.
  if (segments.length === 3 && segments[2] === 'deletion-code' && request.method === 'POST') {
    if (!accountUserId) return missingAuth();
    const sent = await requestDeletionCode(configured(env), accessToken);
    return json(sent.body, { status: sent.status, headers: { 'Cache-Control': 'no-store' } });
  }
  if (segments.length !== 2) return notFound();
  if (request.method === 'DELETE') {
    if (!accountUserId) return missingAuth();
    // The code is checked before anything is deleted, and the close below sends it again, where the accounts Worker
    // checks it once more and spends it.
    const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
    const confirmed = await confirmDeletionCode(configured(env), accessToken, body?.code);
    if (!confirmed.ok) {
      return json(confirmed.answer.body, {
        status: confirmed.answer.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const purged = await purgeOwnPlans(ctx);
    if (purged.more) return json({ error: 'plans_remaining', deleted: purged }, { status: 409 });
    await deleteAccount(env, accountUserId);
    const deleted = { plans: purged.plans };
    try {
      await confirmed.closeAccount();
    } catch (err) {
      console.warn('[account] close_failed', err instanceof Error ? err.message : 'unknown');
      return json({ error: 'account_not_closed', deleted }, { status: 502 });
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
