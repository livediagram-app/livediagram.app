// Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): what a person's or a team's items do, sent to another tool
// as it happens. The names, limits and wire shapes the index, the Settings panel and liveplanner's card moves agree on.

/** The events a webhook can listen for: the Timeline's item events, and liveplanner's card moves. */
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
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** What a delivery can be about: an event, or Send Test's `ping`. */
export type WebhookDeliveryType = WebhookEvent | 'ping';

export const isWebhookEvent = (value: unknown): value is WebhookEvent =>
  (WEBHOOK_EVENTS as readonly unknown[]).includes(value);

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
  events: WebhookEvent[];
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
  // Absent or null: the person's own items.
  teamId?: string | null;
};

export type UpdateWebhookInput = { name?: string; events?: WebhookEvent[]; paused?: boolean };

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
