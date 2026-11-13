// A rule email's unsubscribe door (docs/specs/026-plan/automations.md "Typed-in addresses"; blueprint automations.md
// "Send Email to typed-in addresses").
//
// `POST /api/email-optout/:projectId/:token`: a mail client's RFC 8058 one-click POST (List-Unsubscribe-Post), or
// the Unsubscribe button on the editor's /email-optout page. The worker answers it before identity (index.ts): the
// token is the whole proof. The address must be one (404), the method POST (405; a GET from a link scanner
// unsubscribes nobody), and the caller's network inside the write limit (429), before the plan is asked anything.
// The plan's room marks the token's address unsubscribed (plan-room/automations/automation-addresses.ts). The body,
// `List-Unsubscribe=One-Click` from a mail client, is never read.
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { planRoom } from '../plan-client';
import { json, methodNotAllowed, notFound } from '../responses';
import type { Env } from '../types';

// A plan's id as the app makes them, and a token's characters (the room checks its shape, automation-addresses.ts
// OPTOUT_TOKEN, and answers one it never made as it answers a wrong one).
const ADDRESS = /^\/api\/email-optout\/([A-Za-z0-9_-]{1,200})\/([A-Za-z0-9_-]{1,200})$/;

const NO_STORE = { 'Cache-Control': 'no-store' };

/** `/api/email-optout/:projectId/:token`: one address unsubscribed from the plan's rule emails, or the refusal. */
export async function handleEmailOptOut(request: Request, env: Env): Promise<Response> {
  const address = ADDRESS.exec(new URL(request.url).pathname);
  if (!address) return notFound();
  const [, projectId = '', token = ''] = address;
  if (request.method !== 'POST') return methodNotAllowed();
  // One network's tries, whatever plan they name, before any plan is woken.
  if (env.WRITE_RATE_LIMITER) {
    const ok = await env.WRITE_RATE_LIMITER.limit({ key: `optout:${clientRateKey(request)}` });
    if (!ok.success)
      return json(
        { error: 'rate_limited' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': '60' } },
      );
  }
  const done = await planRoom(env, projectId).emailOptOut(token);
  console.info('[automations] email.optout', { done });
  return done
    ? json({ unsubscribed: true }, { headers: NO_STORE })
    : json({ error: 'optout_not_found' }, { status: 404, headers: NO_STORE });
}
