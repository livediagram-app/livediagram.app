// Where a webhook may send (liveworkspace/docs/specs/004-index/webhooks.md "Security"): HTTPS on 443 to a host name
// that resolves only to public addresses, never a private, loopback, link-local or reserved one (SSRF). Checked
// when a webhook is added and again before each send; redirects are never followed (dispatch.ts), so an endpoint
// can't bounce a delivery inward.

import { WEBHOOK_URL_MAX, type WebhookKind } from '@liveworkspace/index-client';
import { parsePublicHttpsUrl } from '@liveworkspace/model-core/public-https-url';

export type UrlRefusal = 'webhook_url_invalid' | 'webhook_url_private';

// Each destination's hosts: Slack's incoming webhooks, Teams' Workflows (Power Automate) webhooks.
const SLACK_HOST = 'hooks.slack.com';
const TEAMS_SUFFIXES = ['.logic.azure.com', '.powerplatform.com'];

/** The URL a webhook may be added with, or why not: its shape only (resolving is `resolvesPublic`). The shape and
 * name rules are shared with every server-side fetch of a typed URL (`parsePublicHttpsUrl`); the destinations'
 * own hosts are this guard's. */
export function parseWebhookUrl(
  raw: unknown,
  kind: WebhookKind,
): { ok: true; url: URL; host: string } | { ok: false; error: UrlRefusal } {
  const parsed = parsePublicHttpsUrl(raw, WEBHOOK_URL_MAX);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error === 'private' ? 'webhook_url_private' : 'webhook_url_invalid',
    };
  }
  const { url, host } = parsed;
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
