// /api/account — account self-deletion.

import { deleteAccount } from '../db';
import { emailEnabled, sendEmail } from '../email/client';
import { accountDeletedEmail } from '../email/templates';
import { json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

// Account self-deletion. signed-in only — no X-Owner-Id fallback,
// because the entire purpose is to wipe data bound to a
// verified account identity. The client then ends its session.
// The liveworkspace account itself stays: it signs the person in
// to the other liveworkspace apps too, so it is not livedesign's
// to delete. Idempotent: re-
// calling with the same account id is a no-op once the rows
// are gone.
export async function handleAccount(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, accountUserId, accountEmail } = ctx;
  if (!(segments[1] === 'account' && segments.length === 2)) return notFound();
  if (request.method === 'DELETE') {
    if (!accountUserId) return missingAuth();
    const deleted = await deleteAccount(env, accountUserId);
    // docs/specs/014-identity/transactional-email.md: a parting confirmation (best-effort, after the rows are gone).
    if (accountEmail && emailEnabled(env)) {
      ctx.waitUntil?.(sendEmail(env, { to: accountEmail, ...accountDeletedEmail(env) }));
    }
    return json({ deleted });
  }
  return notFound();
}
