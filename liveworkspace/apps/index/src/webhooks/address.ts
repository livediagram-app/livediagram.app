// Where a webhook may send (liveworkspace/docs/specs/004-index/webhooks.md "Security"): HTTPS on 443 to a host name
// that resolves only to public addresses, never a private, loopback, link-local or reserved one (SSRF). Checked
// when a webhook is added and again before each send; redirects are never followed (dispatch.ts), so an endpoint
// can't bounce a delivery inward.

import { WEBHOOK_URL_MAX, type WebhookKind } from '@liveworkspace/index-client';

export type UrlRefusal = 'webhook_url_invalid' | 'webhook_url_private';

// Names that only mean something inside a network.
const INTERNAL_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home.arpa', '.intranet'];

// Each destination's hosts: Slack's incoming webhooks, Teams' Workflows (Power Automate) webhooks.
const SLACK_HOST = 'hooks.slack.com';
const TEAMS_SUFFIXES = ['.logic.azure.com', '.powerplatform.com'];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** The URL a webhook may be added with, or why not: its shape only (resolving is `resolvesPublic`). */
export function parseWebhookUrl(
  raw: unknown,
  kind: WebhookKind,
): { ok: true; url: URL; host: string } | { ok: false; error: UrlRefusal } {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > WEBHOOK_URL_MAX) {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  if (url.port !== '' && url.port !== '443') return { ok: false, error: 'webhook_url_invalid' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // An address rather than a name, or a name that never leaves a network.
  if (IPV4.test(host) || host.startsWith('[') || host.includes(':')) {
    return { ok: false, error: 'webhook_url_private' };
  }
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    INTERNAL_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    return { ok: false, error: 'webhook_url_private' };
  }
  if (kind === 'slack' && (host !== SLACK_HOST || !url.pathname.startsWith('/services/'))) {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  if (kind === 'teams' && !TEAMS_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  return { ok: true, url, host };
}

// The address checks are api-kit's, shared with every server-side fetch of a URL someone typed.
export {
  dohResolve,
  isPrivateAddress,
  resolvesPublic,
  type Resolve,
} from '@liveworkspace/api-kit/public-address';
