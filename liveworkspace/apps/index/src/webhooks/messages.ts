// What a delivery says (liveworkspace/docs/specs/004-index/webhooks.md "Destinations"): the signed JSON event for a
// plain endpoint, a Slack message, or a Teams Adaptive Card. A connection sends two things only: a rule's message
// ("Automation sends": the rule's own words, with its subject and rule beneath) and Send Test's ping. Every body is
// capped at WEBHOOK_PAYLOAD_MAX_BYTES.

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
  // The item's link in its app, or null for none (a test).
  url: string | null;
};

// A detail value cut to this before anything is dropped.
const DETAIL_TEXT_MAX = 500;

const cut = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** What a rule's send is about: a card or a tab, by its reference ("WI-48", "#48"; a tab has none), title and link. */
export type AutomationSubject = { ref?: string; title: string; url: string | null };

/** An automation send's detail as the outbox wrote it. */
export type AutomationDetail = {
  rule: string;
  subject: AutomationSubject | null;
  // liveplanner's alone, beside a subject that is a card: the card as receivers read it before subjects.
  card?: { key: number; ref?: string; title: string; url: string | null };
  text: string;
};

// The detail is parsed JSON, so each part is checked before it is used.
function automationOf(event: DeliveryEvent): AutomationDetail {
  const d = (event.detail ?? {}) as Record<string, unknown>;
  const s = d.subject as Record<string, unknown> | null | undefined;
  const subject =
    s && typeof s === 'object' && typeof s.title === 'string'
      ? {
          ...(typeof s.ref === 'string' ? { ref: s.ref } : {}),
          title: s.title,
          url: typeof s.url === 'string' ? s.url : null,
        }
      : null;
  return {
    rule: typeof d.rule === 'string' ? d.rule : '',
    subject,
    text: typeof d.text === 'string' ? d.text : '',
  };
}

// A subject as a chat names it: "WI-48 Publish pricing page", or a tab's title alone.
const subjectLabel = (subject: AutomationSubject) =>
  subject.ref ? `${subject.ref} ${subject.title}` : subject.title;

/** The one sentence a chat shows: a rule's message as it wrote it, or Send Test's. */
export function summaryOf(event: DeliveryEvent): string {
  return event.type === 'automation'
    ? automationOf(event).text
    : `Test from liveworkspace: “${event.title}” is set up and working.`;
}

// The app's name as a chat shows it ("livediagram"), or liveworkspace's.
const appName = (app: string) => (app.startsWith('live') ? app : 'liveworkspace');

const footerOf = (event: DeliveryEvent) =>
  event.type === 'automation'
    ? `${WEBHOOK_EVENT_LABELS.automation} · ${automationOf(event).rule}`
    : `${appName(event.app)} · ${WEBHOOK_EVENT_LABELS[event.type]}`;

// What a chat message links to: an automation send's subject when it has a link, else the item's.
const linkOf = (event: DeliveryEvent) =>
  (event.type === 'automation' ? automationOf(event).subject?.url : null) ?? event.url;

// What an automation send is about, for a chat's line above the link; null for a test.
const subjectOf = (event: DeliveryEvent) =>
  event.type === 'automation' ? automationOf(event).subject : null;

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

// The most a Slack section's text may hold: past it Slack refuses the whole message (invalid_blocks).
export const SLACK_SECTION_MAX = 3000;

/** Escaped text cut to `max` characters with an ellipsis: never inside an escape (`&am`) or a surrogate pair. */
export function slackCut(escaped: string, max: number): string {
  if (escaped.length <= max) return escaped;
  let head = escaped.slice(0, Math.max(0, max - 1));
  const amp = head.lastIndexOf('&');
  if (amp >= 0 && !head.includes(';', amp)) head = head.slice(0, amp);
  const last = head.charCodeAt(head.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) head = head.slice(0, -1);
  return `${head}…`;
}

/** A Slack incoming webhook's message: the sentence, a link back, and what sent it beneath. */
export function slackBodyOf(event: DeliveryEvent, summary = summaryOf(event)): unknown {
  const url = linkOf(event);
  const subject = subjectOf(event);
  const open = url ? `<${url}|Open in ${appName(event.app)}>` : '';
  const label = subject ? slackEscape(subjectLabel(subject)) : '';
  const line = [label, open].filter(Boolean).join(' · ');
  const link = line ? `\n${line}` : '';
  // Escaping can make a 2,000-character message five times longer: cut so the section stays within Slack's limit.
  const said = slackCut(slackEscape(summary), SLACK_SECTION_MAX - link.length);
  return {
    // The notification and preview text: Slack reads its markup too, so a title can't ping a channel or hide a link.
    text: slackEscape(summary),
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${said}${link}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: slackEscape(footerOf(event)) }] },
    ],
  };
}

// A text as Teams shows it: a TextRun in a RichTextBlock, which Teams never reads as Markdown (a TextBlock does), so a
// title like [Reset your password](https://…) is those characters and never a link.
const teamsText = (
  text: string,
  style: Record<string, unknown> = {},
  block: Record<string, unknown> = {},
) => ({
  type: 'RichTextBlock',
  ...block,
  inlines: [{ type: 'TextRun', text, ...style }],
});

/** A Teams Workflows webhook's message: one Adaptive Card with the sentence, what sent it, and a button back. */
export function teamsBodyOf(event: DeliveryEvent, summary = summaryOf(event)): unknown {
  const url = linkOf(event);
  const subject = subjectOf(event);
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
            teamsText(summary),
            ...(subject ? [teamsText(subjectLabel(subject), { weight: 'Bolder' })] : []),
            teamsText(footerOf(event), { isSubtle: true, size: 'Small' }, { spacing: 'None' }),
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
    // A nested value (an automation send's subject) is kept as it is: its texts were cut when it was queued.
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
