// What a delivery says (liveworkspace/docs/specs/004-index/webhooks.md "Destinations"): the signed JSON event for a
// plain endpoint, a Slack message, or a Teams Adaptive Card, each from the delivery's own copy of the event and
// never more than the Timeline detail the scope already sees. Every body is capped at WEBHOOK_PAYLOAD_MAX_BYTES.

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

/** The one sentence a chat shows for an event: "Ada moved “Fix sign-in” from Doing to Done on “Sprint 4”". */
export function summaryOf(event: DeliveryEvent): string {
  const who = event.actorName?.trim() || 'Someone';
  const d = event.detail ?? {};
  const item = quoted(event.title);
  switch (event.type) {
    case 'created':
      return `${who} made ${item}`;
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
    case 'ping':
      return `Test from liveworkspace: “${event.title}” is set up and working.`;
  }
}

// The app's name as a chat shows it ("livediagram"), or liveworkspace's.
const appName = (app: string) => (app.startsWith('live') ? app : 'liveworkspace');

const footerOf = (event: DeliveryEvent) =>
  `${appName(event.app)} · ${WEBHOOK_EVENT_LABELS[event.type]}`;

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
  const link = event.url ? `\n<${event.url}|Open in ${appName(event.app)}>` : '';
  return {
    text: summary,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${slackEscape(summary)}${link}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: slackEscape(footerOf(event)) }] },
    ],
  };
}

/** A Teams Workflows webhook's message: one Adaptive Card with the sentence, the app and event, and a button back. */
export function teamsBodyOf(event: DeliveryEvent, summary = summaryOf(event)): unknown {
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
            {
              type: 'TextBlock',
              text: footerOf(event),
              isSubtle: true,
              size: 'Small',
              spacing: 'None',
              wrap: true,
            },
          ],
          actions: event.url
            ? [{ type: 'Action.OpenUrl', title: `Open in ${appName(event.app)}`, url: event.url }]
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
    Object.entries(detail).map(([k, v]) => [k, v === null ? v : cut(v, DETAIL_TEXT_MAX)]),
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
