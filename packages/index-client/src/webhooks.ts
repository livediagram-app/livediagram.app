// Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): what happens to one document, sent to another tool as it
// happens. The names, limits and wire shapes the index, the document's Webhooks dialog and liveplanner's card moves
// agree on.

import { APPS, type App } from './constants';

/** The events a webhook can listen for: what can happen to an existing document (the Timeline's item events after
 *  it is made) and liveplanner's card moves and form responses. */
export const WEBHOOK_EVENTS = [
  'renamed',
  'moved',
  'trashed',
  'shared',
  'commented',
  'action_assigned',
  'action_done',
  'card_moved',
  'form_response',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** What a delivery can be about: an event, an automation rule's addressed send (never one a webhook picks), or Send
 *  Test's `ping`. */
export type WebhookDeliveryType = WebhookEvent | 'automation' | 'ping';

export const isWebhookEvent = (value: unknown): value is WebhookEvent =>
  (WEBHOOK_EVENTS as readonly unknown[]).includes(value);

/** Which apps send each event: every app has documents (the Timeline's events) and pushes its comment threads and
 *  actions; card moves and form responses are liveplanner's alone. */
export const WEBHOOK_EVENT_APPS: Record<WebhookEvent, readonly App[]> = {
  renamed: APPS,
  moved: APPS,
  trashed: APPS,
  shared: APPS,
  commented: APPS,
  action_assigned: APPS,
  action_done: APPS,
  card_moved: ['liveplanner'],
  form_response: ['liveplanner'],
};

/** The events a document of `app` can send, in WEBHOOK_EVENTS order. */
export const webhookEventsOf = (app: App): WebhookEvent[] =>
  WEBHOOK_EVENTS.filter((event) => WEBHOOK_EVENT_APPS[event].includes(app));

/** Whose actions a webhook reports: anyone's, or only its creator's. */
export const WEBHOOK_WHO = ['anyone', 'me'] as const;
export type WebhookWho = (typeof WEBHOOK_WHO)[number];

export const isWebhookWho = (value: unknown): value is WebhookWho =>
  (WEBHOOK_WHO as readonly unknown[]).includes(value);

/** Each event as the dialog's fallback names it (the dialog names an item event by its app's own word). */
export const WEBHOOK_EVENT_LABELS: Record<WebhookDeliveryType, string> = {
  renamed: 'Renamed',
  moved: 'Moved',
  trashed: 'Moved to the Trash',
  shared: 'Share Link Made',
  commented: 'Comment Added',
  action_assigned: 'Action or Card Assigned',
  action_done: 'Action or Card Done',
  card_moved: 'Card Moved',
  form_response: 'Form Response',
  automation: 'Automation',
  ping: 'Test',
};

/** Where a webhook sends: any HTTPS endpoint (signed JSON), a Slack incoming webhook, a Teams Workflows webhook. */
export const WEBHOOK_KINDS = ['json', 'slack', 'teams'] as const;
export type WebhookKind = (typeof WEBHOOK_KINDS)[number];

export const isWebhookKind = (value: unknown): value is WebhookKind =>
  (WEBHOOK_KINDS as readonly unknown[]).includes(value);

// Why a webhook is paused: by a person, its creator no longer able to edit the document, 20 deliveries in a row given
// up, or the endpoint answered 410 Gone.
export type WebhookPauseReason = 'paused' | 'creator_left' | 'failing' | 'gone';

// Limits: webhooks per document, a name's length, a URL's length, a delivery's body, the finished deliveries kept per
// webhook, and the pending ones it may hold.
export const WEBHOOKS_PER_DOCUMENT_MAX = 10;
export const WEBHOOK_NAME_MAX = 80;
export const WEBHOOK_URL_MAX = 2048;
export const WEBHOOK_PAYLOAD_MAX_BYTES = 16 * 1024;
export const WEBHOOK_DELIVERIES_KEPT = 20;
export const WEBHOOK_PENDING_MAX = 500;
// Card moves one push may carry.
export const CARD_MOVES_MAX = 100;
// Automation sends one push may carry, and how long a send's message and rule name may be (longer is cut).
export const AUTOMATION_SENDS_MAX = 5;
export const AUTOMATION_TEXT_MAX = 2000;
export const AUTOMATION_RULE_MAX = 60;

// The headers a signed delivery carries.
export const WEBHOOK_SIGNATURE_HEADER = 'X-Liveworkspace-Signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'X-Liveworkspace-Timestamp';
export const WEBHOOK_EVENT_HEADER = 'X-Liveworkspace-Event';
export const WEBHOOK_DELIVERY_HEADER = 'X-Liveworkspace-Delivery';

/** A document's webhook as its dialog lists it: never its URL or secret, only the URL's host. */
export type Webhook = {
  id: string;
  // The document it reports on, and its app.
  itemId: string;
  app: App;
  name: string;
  kind: WebhookKind;
  host: string;
  // The events it sends, in WEBHOOK_EVENTS order.
  events: WebhookEvent[];
  // Whose actions: anyone's, or only its creator's.
  who: WebhookWho;
  // Whether the person asking added it (or resumed it last), so Only Me reads "Only You" to them.
  mine: boolean;
  createdAt: number;
  pausedAt: number | null;
  pausedReason: WebhookPauseReason | null;
  // The newest finished delivery, or null before the first.
  lastDelivery: { state: 'delivered' | 'failed'; status: number | null; at: number } | null;
};

export type WebhookDeliveryState = 'pending' | 'delivered' | 'failed';

/** One delivery in a webhook's recent list. `status`: the last response code, null when none came (`error` says
 *  why: a timeout, a refused address, a redirect). */
export type WebhookDelivery = {
  id: number;
  type: WebhookDeliveryType;
  // The app the event came from; `liveworkspace` for a test.
  app: App | 'liveworkspace';
  title: string;
  state: WebhookDeliveryState;
  attempts: number;
  status: number | null;
  error: string | null;
  occurredAt: number;
  lastAttemptAt: number | null;
  nextAttemptAt: number | null;
};

export type CreateWebhookInput = {
  name: string;
  kind: WebhookKind;
  url: string;
  events: WebhookEvent[];
  // Absent: anyone.
  who?: WebhookWho;
};

export type UpdateWebhookInput = {
  name?: string;
  events?: WebhookEvent[];
  who?: WebhookWho;
  paused?: boolean;
};

/** One card that changed status, as liveplanner pushes it (`PUT /app/items/:id/card-moves`). */
export type CardMove = {
  cardId: string;
  cardKey: number | null;
  // The card's title.
  card: string;
  from: string;
  to: string;
  // Who moved it: their id (an account's for Only Me), and their name.
  actorId?: string | null;
  actorName?: string | null;
  at: number;
};

/** One message an automation rule posts through one of its plan's webhooks, as liveplanner pushes it
 *  (`POST /app/items/:id/automation-sends`, webhooks.md "Automation sends"). */
export type AutomationSend = {
  // Made from the run and the step: the same key again queues nothing new.
  key: string;
  // The webhook the rule names, one of the plan's own.
  webhookId: string;
  // The rule's name.
  rule: string;
  // The card the rule ran on (its number, title and link in liveplanner), or null for none.
  card: { key: number; title: string; url: string } | null;
  // The message, the rule's values filled in.
  text: string;
  at: number;
};

/** Why a send was refused: the webhook is not the plan's (or gone), it is paused, or it holds WEBHOOK_PENDING_MAX. */
export type AutomationSendRefusal = 'webhook_not_found' | 'webhook_paused' | 'webhook_full';

/** One send's answer, in the order sent: queued, or refused with words for the rule's Audit Trail. */
export type AutomationSendResult =
  | { key: string; queued: true }
  | { key: string; queued: false; reason: string; code: AutomationSendRefusal };
