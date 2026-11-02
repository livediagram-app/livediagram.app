// Settings › Webhooks' side of the index (liveworkspace/docs/specs/004-index/webhooks.md "Routes"): the person's client,
// asking as the Explorer does (the workspace token, on liveworkspace.app and on an app's address alike), what each
// refusal tells the person, and the words for each destination, event, pause and delivery, written for someone who
// has never met a webhook (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks).

import {
  createIndexClient,
  IndexError,
  WEBHOOK_EVENT_LABELS,
  type Webhook,
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookKind,
  type WebhookPauseReason,
} from '@liveworkspace/index-client';
import { formatRelativeTime } from '@liveworkspace/ui';
import { DAY_MONTH } from '@liveworkspace/ui/date-format';
import { workspaceToken } from '@/lib/explorer/token';

export const webhooksClient = createIndexClient({ getToken: workspaceToken });

export type WebhookResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** A client call as a result: an index refusal by its code, anything else (no network) `offline`. */
export async function attempt<T>(run: () => Promise<T>): Promise<WebhookResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (err) {
    return { ok: false, error: err instanceof IndexError ? String(err.code) : 'offline' };
  }
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

/** The events in groups a person recognises, each with a line saying when it fires. */
export const EVENT_GROUPS: readonly {
  id: EventGroupId;
  label: string;
  events: readonly { event: WebhookEvent; label: string; hint: string }[];
}[] = [
  {
    id: 'items',
    label: 'Items',
    events: [
      { event: 'created', label: 'Item Created', hint: 'Something new is made or copied' },
      { event: 'renamed', label: 'Item Renamed', hint: 'Its name changes' },
      { event: 'moved', label: 'Item Moved', hint: 'It moves to another folder or space' },
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
    label: 'Actions and Cards',
    events: [
      {
        event: 'action_assigned',
        label: 'Action or Card Assigned',
        hint: 'Someone is given an action or a card',
      },
      { event: 'action_done', label: 'Action or Card Done', hint: 'An action or card is done' },
      { event: 'card_moved', label: 'Card Moved', hint: 'A card moves to another column' },
    ],
  },
];

// The events only one app sends, which name it by its logo.
export const EVENT_APP: Partial<Record<WebhookEvent, 'liveplanner'>> = {
  card_moved: 'liveplanner',
};

const EVENT_NAMES = new Map(EVENT_GROUPS.flatMap((g) => g.events.map((e) => [e.event, e.label])));

/** An event or a delivery's type, by its name in Settings (the app it comes from, where only one sends it, is drawn
 *  beside it as that app's logo). */
export const eventName = (type: WebhookDelivery['type']): string =>
  EVENT_NAMES.get(type as WebhookEvent) ?? (type === 'ping' ? 'Test' : WEBHOOK_EVENT_LABELS[type]);

// ---------- Refusals --------------------------------------------------------------------------------------------

const URL_INVALID: Record<WebhookKind, string> = {
  json: 'Use an https:// address on the standard port, with no user name or password in it.',
  slack: 'That isn’t a Slack incoming webhook. It starts https://hooks.slack.com/services/.',
  teams: 'That isn’t a Teams Workflows webhook. It’s on logic.azure.com or powerplatform.com.',
};

const MESSAGES: Record<string, string> = {
  invalid_webhook: 'Give it a name and pick at least one event.',
  webhook_url_private:
    'That address is on a private or internal network. Use one the internet can reach.',
  webhook_limit: 'There can be up to 10 webhooks here. Delete one to add another.',
  webhook_not_found: 'That webhook is no longer there. It may have changed elsewhere.',
  webhook_paused: 'Resume it to send a test.',
  webhooks_unavailable: 'Webhooks aren’t available just now. Try again in a minute.',
  webhooks_need_account: 'Sign in to your account to manage webhooks.',
  not_team_admin: 'Only the team’s admins can add webhooks for it.',
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
    'It paused because whoever added it no longer runs the team. Resume it to send as you.',
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
