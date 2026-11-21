// The two public doors as an app's Worker answers them, before identity (blueprint item-engine.md "Routes", "An
// app's bindings"; liveworkspace/docs/specs/018-automations/automations.md "Triggers every app has", "Runs, limits
// and loops"). A `Bearer lwh_…` is never read as a person or a token, and an unsubscribe's token is its whole proof.
//
//   POST <prefix>/hooks/automations/:itemId/:ruleId   another tool's call to one Incoming Webhook rule
//   POST <prefix>/email-optout/:itemId/:token         a rule email's unsubscribe (RFC 8058 one-click, or the page)
//
// Each checks its address (404), then the caller's network against the app's write limit (429), then its method
// (405) and, for a call, the body's type (415) and size (413), all before any item is woken: a flood is turned away
// before a byte of its body is read. The item's room does the rest
// (doors.ts). Nothing here logs or answers a secret, a signature, a token or a body.
import type { HookAnswer, HookCall } from '../automation-incoming';
import { itemHookResponse, readItemHookCall } from '../item/hook';

// An id as the apps make them (uuids), never a path or a query.
const ID = '([A-Za-z0-9_-]{1,200})';

// The app's write rate limiter (a Workers rate limit binding).
export interface ItemDoorLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// The app's own answers, with its headers.
export interface ItemDoorAnswers {
  notFound(): Response;
  methodNotAllowed(): Response;
  json(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response;
}

export interface ItemDoorInput {
  // The path before the door's own, `/api` by default.
  prefix?: string;
  limiter?: ItemDoorLimiter | undefined;
  // The caller's network, as the app keys its limits (@liveworkspace/api-kit clientRateKey).
  network: (request: Request) => string;
  answers: ItemDoorAnswers;
}

const addressOf = (request: Request, prefix: string, door: string): RegExpExecArray | null =>
  new RegExp(`^${prefix}/${door}/${ID}/${ID}$`).exec(new URL(request.url).pathname);

async function limited(input: ItemDoorInput, request: Request, door: string): Promise<boolean> {
  if (!input.limiter) return false;
  return !(await input.limiter.limit({ key: `${door}:${input.network(request)}` })).success;
}

/** `…/hooks/automations/:itemId/:ruleId`: one Incoming Webhook call, or the refusal. `hook` is the item's room. */
export async function serveItemHook(
  request: Request,
  input: ItemDoorInput & {
    hook: (itemId: string, ruleId: string, call: HookCall) => Promise<HookAnswer>;
  },
): Promise<Response> {
  const address = addressOf(request, input.prefix ?? '/api', 'hooks/automations');
  if (!address) return input.answers.notFound();
  const [, itemId = '', ruleId = ''] = address;
  // One network's calls, whatever rule they name, before the body is read or any item is woken.
  if (await limited(input, request, 'hook'))
    return itemHookResponse({
      status: 429,
      body: { error: 'webhook_rate_limited' },
      retryAfter: 60,
    });
  const call = await readItemHookCall(request);
  if (call instanceof Response) return call;
  return itemHookResponse(await input.hook(itemId, ruleId, call));
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/** `…/email-optout/:itemId/:token`: one address unsubscribed from the item's rule emails, or the refusal. A GET
 *  from a link scanner unsubscribes nobody; the body (`List-Unsubscribe=One-Click`) is never read. */
export async function serveItemOptOut(
  request: Request,
  input: ItemDoorInput & { optOut: (itemId: string, token: string) => Promise<boolean> },
): Promise<Response> {
  const { answers } = input;
  const address = addressOf(request, input.prefix ?? '/api', 'email-optout');
  if (!address) return answers.notFound();
  const [, itemId = '', token = ''] = address;
  if (request.method !== 'POST') return answers.methodNotAllowed();
  // One network's tries, whatever item they name, before any item is woken.
  if (await limited(input, request, 'optout'))
    return answers.json(
      { error: 'rate_limited' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': '60' } },
    );
  const done = await input.optOut(itemId, token);
  console.info('[automations] email.optout', { done });
  return done
    ? answers.json({ unsubscribed: true }, { headers: NO_STORE })
    : answers.json({ error: 'optout_not_found' }, { status: 404, headers: NO_STORE });
}
