// The calls out to Slack (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "The calls out"): its Web API on
// slack.com, the install's code exchange and a command's or interaction's `response_url` on hooks.slack.com. Each is
// bounded, follows no redirect, and goes only to Slack's own hosts.
import { CHAT_CALL_TIMEOUT_MS } from './limits';

export type SlackAnswer = { ok: boolean; error?: string } & Record<string, unknown>;

const SLACK_API = 'https://slack.com/api/';

const failed = (error: string): SlackAnswer => ({ ok: false, error });

async function read(res: Response): Promise<SlackAnswer> {
  if (!res.ok) return failed(`http_${res.status}`);
  const body: unknown = await res.json().catch(() => null);
  return body && typeof body === 'object' ? (body as SlackAnswer) : failed('bad_json');
}

/** One Web API method with a bot token, as JSON. Never throws: a network failure is `{ ok: false }`. */
export async function slackCall(
  method: string,
  token: string,
  body: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<SlackAnswer> {
  try {
    const res = await fetcher(`${SLACK_API}${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(CHAT_CALL_TIMEOUT_MS),
    });
    return await read(res);
  } catch {
    return failed('unreachable');
  }
}

export type SlackInstall = {
  token: string;
  botUser: string;
  team: { id: string; name: string };
};

/** The install's code exchanged for the workspace's bot token (`oauth.v2.access`), or why not. An org-wide
 *  Enterprise Grid install is refused: it names no one workspace. */
export async function slackOAuthAccess(
  exchange: { clientId: string; clientSecret: string; code: string; redirectUri: string },
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; install: SlackInstall } | { ok: false; error: string }> {
  let answer: SlackAnswer;
  try {
    const res = await fetcher(`${SLACK_API}oauth.v2.access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: exchange.clientId,
        client_secret: exchange.clientSecret,
        code: exchange.code,
        redirect_uri: exchange.redirectUri,
      }).toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(CHAT_CALL_TIMEOUT_MS),
    });
    answer = await read(res);
  } catch {
    return { ok: false, error: 'unreachable' };
  }
  if (!answer.ok) return { ok: false, error: answer.error ?? 'refused' };
  if (answer.is_enterprise_install === true) return { ok: false, error: 'enterprise_install' };
  const team = answer.team as { id?: unknown; name?: unknown } | undefined;
  const token = answer.access_token;
  const botUser = answer.bot_user_id;
  if (typeof token !== 'string' || typeof team?.id !== 'string' || typeof botUser !== 'string')
    return { ok: false, error: 'bad_answer' };
  return {
    ok: true,
    install: {
      token,
      botUser,
      team: { id: team.id, name: typeof team.name === 'string' ? team.name : team.id },
    },
  };
}

/** Whether a `response_url` is Slack's own: https on hooks.slack.com, so a forged one sends nothing elsewhere. */
export function isSlackResponseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'hooks.slack.com' && !parsed.port;
  } catch {
    return false;
  }
}

/** A message through a command's or an interaction's `response_url` (valid 30 minutes, five times). */
export async function postToResponseUrl(
  url: string,
  body: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!isSlackResponseUrl(url)) return false;
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(CHAT_CALL_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
