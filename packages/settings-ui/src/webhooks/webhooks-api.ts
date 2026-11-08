// A document's webhooks against the index (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): the calls
// bound to the one document (and the share link the page holds for it, so an Editor through a link is let in), what
// each refusal tells the person, and the words for each destination, event, pause and delivery, written for someone
// who has never met a webhook.

import {
  APPS,
  IndexError,
  WEBHOOK_EVENT_APPS,
  WEBHOOK_EVENT_LABELS,
  webhookEventsOf,
  type App,
  type CreateWebhookInput,
  type IndexClient,
  type ShareAccess,
  type UpdateWebhookInput,
  type Webhook,
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookKind,
  type WebhookPauseReason,
  type WebhookWho,
} from '@liveworkspace/index-client';
import { APP_ITEMS } from '@liveworkspace/sites';
import { formatRelativeTime } from '@liveworkspace/ui';
import { DAY_MONTH } from '@liveworkspace/ui/date-format';
export type WebhookResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** A client call as a result: an index refusal by its code, anything else (no network) `offline`. */
export async function attempt<T>(run: () => Promise<T>): Promise<WebhookResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (err) {
    return { ok: false, error: err instanceof IndexError ? String(err.code) : 'offline' };
  }
}

/** The document's webhook calls, each as the index's client makes it, for this one item. */
export type DocumentWebhooksApi = {
  list: () => Promise<{ webhooks: Webhook[] }>;
  create: (input: CreateWebhookInput) => Promise<{ webhook: Webhook; secret: string | null }>;
  update: (id: string, input: UpdateWebhookInput) => Promise<{ webhook: Webhook }>;
  remove: (id: string) => Promise<void>;
  test: (id: string) => Promise<unknown>;
  deliveries: (id: string) => Promise<{ deliveries: WebhookDelivery[] }>;
};

/** The calls for one document, through the share link the page opened it with, when it did. */
export function documentWebhooksApi(
  client: IndexClient,
  itemId: string,
  share?: ShareAccess | null,
): DocumentWebhooksApi {
  const via = share ?? undefined;
  return {
    list: () => client.listWebhooks(itemId, via),
    create: (input) => client.createWebhook(itemId, input, via),
    update: (id, input) => client.updateWebhook(id, input, via),
    remove: (id) => client.deleteWebhook(id, via),
    test: (id) => client.testWebhook(id, via),
    deliveries: (id) => client.webhookDeliveries(id, via),
  };
}

// ---------- Where it posts --------------------------------------------------------------------------------------

/** Each destination as the person picks it: its name, a line on what arrives, and its address field. */
export const KINDS: Record<
  WebhookKind,
  {
    label: string;
    blurb: string;
    // The address field's label and example.
    field: string;
    placeholder: string;
    // How to get the address, step by step, or one line for a service the person runs.
    steps: readonly string[];
    // A name to suggest it, as the field's example.
    namePlaceholder: string;
  }
> = {
  slack: {
    label: 'Slack',
    blurb: 'A message in a channel',
    field: 'Slack Webhook URL',
    placeholder: 'https://hooks.slack.com/services/…',
    steps: [
      'Open api.slack.com/apps and create an app for your workspace, or pick one you have.',
      'Turn on Incoming Webhooks, choose Add New Webhook and pick the channel.',
      'Copy the webhook URL and paste it here.',
    ],
    namePlaceholder: 'Like “#launch channel”',
  },
  teams: {
    label: 'Microsoft Teams',
    blurb: 'A card in a channel',
    field: 'Teams Workflow URL',
    placeholder: 'https://…logic.azure.com/workflows/…',
    steps: [
      'In the Teams channel, open More options (…) and choose Workflows.',
      'Pick “Post to a channel when a webhook request is received” and follow its steps.',
      'Copy the URL it gives you and paste it here.',
    ],
    namePlaceholder: 'Like “Design team channel”',
  },
  json: {
    label: 'Your Own Service',
    blurb: 'Signed JSON to an address you run',
    field: 'HTTPS Address',
    placeholder: 'https://example.com/hooks/updates',
    steps: [
      'Any https:// address your service listens on. Each delivery is JSON, signed with a secret you get once it’s added, so you can check it came from us.',
    ],
    namePlaceholder: 'Like “Build server”',
  },
};

// The order the destinations are offered in: the chat tools first, as most people want one of them.
export const KIND_ORDER: readonly WebhookKind[] = ['slack', 'teams', 'json'];

// ---------- What it sends ---------------------------------------------------------------------------------------

export type EventGroupId = 'items' | 'sharing' | 'work';

type EventChoice = { event: WebhookEvent; label: string; hint: string };

/** The events in groups a person recognises, each with a line saying when it fires. A document is offered only the
 *  events its app sends (WEBHOOK_EVENT_APPS): card moves and forms are liveplanner's. */
export const EVENT_GROUPS: readonly {
  id: EventGroupId;
  label: string;
  events: readonly EventChoice[];
}[] = [
  {
    id: 'items',
    label: 'Items',
    events: [
      { event: 'renamed', label: 'Renamed', hint: 'Its name changes' },
      { event: 'moved', label: 'Moved', hint: 'It moves to another folder or space' },
      { event: 'trashed', label: 'Moved to the Trash', hint: 'It goes to the Trash' },
    ],
  },
  {
    id: 'sharing',
    label: 'Sharing and Comments',
    events: [
      { event: 'shared', label: 'Share Link Made', hint: 'Someone makes a link to share it' },
      { event: 'commented', label: 'Comment Added', hint: 'Someone comments or replies' },
    ],
  },
  {
    id: 'work',
    label: 'Actions, Cards and Forms',
    events: [
      {
        event: 'action_assigned',
        label: 'Action or Card Assigned',
        hint: 'Someone is given an action or a card',
      },
      { event: 'action_done', label: 'Action or Card Done', hint: 'An action or card is done' },
      { event: 'card_moved', label: 'Card Moved', hint: 'A card moves to another column' },
      { event: 'form_response', label: 'Form Response', hint: 'Someone fills in a form' },
    ],
  },
];

// Where an app has actions but no cards or forms, its words say so.
const NO_CARDS: Partial<Record<WebhookEvent, Pick<EventChoice, 'label' | 'hint'>>> = {
  action_assigned: { label: 'Action Assigned', hint: 'Someone is given an action' },
  action_done: { label: 'Action Done', hint: 'An action is done' },
};
const hasCards = (app: App) => WEBHOOK_EVENT_APPS.card_moved.includes(app);

// What each app's documents are (@liveworkspace/sites), so its events name them: a canvas, not an "item" (which
// reads like an element).
export const ITEM = (app: App): { one: string; many: string } => ({
  one: APP_ITEMS[app].noun,
  many: APP_ITEMS[app].nouns,
});

/** An app's own words for the document's events: "Canvas Renamed", "This canvas's name changes". */
function itemWords(app: App, choice: EventChoice): EventChoice {
  const { one } = ITEM(app);
  const lower = one.toLowerCase();
  switch (choice.event) {
    case 'renamed':
      return { ...choice, label: `${one} Renamed`, hint: `This ${lower}’s name changes` };
    case 'moved':
      return { ...choice, label: `${one} Moved`, hint: `This ${lower} moves to another folder` };
    case 'trashed':
      return {
        ...choice,
        label: `${one} Moved to the Trash`,
        hint: `This ${lower} goes to the Trash`,
      };
    case 'shared':
      return { ...choice, hint: `Someone makes a link to share this ${lower}` };
    default:
      return choice;
  }
}

/** One app's groups: only the events it sends, in its own words. Made once per app. */
export type AppEventGroup = { id: EventGroupId; label: string; events: readonly EventChoice[] };
const APP_GROUPS = new Map<App, readonly AppEventGroup[]>(
  APPS.map((app): [App, readonly AppEventGroup[]] => [
    app,
    EVENT_GROUPS.map((group) => ({
      id: group.id,
      label:
        group.id === 'items'
          ? `This ${ITEM(app).one}`
          : group.id === 'work' && !hasCards(app)
            ? 'Actions'
            : group.label,
      events: group.events
        .filter(({ event }) => WEBHOOK_EVENT_APPS[event].includes(app))
        .map((choice) => itemWords(app, choice))
        .map((choice) => (hasCards(app) ? choice : { ...choice, ...NO_CARDS[choice.event] })),
    })).filter((group) => group.events.length > 0),
  ]),
);

export const eventGroupsFor = (app: App): readonly AppEventGroup[] => APP_GROUPS.get(app)!;

/** Every event an app's documents send, in WEBHOOK_EVENTS order. */
export const eventsOfApp = webhookEventsOf;

const EVENT_NAMES = new Map<string, string>(
  APPS.flatMap((app) =>
    eventGroupsFor(app).flatMap((g) =>
      g.events.map((e): [string, string] => [`${app}:${e.event}`, e.label]),
    ),
  ),
);

/** An event by its name in the dialog, in the document's app's words ("Canvas Renamed"). */
export const eventName = (app: string, type: WebhookDelivery['type']): string =>
  EVENT_NAMES.get(`${app}:${type}`) ?? WEBHOOK_EVENT_LABELS[type] ?? type;

/** Who Did It: every editor's changes, or only those of whoever added it. */
export const WHO_CHOICES: readonly { who: WebhookWho; label: string; hint: string }[] = [
  { who: 'anyone', label: 'Anyone', hint: 'Whoever does it' },
  { who: 'me', label: 'Only Me', hint: 'Only what you do yourself' },
];

// ---------- Refusals --------------------------------------------------------------------------------------------

const URL_INVALID: Record<WebhookKind, string> = {
  json: 'Use an https:// address on the standard port, with no user name or password in it.',
  slack: 'That isn’t a Slack incoming webhook. It starts https://hooks.slack.com/services/.',
  teams: 'That isn’t a Teams Workflows webhook. It’s on logic.azure.com or powerplatform.com.',
};

const MESSAGES: Record<string, string> = {
  invalid_webhook: 'Give it a name and pick at least one event.',
  webhooks_need_editor:
    'Only people who can edit all of this document can manage its webhooks. Ask its owner for an Editor link.',
  not_found: 'This document is no longer there, or you can no longer open it.',
  forbidden: 'Only people who can edit all of this document can manage its webhooks.',
  webhook_url_private:
    'That address is on a private or internal network. Use one the internet can reach.',
  webhook_limit: 'A document can have up to 10 webhooks. Delete one to add another.',
  webhook_not_found: 'That webhook is no longer there. It may have changed elsewhere.',
  webhook_paused: 'Resume it to send a test.',
  webhooks_unavailable: 'Webhooks aren’t available just now. Try again in a minute.',
  webhooks_need_account: 'Sign in to your account to manage webhooks.',
  unauthorized: 'You’ve been signed out. Sign in again to carry on.',
  offline: 'Couldn’t connect. Check your connection and try again.',
};

export function webhookError(error: string, kind: WebhookKind = 'json'): string {
  if (error === 'webhook_url_invalid') return URL_INVALID[kind];
  return MESSAGES[error] ?? 'Something went wrong. Please try again.';
}

// ---------- State -----------------------------------------------------------------------------------------------

export type WebhookTone = 'live' | 'paused' | 'warn';

// Why it paused itself, and what to do about it.
const PAUSES: Record<Exclude<WebhookPauseReason, 'paused'>, string> = {
  creator_left:
    'It paused because whoever added it can no longer edit this document. Resume it to send as you.',
  failing:
    'It paused after 20 deliveries in a row failed. Check the address still works, then resume it.',
  gone: 'It paused because the address said it no longer exists. If the address changed, add the webhook again.',
};

/** The webhook's state: its badge, and, when it paused itself, why and what to do. */
export function stateOf(webhook: Webhook): { label: string; tone: WebhookTone; note?: string } {
  if (webhook.pausedAt === null) return { label: 'Active', tone: 'live' };
  const reason = webhook.pausedReason ?? 'paused';
  if (reason === 'paused') return { label: 'Paused', tone: 'paused' };
  return { label: 'Needs Attention', tone: 'warn', note: PAUSES[reason] };
}

// ---------- Deliveries ------------------------------------------------------------------------------------------

// Why a delivery failed or waits, in words.
const ERRORS: Record<string, string> = {
  timeout: 'no answer in 10 seconds',
  network: 'couldn’t connect',
  dns: 'the address didn’t resolve',
  private_address: 'the address is on a private network',
  redirect: 'it redirected, which isn’t followed',
  unreadable: 'its settings couldn’t be read',
  paused: 'the webhook was paused',
};

/** Why a delivery that got no 2xx went wrong, in words: the answer's code, the reason none came, or both. */
export function failureOf(d: Pick<WebhookDelivery, 'status' | 'error'>): string | null {
  const status = d.status !== null ? `answered ${d.status}` : null;
  const why = d.error ? (ERRORS[d.error] ?? d.error) : null;
  return [status, why].filter(Boolean).join(', ') || null;
}

export function deliveryLine(d: WebhookDelivery): string {
  if (d.state === 'delivered') return d.status !== null ? `Delivered (${d.status})` : 'Delivered';
  const failure = failureOf(d);
  if (d.state === 'failed') return failure ? `Failed: ${failure}` : 'Failed';
  return d.attempts > 0 ? `Retrying${failure ? ` after it ${failure}` : ''}` : 'Waiting to send';
}

/** "2 hours ago" (every list's shared wording), or the date past a week. */
export function whenOf(at: number, now: number): string {
  const ago = now - at;
  return ago < 0 || ago >= WEEK_MS ? DATE.format(at) : formatRelativeTime(ago);
}

const WEEK_MS = 7 * 86_400_000;
const DATE = DAY_MONTH;
