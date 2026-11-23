// An item's public doors (liveworkspace/docs/specs/018-automations/automations.md "Triggers every app has": Incoming
// Webhook; "Runs, limits and loops"; blueprint item-engine.md "Routes"), mounted by the app before identity: a
// `Bearer lwh_…` is never read as a person or a token. In the Worker, `readItemHookCall` holds a call to POST, JSON
// and 16 KB before any item is woken; in the room, `answerItemHook` proves the secret (every refusal before the
// proof, a stale or replayed signature's too, the same 401, after the same work), counts the rule's minute and the
// item's day, reads the body, keeps a signed call's signature for the replay window and queues one event. Nothing here logs or answers the secret, a signature or the body. And the email opt-out's write.
import {
  ITEM_INCOMING_EVENT,
  itemValueNames,
  type ItemEvent,
  type ItemEventData,
  type ItemRule,
} from '../../item';
import {
  WEBHOOK_BODY_MAX,
  WEBHOOK_CALLS_PER_MINUTE,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  readHookBody,
  webhookValues,
} from '../../incoming';
import { AUTOMATION_QUEUE_MAX } from '../../limits';
import { WEBHOOK_VALUE_PREFIX, webhookPathOf } from '../../webhook-paths';
import { optOutAddress } from '../automation-addresses';
import {
  HOOK_UNAUTHORIZED,
  countHookCall,
  hookHash,
  hookJson,
  hookReplayed,
  hookRetryAfter,
  provesSecret,
  takeHookSignature,
  type HookAnswer,
  type HookCall,
} from '../automation-incoming';
import { runsToday } from '../automation-log';
import { runsUsedBody } from '../tier';
import type { ItemEngine } from './engine';
import type { ItemRoomKit } from './kit';
import { ITEM_TELEMETRY_ACTION } from './telemetry';

const DAY_MS = 24 * 60 * 60 * 1000;
// The longest tab name or id a call names.
const TAB_REF_MAX = 200;

// ---- In the Worker --------------------------------------------------------------------------------------------------

const answerOf = (a: HookAnswer): Response =>
  new Response(JSON.stringify(a.body), {
    status: a.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(a.retryAfter !== undefined ? { 'Retry-After': String(a.retryAfter) } : {}),
    },
  });

/** The room's answer as the response the caller gets. */
export const itemHookResponse = answerOf;

const isJson = (type: string | null): boolean =>
  (type ?? '').split(';')[0]!.trim().toLowerCase() === 'application/json';

// The body's bytes, or null once they pass `max`: never more than one chunk past it is held.
async function cappedBody(request: Request, max: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = (request.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

/** One call as the room takes it, or the refusal: POST (405), JSON (415), at most 16 KB declared or read (413). */
export async function readItemHookCall(request: Request): Promise<HookCall | Response> {
  if (request.method !== 'POST')
    return answerOf({ status: 405, body: { error: 'method_not_allowed' } });
  if (!isJson(request.headers.get('Content-Type')))
    return answerOf({ status: 415, body: { error: 'webhook_json_only' } });
  const tooLarge = () => answerOf({ status: 413, body: { error: 'webhook_too_large' } });
  if (Number(request.headers.get('Content-Length')) > WEBHOOK_BODY_MAX) return tooLarge();
  const body = await cappedBody(request, WEBHOOK_BODY_MAX);
  if (!body) return tooLarge();
  return {
    body,
    authorization: request.headers.get('Authorization'),
    signature: request.headers.get(WEBHOOK_SIGNATURE_HEADER),
    timestamp: request.headers.get(WEBHOOK_TIMESTAMP_HEADER),
  };
}

// ---- In the room ----------------------------------------------------------------------------------------------------

const log = (answer: string, queued = 0) => console.info('[automations] hook', { answer, queued });

const tally = (kit: ItemRoomKit, type: string): void =>
  kit.defer(kit.telemetry([{ category: kit.category, action: ITEM_TELEMETRY_ACTION, type }]));

// The tab a call names, by id or by name (any case): its id, or null when the item has none such.
async function tabNamed(kit: ItemRoomKit, ref: string): Promise<string | null> {
  const { tabs } = await kit.outline();
  const lower = ref.toLowerCase();
  const found = tabs.find((t) => t.id === ref) ?? tabs.find((t) => t.name.toLowerCase() === lower);
  return found ? found.id : null;
}

// The values the rule names (in a step's text or a Text condition), as the event's data: `webhook.<path>`. The
// rest of the body is never stored.
function dataOf(rule: ItemRule, payload: unknown): ItemEventData {
  const out: Record<string, string | number | boolean> = {};
  const paths = new Set<string>();
  for (const name of itemValueNames([rule.conditions, rule.steps])) {
    const path = webhookPathOf(name);
    if (path) paths.add(path.join('.'));
  }
  const values = webhookValues(payload, [...paths]);
  for (const [path, value] of Object.entries(values)) out[`${WEBHOOK_VALUE_PREFIX}${path}`] = value;
  return out;
}

/** One call to a rule's address, as the room answers it. */
export async function answerItemHook(
  engine: ItemEngine,
  ruleId: string,
  call: HookCall,
  now: number,
): Promise<HookAnswer> {
  const deps = engine.deps();
  const rule = deps ? deps.store.get(ruleId) : null;
  const live = rule?.enabled && rule.trigger.kind === 'incoming_webhook' ? rule : null;
  const hash = deps && live ? hookHash(deps.sql(), ruleId) : null;
  // Counted only once the address names a live webhook rule, so strangers trying addresses count nothing. A replay
  // is read with no await before its signature is kept below, so two copies of one call never both pass.
  const proved = await provesSecret(call, hash, now);
  if (!proved || !deps || !live || hookReplayed(deps.sql(), ruleId, call, now)) {
    log('unauthorized');
    if (deps && live) tally(deps.kit, 'AutomationHookUnauthorized');
    return HOOK_UNAUTHORIZED;
  }
  const { kit } = deps;
  // Archived or in the Trash: the call is taken and nothing runs.
  if (kit.putAway()) {
    log('put_away');
    return { status: 202, body: { queued: 0 } };
  }
  const sql = deps.sql();
  const minute = countHookCall(sql, ruleId, now);
  if (minute.calls > WEBHOOK_CALLS_PER_MINUTE) {
    log('rate_limited');
    tally(kit, 'AutomationHookRateLimited');
    return {
      status: 429,
      body: { error: 'webhook_rate_limited' },
      retryAfter: hookRetryAfter(minute.since, now),
    };
  }
  const used = runsToday(sql, now);
  if (used >= deps.store.runsPerDay) {
    log('budget');
    tally(kit, 'AutomationHookBudget');
    const midnight = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
    // The item's own bound: no tier named, nothing offered.
    return {
      status: 429,
      body: { error: 'automation_budget_spent' },
      retryAfter: Math.max(1, Math.ceil((midnight - now) / 1000)),
    };
  }
  // The owner's month of runs, as the room last heard it refused (within the minute): the call would run nothing.
  if (deps.store.monthUsed(now)) {
    log('month');
    tally(kit, 'AutomationHookMonthUsed');
    return { status: 429, ...runsUsedBody(deps.store, deps.tier, now) };
  }
  const read = readHookBody<string>(hookJson(call.body), {
    key: 'tab',
    read: (v) =>
      typeof v === 'string' && v.length > 0 && v.length <= TAB_REF_MAX
        ? [v]
        : { error: 'tab must be a tab’s name or id' },
  });
  if ('error' in read) {
    log('invalid');
    tally(kit, 'AutomationHookInvalid');
    return { status: 400, body: { error: 'webhook_body_invalid', message: read.error } };
  }
  tally(kit, 'AutomationHookAccepted');
  takeHookSignature(sql, ruleId, call, now);
  const [ref] = read.subjects;
  const tab = ref === undefined ? undefined : await tabNamed(kit, ref);
  // A tab the item lacks: the call is taken and nothing runs.
  if (tab === null) {
    log('accepted');
    return { status: 202, body: { queued: 0 } };
  }
  const event: ItemEvent = {
    id: `w:${crypto.randomUUID()}`,
    kind: ITEM_INCOMING_EVENT,
    at: now,
    ruleId,
    ...(tab !== undefined ? { tab } : {}),
    data: dataOf(live, read.payload),
  };
  const queued = sql
    .exec(
      `INSERT INTO automation_queue (event, at)
       SELECT ?, ? WHERE (SELECT COUNT(*) FROM automation_queue) < ? RETURNING id`,
      JSON.stringify(event),
      now,
      AUTOMATION_QUEUE_MAX,
    )
    .toArray().length;
  engine.queued(1 - queued);
  log('accepted', queued);
  return { status: 202, body: { queued } };
}

/** The email opt-out door's write: the token's address stops getting this item's rule emails. False for a token
 *  the item never made. */
export function itemOptOut(engine: ItemEngine, token: string, now: number): boolean {
  const deps = engine.deps();
  return deps ? optOutAddress(deps.sql(), token, now) : false;
}
