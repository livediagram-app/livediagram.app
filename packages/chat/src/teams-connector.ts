// The calls out to the Bot Framework (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "The calls out"): the bot's
// own token (client credentials, kept until five minutes before it lapses) and the connector's `v3/conversations`
// routes on the activity's checked `serviceUrl`. Each is bounded and follows no redirect; none throws.
import { CHAT_CALL_TIMEOUT_MS } from './limits';
import { isTeamsServiceUrl } from './teams-auth';

export type BotCredentials = { appId: string; password: string; tenant?: string | undefined };

const RENEW_BEFORE_MS = 300_000;
const SCOPE = 'https://api.botframework.com/.default';

/** The bot's tokens, kept per app id. */
export function createBotTokens(fetcher: typeof fetch = (input, init) => fetch(input, init)) {
  const held = new Map<string, { token: string; until: number }>();
  return async function botToken(creds: BotCredentials, now = Date.now()): Promise<string | null> {
    const kept = held.get(creds.appId);
    if (kept && kept.until > now) return kept.token;
    const tenant = creds.tenant?.trim() || 'botframework.com';
    try {
      const res = await fetcher(
        `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: creds.appId,
            client_secret: creds.password,
            scope: SCOPE,
          }).toString(),
          redirect: 'manual',
          signal: AbortSignal.timeout(CHAT_CALL_TIMEOUT_MS),
        },
      );
      if (!res.ok) return null;
      const body = await res.json<{ access_token?: unknown; expires_in?: unknown }>();
      if (typeof body.access_token !== 'string') return null;
      const life = typeof body.expires_in === 'number' ? body.expires_in * 1000 : 3_600_000;
      held.set(creds.appId, { token: body.access_token, until: now + life - RENEW_BEFORE_MS });
      return body.access_token;
    } catch {
      return null;
    }
  };
}

const base = (serviceUrl: string) => (serviceUrl.endsWith('/') ? serviceUrl : `${serviceUrl}/`);

async function post(
  fetcher: typeof fetch,
  url: string,
  token: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(CHAT_CALL_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const answer: unknown = await res.json().catch(() => ({}));
    return answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

/** An activity into a conversation, as a reply to `replyTo` when given. True when the connector took it. */
export async function sendToConversation(
  to: { serviceUrl: string; conversationId: string; replyTo?: string | undefined; token: string },
  activity: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!isTeamsServiceUrl(to.serviceUrl)) return false;
  const path = `v3/conversations/${encodeURIComponent(to.conversationId)}/activities${
    to.replyTo ? `/${encodeURIComponent(to.replyTo)}` : ''
  }`;
  return (await post(fetcher, `${base(to.serviceUrl)}${path}`, to.token, activity)) !== null;
}

/** The personal chat between the bot and one person (made, or found, by the connector): its id, or null. */
export async function personalConversation(
  to: { serviceUrl: string; botId: string; userId: string; tenantId: string; token: string },
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  if (!isTeamsServiceUrl(to.serviceUrl)) return null;
  const answer = await post(fetcher, `${base(to.serviceUrl)}v3/conversations`, to.token, {
    isGroup: false,
    bot: { id: to.botId },
    members: [{ id: to.userId }],
    tenantId: to.tenantId,
    channelData: { tenant: { id: to.tenantId } },
  });
  return typeof answer?.id === 'string' ? answer.id : null;
}
