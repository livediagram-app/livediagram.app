// Incoming Webhook doors (docs/specs/026-plan/automations.md "Incoming Webhook"; blueprint automations.md "Phase 3").
//
// `POST /api/hooks/automations/:projectId/:ruleId`: another tool's call to one rule. The worker answers it before
// identity (index.ts), so a `Bearer lwh_…` is never read as a person or a token: the address must be one (404), the
// method POST (405), the body JSON (415) and at most 16 KB, declared or read (413), and the caller's network inside
// the write limit (429), all before the plan is asked anything. The plan's room checks the secret, the rule's minute
// and the day, reads the body and queues the runs (plan-room/automations/automation-incoming.ts).
//
// `POST /api/projects/:id/automations/:ruleId/secret` (dispatched by automation-routes.ts behind its gate): Make
// Secret and Regenerate, an Editor's of the whole plan, signed in, never an API token. The secret is in that one
// answer, never stored, never cached.
import {
  WEBHOOK_BODY_MAX,
  WEBHOOK_SIGNATURE_HEADER,
  type AutomationRule,
} from '@liveplanner/items';
import type { AutomationSecretResponse } from '@liveplanner/api-schema';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { planRoom } from '../plan-client';
import { json, methodNotAllowed, notFound } from '../responses';
import { makeHookSecret } from '../plan-room/automations/automation-incoming';
import type { HookAnswer } from '../plan-room/automations/automation-incoming';
import type { Env } from '../types';
import type { PlanRouteContext } from './context';
import type { Gated } from './automation-routes';

// The whole address: a plan's and a rule's id, each what the app makes (uuids, nanoids), never a path or a query.
const ADDRESS = /^\/api\/hooks\/automations\/([A-Za-z0-9_-]{1,200})\/([A-Za-z0-9_-]{1,200})$/;

const answer = (a: HookAnswer): Response =>
  json(a.body, {
    status: a.status,
    headers: {
      'Cache-Control': 'no-store',
      ...(a.retryAfter !== undefined ? { 'Retry-After': String(a.retryAfter) } : {}),
    },
  });

const isJson = (type: string | null): boolean =>
  (type ?? '').split(';')[0]!.trim().toLowerCase() === 'application/json';

/** `/api/hooks/automations/:projectId/:ruleId`: one Incoming Webhook call, or the refusal. */
export async function handleAutomationHook(request: Request, env: Env): Promise<Response> {
  const address = ADDRESS.exec(new URL(request.url).pathname);
  if (!address) return notFound();
  const [, projectId = '', ruleId = ''] = address;
  if (request.method !== 'POST') return methodNotAllowed();
  if (!isJson(request.headers.get('Content-Type')))
    return answer({ status: 415, body: { error: 'webhook_json_only' } });
  const declared = Number(request.headers.get('Content-Length'));
  const tooLarge = () => answer({ status: 413, body: { error: 'webhook_too_large' } });
  if (Number.isFinite(declared) && declared > WEBHOOK_BODY_MAX) return tooLarge();
  const body = request.body
    ? await readCappedBody(request.body as ReadableStream<Uint8Array>, WEBHOOK_BODY_MAX)
    : new Uint8Array();
  if (!body) return tooLarge();
  // One network's calls, whatever rule they name, before any plan is woken.
  if (env.WRITE_RATE_LIMITER) {
    const ok = await env.WRITE_RATE_LIMITER.limit({ key: `hook:${clientRateKey(request)}` });
    if (!ok.success)
      return answer({ status: 429, body: { error: 'webhook_rate_limited' }, retryAfter: 60 });
  }
  const a = await planRoom(env, projectId).incomingHook(ruleId, {
    body,
    authorization: request.headers.get('Authorization'),
    signature: request.headers.get(WEBHOOK_SIGNATURE_HEADER),
  });
  return answer(a);
}

/** Make Secret and Regenerate: a new secret for an Incoming Webhook rule, the old one stopped at once. */
export async function makeSecret(
  ctx: PlanRouteContext,
  g: Gated,
  held: AutomationRule,
): Promise<Response> {
  // Never through an API token, whatever the Automations gate lets through.
  if (ctx.token) return json({ error: 'automations_need_editor' }, { status: 403 });
  if (held.trigger.kind !== 'incoming_webhook')
    return json({ error: 'automation_not_incoming' }, { status: 409 });
  const regenerated = hasSecret(g, held.id);
  const made = await makeHookSecret(ctx.env, g.projectId, g.hook.sql(), held.id, Date.now());
  console.info('[automations] hook.secret', { regenerated });
  const body: AutomationSecretResponse = made;
  return json(body, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

const hasSecret = (g: Gated, ruleId: string): boolean =>
  g.hook.sql().exec('SELECT 1 FROM automation_hooks WHERE rule_id = ?', ruleId).toArray().length >
  0;
