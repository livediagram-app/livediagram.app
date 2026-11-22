// POST /api/email-optout/:documentId/:token: a rule email's unsubscribe door (docs/specs/013-workspace/automations.md;
// liveworkspace/docs/specs/018-automations/automations.md "Runs, limits and loops": emails to typed-in addresses;
// blueprint automations.md "Routes"). A mail client's RFC 8058 one-click POST (List-Unsubscribe-Post), or the
// Unsubscribe button on the editor's /email-optout page. The worker answers it before identity (index.ts): the token
// is the whole proof. The door is the platform's (@liveworkspace/automations/room serveItemOptOut: the address 404,
// the method 405, the caller's network 429, before the document is asked anything); this file hands it this api's
// limiter, answers and the document's room.
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { serveItemOptOut } from '@liveworkspace/automations/room';
import { documentRoom } from '../document-client';
import { json, methodNotAllowed, notFound } from '../responses';
import type { Env } from '../types';

/** `/api/email-optout/:documentId/:token`: one address unsubscribed from the document's rule emails, or the refusal. */
export function handleEmailOptOut(request: Request, env: Env): Promise<Response> {
  return serveItemOptOut(request, {
    limiter: env.WRITE_RATE_LIMITER,
    network: clientRateKey,
    answers: { notFound, methodNotAllowed, json },
    optOut: (documentId, token) => documentRoom(env, documentId).emailOptOut(token),
  });
}
