// POST /api/hooks/automations/:documentId/:ruleId: another tool's call to one Incoming Webhook rule
// (docs/specs/013-workspace/automations.md; liveworkspace/docs/specs/018-automations/automations.md "Triggers every
// app has"; blueprint automations.md "Routes"). The worker answers it before identity (index.ts), so a `Bearer lwh_…`
// is never read as a person or a token. The door is the platform's (@liveworkspace/automations/room serveItemHook:
// the address 404, the method 405, the body's type 415 and size 413, the caller's network 429, all before the document
// is asked anything); this file hands it this api's limiter, answers and the document's room.
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { serveItemHook } from '@liveworkspace/automations/room';
import { documentRoom } from '../document-client';
import { json, methodNotAllowed, notFound } from '../responses';
import type { Env } from '../types';

/** `/api/hooks/automations/:documentId/:ruleId`: one Incoming Webhook call, or the refusal. */
export function handleAutomationHook(request: Request, env: Env): Promise<Response> {
  return serveItemHook(request, {
    limiter: env.WRITE_RATE_LIMITER,
    network: clientRateKey,
    answers: { notFound, methodNotAllowed, json },
    hook: (documentId, ruleId, call) => documentRoom(env, documentId).incomingHook(ruleId, call),
  });
}
