// POST /api/hooks/automations/:designId/:ruleId: another tool's call to one Incoming Webhook rule
// (docs/specs/013-workspace/automations.md; liveworkspace/docs/specs/018-automations/automations.md "Triggers every
// app has"; blueprint automations.md "Routes"). The worker answers it before identity (index.ts), so a `Bearer lwh_…`
// is never read as a person or a token. The door is the platform's (@liveworkspace/automations/room serveItemHook:
// the address 404, the method 405, the body's type 415 and size 413, the caller's network 429, all before the design
// is asked anything); this file hands it this api's limiter, answers and the design's room.
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { serveItemHook } from '@liveworkspace/automations/room';
import { designRoom } from '../design-client';
import { json, methodNotAllowed, notFound } from '../responses';
import type { Env } from '../types';

/** `/api/hooks/automations/:designId/:ruleId`: one Incoming Webhook call, or the refusal. */
export function handleAutomationHook(request: Request, env: Env): Promise<Response> {
  return serveItemHook(request, {
    limiter: env.WRITE_RATE_LIMITER,
    network: clientRateKey,
    answers: { notFound, methodNotAllowed, json },
    hook: (designId, ruleId, call) => designRoom(env, designId).incomingHook(ruleId, call),
  });
}
