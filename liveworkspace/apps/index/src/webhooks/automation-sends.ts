// Automation sends (liveworkspace/docs/specs/004-index/webhooks.md "Automation sends"): a liveplanner plan's room posts
// what its automation rules send through the plan's own webhooks, as a rule runs.
//
//   POST /app/items/:id/automation-sends  {sends} (at most AUTOMATION_SENDS_MAX) → 200 {results}, in the order sent
//
// One read settles every send (the webhook is this plan's, live, under its pending cap; the delivery not already
// written), then one insert queues the queued ones. A send's delivery id is made from the item, the webhook and the
// send's key, so a retried run's send writes nothing new and answers queued.

import { sha256Hex } from '@liveworkspace/api-schema/sha256';
import {
  AUTOMATION_RULE_MAX,
  AUTOMATION_SENDS_MAX,
  AUTOMATION_TEXT_MAX,
  WEBHOOK_PENDING_MAX,
  WEBHOOK_URL_MAX,
  type App,
  type AutomationSendResult,
  type WebhookPauseReason,
} from '@liveworkspace/index-client';
import { appOrigin, type Env } from '../env';
import { badRequest, fail, json, readObject } from '../http';
import type { AutomationDetail } from './messages';
import { automationSendStatement, automationTargets, type QueuedAutomationSend } from './outbox';

// A key's and a webhook id's longest, and a card's title (cut to it). A card's link longer than WEBHOOK_URL_MAX is
// dropped.
const KEY_MAX = 200;
const CARD_TITLE_MAX = 200;

// The words a rule's Audit Trail shows for a refused send.
const NOT_FOUND = 'This webhook isn’t on this plan any more';
const FULL = 'Too many messages waiting for this webhook';
const PAUSED: Record<WebhookPauseReason, string> = {
  paused: 'an editor paused it',
  creator_left: 'the person who added it can no longer edit this plan',
  failing: 'its last 20 messages failed',
  gone: 'the address said it’s gone',
};

type Parsed = { key: string; webhookId: string; at: number; detail: AutomationDetail };

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const cut = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

const idText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= KEY_MAX;

// A card's link, kept only when it is on the app's own origin (so a chat's Open in liveplanner can't point elsewhere),
// and with `|` encoded, which would end a Slack link's address.
function cardUrl(env: Env, app: App, value: string): string | null {
  const origin = appOrigin(env, app);
  if (!origin || value.length > WEBHOOK_URL_MAX || !URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.origin !== new URL(origin).origin) return null;
  return url.href.replace(/\|/g, '%7C');
}

function parseSend(env: Env, app: App, value: unknown, now: number): Parsed | null {
  const s = value as Record<string, unknown> | null;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  if (!idText(s.key) || !idText(s.webhookId) || !isTime(s.at)) return null;
  if (typeof s.rule !== 'string' || typeof s.text !== 'string' || s.text.trim() === '') return null;
  let card: AutomationDetail['card'] = null;
  if (s.card !== null) {
    const c = s.card as Record<string, unknown> | undefined;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
    if (!Number.isInteger(c.key) || typeof c.title !== 'string' || typeof c.url !== 'string') {
      return null;
    }
    card = {
      key: c.key as number,
      title: cut(c.title.trim(), CARD_TITLE_MAX) || 'Untitled',
      url: cardUrl(env, app, c.url),
    };
  }
  return {
    key: s.key,
    webhookId: s.webhookId,
    at: Math.min(Math.floor(s.at), now),
    detail: {
      rule: cut(s.rule.trim(), AUTOMATION_RULE_MAX) || 'Untitled',
      card,
      text: cut(s.text, AUTOMATION_TEXT_MAX),
    },
  };
}

/** A send's delivery id: the same for the same item, webhook and key, whatever else the send says. */
const sendId = async (itemId: string, webhookId: string, key: string) =>
  `aut:${await sha256Hex(new TextEncoder().encode(`${itemId}\n${webhookId}\n${key}`))}`;

/** POST /app/items/:id/automation-sends, from the item's own app, which is liveplanner. */
export async function pushAutomationSends(
  env: Env,
  itemId: string,
  app: App,
  request: Request,
  now = Date.now(),
): Promise<Response> {
  if (app !== 'liveplanner') return fail(403, 'wrong_app');
  const body = await readObject(request);
  const list = body?.sends;
  if (!Array.isArray(list) || list.length > AUTOMATION_SENDS_MAX) {
    return badRequest('invalid_sends');
  }
  const sends: Parsed[] = [];
  for (const value of list) {
    const send = parseSend(env, app, value, now);
    if (!send) return badRequest('invalid_sends');
    sends.push(send);
  }
  if (sends.length === 0) return json({ results: [] });

  const ids = await Promise.all(sends.map((s) => sendId(itemId, s.webhookId, s.key)));
  const { webhooks, written } = await automationTargets(
    env.INDEX_DB,
    itemId,
    sends.map((s, i) => ({ webhookId: s.webhookId, id: ids[i]! })),
  );
  const byId = new Map(webhooks.map((w) => [w.id, w]));
  // Each webhook's sends queued so far in this push, and the delivery ids among them (a key sent twice in one push).
  const ahead = new Map<string, number>();
  const queuedIds = new Set<string>();
  const queue: QueuedAutomationSend[] = [];
  const results: AutomationSendResult[] = sends.map((send, i) => {
    const id = ids[i]!;
    const pair = `${send.webhookId} ${id}`;
    if (written.has(pair) || queuedIds.has(pair)) return { key: send.key, queued: true };
    const webhook = byId.get(send.webhookId);
    if (!webhook) {
      return { key: send.key, queued: false, reason: NOT_FOUND, code: 'webhook_not_found' };
    }
    if (webhook.paused_at !== null) {
      const why = PAUSED[webhook.paused_reason ?? 'paused'] ?? PAUSED.paused;
      return {
        key: send.key,
        queued: false,
        reason: `This webhook is paused: ${why}`,
        code: 'webhook_paused',
      };
    }
    const place = ahead.get(send.webhookId) ?? 0;
    if (webhook.pending + place >= WEBHOOK_PENDING_MAX) {
      return { key: send.key, queued: false, reason: FULL, code: 'webhook_full' };
    }
    ahead.set(send.webhookId, place + 1);
    queuedIds.add(pair);
    queue.push({ id, webhookId: send.webhookId, ahead: place, at: send.at, detail: send.detail });
    return { key: send.key, queued: true };
  });
  if (queue.length > 0) await automationSendStatement(env.INDEX_DB, itemId, queue, now).run();
  return json({ results });
}
