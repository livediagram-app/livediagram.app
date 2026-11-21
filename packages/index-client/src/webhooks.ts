// Connections, once Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): an address one item's automation rules
// send messages through. The names, limits and wire shapes the index, the Connections list and each app's rules
// agree on; the identifiers keep the word webhook, as the index's routes, tables and codes do.

import type { App } from './constants';

/** What a delivery can be: an automation rule's message, or Send Test's `ping`. A connection hears no events. */
export type WebhookDeliveryType = 'automation' | 'ping';

/** Each delivery type as Recent Deliveries and a chat's footer name it. */
export const WEBHOOK_EVENT_LABELS: Record<WebhookDeliveryType, string> = {
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
// Card moves one push may carry. The index takes the push and drops it (connections hear no events): here until
// @liveworkspace/index-app's outbox stops sending it.
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

/** An item's connection as its list shows it: never its URL or secret, only the URL's host. */
export type Webhook = {
  id: string;
  // The item it belongs to, and its app.
  itemId: string;
  app: App;
  name: string;
  kind: WebhookKind;
  host: string;
  // Whether the person asking added it (or resumed it last): "Added by you".
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
  /** @deprecated A connection hears no events: ignored by the index. */
  events?: readonly string[];
  /** @deprecated Ignored by the index. */
  who?: 'anyone' | 'me';
};

export type UpdateWebhookInput = {
  name?: string;
  paused?: boolean;
  /** @deprecated A connection hears no events: ignored by the index. */
  events?: readonly string[];
  /** @deprecated Ignored by the index. */
  who?: 'anyone' | 'me';
};

/** One card that changed status, as liveplanner pushes it (`PUT /app/items/:id/card-moves`). The index answers 204
 *  and does nothing with it. */
export type CardMove = {
  cardId: string;
  cardKey: number | null;
  // The card's title.
  card: string;
  from: string;
  to: string;
  // Who moved it: their id and their name.
  actorId?: string | null;
  actorName?: string | null;
  at: number;
};

/** What a rule's message is about: a card or a tab. `ref` is how the item numbers it ("WI-48", "#48"; a tab has
 *  none), `url` a link that opens it in its app (dropped by the index unless it is on that app's origin). */
export type AutomationSendSubject = { ref?: string; title: string; url: string };

/** One message an automation rule posts through one of its item's connections, as the item's app pushes it
 *  (`POST /app/items/:id/automation-sends`, webhooks.md "Automation sends"). */
export type AutomationSend = {
  // Made from the run and the step: the same key again queues nothing new.
  key: string;
  // The connection the rule names, one of the item's own.
  webhookId: string;
  // The rule's name.
  rule: string;
  // What the run is about, or null (or absent) for the item alone.
  subject?: AutomationSendSubject | null;
  /** @deprecated Send `subject`. Read only when `subject` is absent: `ref` is the card's ref, else `#<key>`. */
  card?: { key: number; ref?: string; title: string; url: string } | null;
  // The message, the rule's values filled in.
  text: string;
  at: number;
};

/** Why a send was refused: the connection is not the item's (or gone), it is paused, or it holds
 *  WEBHOOK_PENDING_MAX. */
export type AutomationSendRefusal = 'webhook_not_found' | 'webhook_paused' | 'webhook_full';

/** One send's answer, in the order sent: queued, or refused with words for the rule's Audit Trail. */
export type AutomationSendResult =
  | { key: string; queued: true }
  | { key: string; queued: false; reason: string; code: AutomationSendRefusal };
