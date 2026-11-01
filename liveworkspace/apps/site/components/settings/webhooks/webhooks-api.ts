// Settings › Webhooks' side of the index (liveworkspace/docs/specs/004-index/webhooks.md "Routes"): the person's client,
// asking as the Explorer does (the workspace token, on liveworkspace.app and on an app's address alike), what each
// refusal tells the person, and the words for each kind, pause and delivery.

import {
  createIndexClient,
  IndexError,
  WEBHOOK_EVENT_LABELS,
  type Webhook,
  type WebhookDelivery,
  type WebhookKind,
  type WebhookPauseReason,
} from '@liveworkspace/index-client';
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

export const KIND_LABELS: Record<WebhookKind, string> = {
  json: 'Webhook',
  slack: 'Slack',
  teams: 'Microsoft Teams',
};

// What the URL field asks for, by where it sends.
export const KIND_HINTS: Record<WebhookKind, { placeholder: string; help: string }> = {
  json: {
    placeholder: 'https://example.com/hooks/liveworkspace',
    help: 'Any HTTPS address you run. Each delivery is signed JSON, so you can check it came from us.',
  },
  slack: {
    placeholder: 'https://hooks.slack.com/services/…',
    help: 'In Slack, add an Incoming Webhook to the channel and paste its URL.',
  },
  teams: {
    placeholder: 'https://…logic.azure.com/workflows/…',
    help: 'In the Teams channel, add the Workflows template “Post to a channel when a webhook request is received” and paste its URL.',
  },
};

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
  offline: 'Couldn’t reach liveworkspace. Check your connection and try again.',
};

export function webhookError(error: string, kind: WebhookKind = 'json'): string {
  if (error === 'webhook_url_invalid') return URL_INVALID[kind];
  return MESSAGES[error] ?? 'Something went wrong. Please try again.';
}

const PAUSES: Record<WebhookPauseReason, string> = {
  paused: 'Paused',
  creator_left: 'Paused: whoever added it no longer runs the team',
  failing: 'Paused: 20 deliveries in a row failed',
  gone: 'Paused: the address said it’s gone',
};

/** The webhook's state, as its row's pill says it. */
export function stateOf(webhook: Webhook): { label: string; tone: 'live' | 'paused' | 'warn' } {
  if (webhook.pausedAt === null) return { label: 'Active', tone: 'live' };
  const reason = webhook.pausedReason ?? 'paused';
  return { label: PAUSES[reason], tone: reason === 'paused' ? 'paused' : 'warn' };
}

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

export function deliveryLine(d: WebhookDelivery): string {
  const status = d.status !== null ? `${d.status}` : null;
  const why = d.error ? (ERRORS[d.error] ?? d.error) : null;
  const detail = [status, why].filter(Boolean).join(', ');
  if (d.state === 'delivered') return status ? `Delivered (${status})` : 'Delivered';
  if (d.state === 'failed') return detail ? `Failed: ${detail}` : 'Failed';
  return d.attempts > 0 ? `Retrying${detail ? ` after ${detail}` : ''}` : 'Waiting to send';
}

export const deliveryTypeLabel = (d: WebhookDelivery): string =>
  WEBHOOK_EVENT_LABELS[d.type] ?? d.type;
