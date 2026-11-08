// Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): what a person's or a team's items do, sent to another tool
// as it happens. The names, limits and wire shapes the index, the Settings panel and liveplanner's card moves agree on.

import { APPS, type App } from './constants';

/** The events a webhook can listen for: the Timeline's item events, liveplanner's card moves and form responses, and
 *  @-mentions in any app's comments. */
export const WEBHOOK_EVENTS = [
  'created',
  'renamed',
  'moved',
  'trashed',
  'shared',
  'commented',
  'action_assigned',
  'action_done',
  'card_moved',
  'form_response',
  'mention',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** What a delivery can be about: an event, or Send Test's `ping`. */
export type WebhookDeliveryType = WebhookEvent | 'ping';

export const isWebhookEvent = (value: unknown): value is WebhookEvent =>
  (WEBHOOK_EVENTS as readonly unknown[]).includes(value);

/** Which apps send each event: every app has items (the Timeline's events) and pushes its comment threads and
 *  actions (comments, actions, mentions); card moves and form responses are liveplanner's alone. */
export const WEBHOOK_EVENT_APPS: Record<WebhookEvent, readonly App[]> = {
  created: APPS,
  renamed: APPS,
  moved: APPS,
  trashed: APPS,
  shared: APPS,
  commented: APPS,
  action_assigned: APPS,
  action_done: APPS,
  card_moved: ['liveplanner'],
  form_response: ['liveplanner'],
  mention: APPS,
};

/** What a webhook subscribes to: one app's event (`livediagram:shared`), never a bare event across every app. */
export type WebhookTopic = `${App}:${WebhookEvent}`;

export const topicOf = (app: App, event: WebhookEvent): WebhookTopic => `${app}:${event}`;

/** Every topic, app by app in APPS order, each app's events in WEBHOOK_EVENTS order: the order a list is kept in. */
export const WEBHOOK_TOPICS: readonly WebhookTopic[] = APPS.flatMap((app) =>
  WEBHOOK_EVENTS.filter((event) => WEBHOOK_EVENT_APPS[event].includes(app)).map((event) =>
    topicOf(app, event),
  ),
);

const TOPICS: ReadonlySet<string> = new Set(WEBHOOK_TOPICS);

export const isWebhookTopic = (value: unknown): value is WebhookTopic =>
  typeof value === 'string' && TOPICS.has(value);

/** A topic's app and event. */
export function splitTopic(topic: WebhookTopic): { app: App; event: WebhookEvent } {
  const at = topic.indexOf(':');
  return { app: topic.slice(0, at) as App, event: topic.slice(at + 1) as WebhookEvent };
}

/** A topic as given, or a bare event (stored before topics, or sent by an older Settings) as that event from every
 *  app that sends it; anything else, nothing. */
export function topicsOf(value: unknown): WebhookTopic[] {
  if (isWebhookTopic(value)) return [value];
  if (isWebhookEvent(value)) return WEBHOOK_EVENT_APPS[value].map((app) => topicOf(app, value));
  return [];
}

/** Topics de-duplicated and kept in WEBHOOK_TOPICS order. */
export function orderedTopics(topics: Iterable<string>): WebhookTopic[] {
  const held = new Set(topics);
  return WEBHOOK_TOPICS.filter((topic) => held.has(topic));
}

/** The topics of one app in a list. */
export const topicsForApp = (topics: readonly WebhookTopic[], app: App): WebhookTopic[] =>
  topics.filter((topic) => topic.startsWith(`${app}:`));

/** Each event as Settings names it. */
export const WEBHOOK_EVENT_LABELS: Record<WebhookDeliveryType, string> = {
  created: 'Item Created',
  renamed: 'Item Renamed',
  moved: 'Item Moved',
  trashed: 'Item Moved to the Trash',
  shared: 'Share Link Made',
  commented: 'Comment Added',
  action_assigned: 'Action or Card Assigned',
  action_done: 'Action or Card Done',
  card_moved: 'Card Moved (liveplanner)',
  form_response: 'Form Response (liveplanner)',
  mention: 'Mentioned',
  ping: 'Test',
};

/** Where a webhook sends: any HTTPS endpoint (signed JSON), a Slack incoming webhook, a Teams Workflows webhook. */
export const WEBHOOK_KINDS = ['json', 'slack', 'teams'] as const;
export type WebhookKind = (typeof WEBHOOK_KINDS)[number];

export const isWebhookKind = (value: unknown): value is WebhookKind =>
  (WEBHOOK_KINDS as readonly unknown[]).includes(value);

// Why a webhook is paused: by a person, its creator no longer a team admin, 20 deliveries in a row given up, or the
// endpoint answered 410 Gone.
export type WebhookPauseReason = 'paused' | 'creator_left' | 'failing' | 'gone';

// Limits: webhooks per scope, a name's length, a URL's length, a delivery's body, the finished deliveries kept per
// webhook, and the pending ones it may hold.
export const WEBHOOKS_PER_SCOPE_MAX = 10;
export const WEBHOOK_NAME_MAX = 80;
export const WEBHOOK_URL_MAX = 2048;
export const WEBHOOK_PAYLOAD_MAX_BYTES = 16 * 1024;
export const WEBHOOK_DELIVERIES_KEPT = 20;
export const WEBHOOK_PENDING_MAX = 500;
// Card moves one push may carry.
export const CARD_MOVES_MAX = 100;

// The headers a signed delivery carries.
export const WEBHOOK_SIGNATURE_HEADER = 'X-Liveworkspace-Signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'X-Liveworkspace-Timestamp';
export const WEBHOOK_EVENT_HEADER = 'X-Liveworkspace-Event';
export const WEBHOOK_DELIVERY_HEADER = 'X-Liveworkspace-Delivery';

/** A webhook as Settings lists it: never its URL or secret, only the URL's host. */
export type Webhook = {
  id: string;
  name: string;
  kind: WebhookKind;
  // Null: the person's own items.
  teamId: string | null;
  host: string;
  // The app events it sends, in WEBHOOK_TOPICS order.
  events: WebhookTopic[];
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
  events: WebhookTopic[];
  // Absent or null: the person's own items.
  teamId?: string | null;
};

export type UpdateWebhookInput = { name?: string; events?: WebhookTopic[]; paused?: boolean };

/** One card that changed status, as liveplanner pushes it (`PUT /app/items/:id/card-moves`). */
export type CardMove = {
  cardId: string;
  cardKey: number | null;
  // The card's title.
  card: string;
  from: string;
  to: string;
  actorName?: string | null;
  at: number;
};
