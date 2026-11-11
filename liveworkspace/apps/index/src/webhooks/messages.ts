// What a delivery says (liveworkspace/docs/specs/004-index/webhooks.md "Destinations"): the signed JSON event for a
// plain endpoint, a Slack message, or a Teams Adaptive Card, each from the delivery's own copy of the event and
// never more than the Timeline detail the scope already sees. Every body is capped at WEBHOOK_PAYLOAD_MAX_BYTES. An
// automation rule's send ("Automation sends") is the rule's own message, with its card and rule beneath.

import {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_PAYLOAD_MAX_BYTES,
  type WebhookDeliveryType,
  type WebhookKind,
} from '@liveworkspace/index-client';

/** A delivery's copy of its event, as the outbox wrote it. */
export type DeliveryEvent = {
  eventId: string;
  type: WebhookDeliveryType;
  app: string;
  itemId: string | null;
  title: string;
  actorId: string | null;
  actorName: string | null;
  detail: Record<string, string | null> | null;
  occurredAt: number;
  // The item's (or card's) link in its app, or null for none (a test).
  url: string | null;
};

// A detail value cut to this before anything is dropped, and a comment's words in a chat message.
const DETAIL_TEXT_MAX = 500;
const CHAT_TEXT_MAX = 300;

const cut = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;
const quoted = (text: string) => `“${text || 'Untitled'}”`;

/** An automation send's detail as the outbox wrote it: `{rule, card: {key, title, url} | null, text}`. */
export type AutomationDetail = {
  rule: string;
  card: { key: number; title: string; url: string | null } | null;
  text: string;
};

// The detail is parsed JSON, so each part is checked before it is used.
function automationOf(event: DeliveryEvent): AutomationDetail {
  const d = (event.detail ?? {}) as Record<string, unknown>;
  const c = d.card as Record<string, unknown> | null | undefined;
  const card =
    c && typeof c === 'object' && typeof c.title === 'string'
      ? {
          key: Number(c.key),
          title: c.title,
          url: typeof c.url === 'string' ? c.url : null,
        }
      : null;
  return {
    rule: typeof d.rule === 'string' ? d.rule : '',
    card,
    text: typeof d.text === 'string' ? d.text : '',
  };
}

// A card as a chat names it: "#48 Publish pricing page".
const cardLabel = (card: NonNullable<AutomationDetail['card']>) =>
  Number.isInteger(card.key) ? `#${card.key} ${card.title}` : card.title;

/** The one sentence a chat shows for an event: "Ada moved “Fix sign-in” from Doing to Done on “Sprint 4”". */
export function summaryOf(event: DeliveryEvent): string {
  const who = event.actorName?.trim() || 'Someone';
  const d = event.detail ?? {};
  const item = quoted(event.title);
  switch (event.type) {
    case 'renamed':
      return d.from ? `${who} renamed ${quoted(d.from)} to ${item}` : `${who} renamed ${item}`;
    case 'moved':
      return d.folderName
        ? `${who} moved ${item} to ${quoted(d.folderName)}`
        : `${who} moved ${item}`;
    case 'trashed':
      return `${who} moved ${item} to the Trash`;
    case 'shared':
      return d.level ? `${who} shared ${item} (${d.level} link)` : `${who} shared ${item}`;
    case 'commented':
      return d.text
        ? `${who} commented on ${item}: ${cut(d.text, CHAT_TEXT_MAX)}`
        : `${who} commented on ${item}`;
    case 'action_assigned':
      return `${who} assigned ${quoted(d.action ?? '')} to ${d.assigneeName || 'someone'} on ${item}`;
    case 'action_done':
      return `${who} finished ${quoted(d.action ?? '')} on ${item}`;
    case 'card_moved':
      return `${who} moved ${quoted(d.card ?? '')} from ${d.from ?? '?'} to ${d.to ?? '?'} on ${item}`;
    case 'form_response': {
      const count = Number(d.responses) || 1;
      const form = quoted(d.form ?? '');
      return `${count === 1 ? 'A new response' : `${count} new responses`} to ${form} on ${item}`;
    }
    case 'automation':
      return automationOf(event).text;
    case 'ping':
      return `Test from liveworkspace: “${event.title}” is set up and working.`;
  }
}

// The app's name as a chat shows it ("livediagram"), or liveworkspace's.
const appName = (app: string) => (app.startsWith('live') ? app : 'liveworkspace');

const footerOf = (event: DeliveryEvent) =>
  event.type === 'automation'
    ? `${WEBHOOK_EVENT_LABELS.automation} · ${automationOf(event).rule}`
    : `${appName(event.app)} · ${WEBHOOK_EVENT_LABELS[event.type]}`;

// What a chat message links to: an automation send's card when it has a link, else the item's.
const linkOf = (event: DeliveryEvent) =>
  (event.type === 'automation' ? automationOf(event).card?.url : null) ?? event.url;

// The card an automation send is about, for a chat's line above the link; null for any other event.
const cardOf = (event: DeliveryEvent) =>
  event.type === 'automation' ? automationOf(event).card : null;

/** The plain endpoint's event: `{id, type, occurredAt, app, item, actor, detail}`. */
export function jsonBodyOf(event: DeliveryEvent, detail = event.detail): unknown {
  return {
    id: event.eventId,
    type: event.type,
    occurredAt: new Date(event.occurredAt).toISOString(),
    app: event.app,
    item: event.itemId ? { id: event.itemId, title: event.title, url: event.url } : null,
    actor: { id: event.actorId, name: event.actorName },
    detail,
  };
}

// Slack's mrkdwn treats these three as control characters.
const slackEscape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A Slack incoming webhook's message: the sentence, a link back, and the app and event beneath. */
export function slackBodyOf(event: DeliveryEvent, summary = summaryOf(event)): unknown {
  const url = linkOf(event);
  const card = cardOf(event);
  const open = url ? `<${url}|Open in ${appName(event.app)}>` : '';
  const label = card ? slackEscape(cardLabel(card)) : '';
  const line = [label, open].filter(Boolean).join(' · ');
  const link = line ? `\n${line}` : '';
  return {
    // The notification and preview text: Slack reads its markup too, so a title can't ping a channel or hide a link.
    text: slackEscape(summary),
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${slackEscape(summary)}${link}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: slackEscape(footerOf(event)) }] },
    ],
  };
}

/** A Teams Workflows webhook's message: one Adaptive Card with the sentence, the app and event, and a button back. */
export function teamsBodyOf(event: DeliveryEvent, summary = summaryOf(event)): unknown {
  const url = linkOf(event);
  const card = cardOf(event);
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: summary, wrap: true },
            ...(card
              ? [{ type: 'TextBlock', text: cardLabel(card), weight: 'Bolder', wrap: true }]
              : []),
            {
              type: 'TextBlock',
              text: footerOf(event),
              isSubtle: true,
              size: 'Small',
              spacing: 'None',
              wrap: true,
            },
          ],
          actions: url
            ? [{ type: 'Action.OpenUrl', title: `Open in ${appName(event.app)}`, url }]
            : [],
        },
      },
    ],
  };
}

const bytesOf = (text: string) => new TextEncoder().encode(text).length;

function shortened(detail: DeliveryEvent['detail']): DeliveryEvent['detail'] {
  if (!detail) return detail;
  return Object.fromEntries(
    // A nested value (an automation send's card) is kept as it is: its texts were cut when it was queued.
    Object.entries(detail).map(([k, v]) => [
      k,
      typeof v === 'string' ? cut(v, DETAIL_TEXT_MAX) : v,
    ]),
  );
}

/** The body a webhook of `kind` is sent, within WEBHOOK_PAYLOAD_MAX_BYTES: the detail's text shortened first, then
 *  dropped (for a chat, the sentence cut). */
export function bodyFor(kind: WebhookKind, event: DeliveryEvent): string {
  const fits = (text: string) => bytesOf(text) <= WEBHOOK_PAYLOAD_MAX_BYTES;
  if (kind === 'json') {
    for (const detail of [event.detail, shortened(event.detail), null]) {
      const text = JSON.stringify(jsonBodyOf(event, detail));
      if (fits(text)) return text;
    }
    return JSON.stringify(jsonBodyOf({ ...event, title: cut(event.title, 200) }, null));
  }
  const make = kind === 'slack' ? slackBodyOf : teamsBodyOf;
  const full = JSON.stringify(make(event));
  if (fits(full)) return full;
  return JSON.stringify(
    make({ ...event, title: cut(event.title, 200) }, cut(summaryOf(event), 2000)),
  );
}
