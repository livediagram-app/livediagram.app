// /api/account — deleting an account.

import { bearerTokenOf } from '@liveplanner/api-schema';
import { closeAccount } from '@liveworkspace/auth-client';
import { deleteAccount } from '../db';
import { emailEnabled, sendEmail } from '../email/client';
import { accountDeletedEmail } from '../email/templates';
import { json, missingAuth, notFound } from '../responses';
import { configured, signedOutCookies } from './auth';
import { indexFor, INDEX_APP } from '../index-service';
import type { RouteContext } from './context';

// How many of the person's own plans one account deletion purges through the index: 5 pages of 200. A person
// with more is told to try again (the delete is idempotent), each run taking the next 1,000.
const PURGE_PAGES = 5;
const PURGE_PAGE = 200;

// The person's own plans, gone for good through the index (which has each plan's Durable Object drop its
// content). Team plans stay with the team. Answers how many went and whether some are left.
async function purgeOwnPlans(ctx: RouteContext): Promise<{ plans: number; more: boolean }> {
  const client = indexFor(ctx.env, { kind: 'bearer', token: ctx.bearer ?? null });
  if (!client) return { plans: 0, more: false };
  let plans = 0;
  for (let page = 0; page < PURGE_PAGES; page++) {
    const [live, trashed] = await Promise.all([
      client.listItems({ app: INDEX_APP, team: 'personal', limit: PURGE_PAGE }),
      client.listTrash({ app: INDEX_APP, team: 'personal', limit: PURGE_PAGE }),
    ]);
    const own = [...live.items, ...trashed.items].filter((i) => i.ownerId === ctx.accountUserId);
    if (own.length === 0) return { plans, more: false };
    for (const item of own) {
      await client.deleteItem(item.id, { permanent: true });
      plans++;
    }
  }
  return { plans, more: true };
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
  if (!(segments[1] === 'account' && segments.length === 2)) return notFound();
  if (request.method === 'DELETE') {
    if (!accountUserId) return missingAuth();
    const purged = await purgeOwnPlans(ctx);
    if (purged.more) return json({ error: 'plans_remaining', deleted: purged }, { status: 409 });
    await deleteAccount(env, accountUserId);
    const deleted = { plans: purged.plans };
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
