// Automation sends (liveworkspace/docs/specs/004-index/webhooks.md "Automation sends"): an item's room posts what its
// automation rules send through the item's own connections, as a rule runs. Every app's rules send this way.
//
//   POST /app/items/:id/automation-sends  {sends} (at most AUTOMATION_SENDS_MAX) → 200 {results}, in the order sent
//
// One read settles every send (the connection is this item's, live, under its pending cap; the delivery not already
// written), then one insert queues the queued ones. A send's delivery id is made from the item, the connection and
// the send's key, so a retried run's send writes nothing new and answers queued.

import { sha256Hex } from '@liveworkspace/api-schema/sha256';
import {
  AUTOMATION_RULE_MAX,
  AUTOMATION_SENDS_MAX,
  AUTOMATION_TEXT_MAX,
  cardRefFor,
  WEBHOOK_PENDING_MAX,
  WEBHOOK_URL_MAX,
  type App,
  type AutomationSendResult,
  type WebhookPauseReason,
} from '@liveworkspace/index-client';
import { appOrigin, type Env } from '../env';
import { badRequest, json, readObject } from '../http';
import type { AutomationDetail, AutomationSubject } from './messages';
import { automationSendStatement, automationTargets, type QueuedAutomationSend } from './outbox';

// A key's and a connection id's longest, a subject's title and reference (each cut to it). A subject's link longer
// than WEBHOOK_URL_MAX is dropped.
const KEY_MAX = 200;
const SUBJECT_TITLE_MAX = 200;
const SUBJECT_REF_MAX = 40;

// What each app calls its item, in the words a rule's Audit Trail shows for a refused send.
const ITEM_WORD: Record<App, string> = {
  livediagram: 'document',
  liveplanner: 'plan',
  livedocuments: 'document',
  livedesign: 'design',
  livehuddle: 'Space',
};
const FULL = 'Too many messages waiting for this connection';
const PAUSED: Record<WebhookPauseReason, (item: string) => string> = {
  paused: () => 'an editor paused it',
  creator_left: (item) => `the person who added it can no longer edit this ${item}`,
  failing: () => 'its last 20 messages failed',
  gone: () => 'the address said it’s gone',
};

type Parsed = { key: string; webhookId: string; at: number; detail: AutomationDetail };

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const cut = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

const idText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= KEY_MAX;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// A subject's link, kept only when it is on the app's own origin (so a chat's Open in <app> can't point elsewhere),
// and with `|` encoded, which would end a Slack link's address.
function subjectUrl(env: Env, app: App, value: string): string | null {
  const origin = appOrigin(env, app);
  if (!origin || value.length > WEBHOOK_URL_MAX || !URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.origin !== new URL(origin).origin) return null;
  return url.href.replace(/\|/g, '%7C');
}

// What a send is about: `subject`, else `card`, the field's name while only liveplanner sent (kept one release).
// Null for none; undefined for a shape that refuses the push. A reference that is not text is dropped, never refused.
function parseSubject(
  env: Env,
  app: App,
  s: Record<string, unknown>,
): AutomationSubject | null | undefined {
  const aliased = s.subject === undefined;
  const raw = aliased ? s.card : s.subject;
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw) || typeof raw.title !== 'string' || typeof raw.url !== 'string') {
    return undefined;
  }
  let ref: string | undefined;
  if (aliased) {
    if (!Number.isInteger(raw.key)) return undefined;
    ref = cardRefFor(raw.ref, raw.key as number) ?? `#${raw.key as number}`;
  } else if (typeof raw.ref === 'string') {
    ref = cut(raw.ref.trim(), SUBJECT_REF_MAX) || undefined;
  }
  return {
    ...(ref ? { ref } : {}),
    title: cut(raw.title.trim(), SUBJECT_TITLE_MAX) || 'Untitled',
    url: subjectUrl(env, app, raw.url),
  };
}

// The card a plain endpoint read before subjects (`{key, ref?, title, url}`), for a liveplanner subject whose
// reference ends in the card's number ("WI-48", "#48"); undefined for a subject that is not a card.
function cardOf(subject: AutomationSubject): AutomationDetail['card'] {
  const number = /(\d{1,15})$/.exec(subject.ref ?? '');
  if (!number) return undefined;
  const key = Number(number[1]);
  const ref = cardRefFor(subject.ref, key);
  return { key, ...(ref ? { ref } : {}), title: subject.title, url: subject.url };
}

function parseSend(env: Env, app: App, value: unknown, now: number): Parsed | null {
  if (!isRecord(value)) return null;
  const s = value;
  if (!idText(s.key) || !idText(s.webhookId) || !isTime(s.at)) return null;
  if (typeof s.rule !== 'string' || typeof s.text !== 'string' || s.text.trim() === '') return null;
  const subject = parseSubject(env, app, s);
  if (subject === undefined) return null;
  const card = app === 'liveplanner' && subject ? cardOf(subject) : undefined;
  return {
    key: s.key,
    webhookId: s.webhookId,
    at: Math.min(Math.floor(s.at), now),
    detail: {
      rule: cut(s.rule.trim(), AUTOMATION_RULE_MAX) || 'Untitled',
      subject,
      ...(card ? { card } : {}),
      text: cut(s.text, AUTOMATION_TEXT_MAX),
    },
  };
}

/** A send's delivery id: the same for the same item, webhook and key, whatever else the send says. */
const sendId = async (itemId: string, webhookId: string, key: string) =>
  `aut:${await sha256Hex(new TextEncoder().encode(`${itemId}\n${webhookId}\n${key}`))}`;

/** POST /app/items/:id/automation-sends, from the item's own app (app-routes.ts refuses any other). */
export async function pushAutomationSends(
  env: Env,
  itemId: string,
  app: App,
  request: Request,
  now = Date.now(),
): Promise<Response> {
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
  const item = ITEM_WORD[app];
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
      return {
        key: send.key,
        queued: false,
        reason: `This connection isn’t on this ${item} any more`,
        code: 'webhook_not_found',
      };
    }
    if (webhook.paused_at !== null) {
      const why = (PAUSED[webhook.paused_reason ?? 'paused'] ?? PAUSED.paused)(item);
      return {
        key: send.key,
        queued: false,
        reason: `This connection is paused: ${why}`,
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
