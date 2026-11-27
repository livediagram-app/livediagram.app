// Teams' request check (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "Teams' request check"): the Bot
// Framework's bearer token, an RS256 JWT checked against the Bot Framework's published keys, with its issuer, its
// audience (the app's id), its `serviceurl` claim (the activity's own) and its times within five minutes. Nothing in
// an activity is believed until it passes. The keys are kept a day and fetched again for a key id they lack, at most
// every five minutes, so a stream of forged ids costs one fetch.
import { base64ToBytes } from '@liveworkspace/api-kit/bytes';
import {
  BOT_KEYS_KEEP_MS,
  BOT_KEYS_RETRY_MS,
  CHAT_CALL_TIMEOUT_MS,
  CHAT_REQUEST_WINDOW_S,
} from './limits';

export const BOT_FRAMEWORK_ISSUER = 'https://api.botframework.com';
export const BOT_FRAMEWORK_OPENID =
  'https://login.botframework.com/v1/.well-known/openidconfiguration';
const KEYS_HOST = 'login.botframework.com';

export type TeamsCheck = 'ok' | 'missing' | 'bad' | 'stale';

type BotKey = JsonWebKey & { kid?: string; endorsements?: unknown };

export type BotKeys = { keyFor: (kid: string, now: number) => Promise<BotKey | null> };

async function fetchJson(fetcher: typeof fetch, url: string): Promise<unknown> {
  const res = await fetcher(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(CHAT_CALL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`keys ${res.status}`);
  return res.json();
}

const onKeysHost = (url: unknown): url is string => {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === KEYS_HOST;
  } catch {
    return false;
  }
};

/** The Bot Framework's keys, read through `fetcher` and kept per BOT_KEYS_KEEP_MS. */
export function createBotFrameworkKeys(fetcher: typeof fetch = fetch): BotKeys {
  let keys = new Map<string, BotKey>();
  let readAt = -Infinity;
  async function refresh(now: number) {
    readAt = now;
    const config = (await fetchJson(fetcher, BOT_FRAMEWORK_OPENID)) as { jwks_uri?: unknown };
    if (!onKeysHost(config.jwks_uri)) throw new Error('keys address');
    const set = (await fetchJson(fetcher, config.jwks_uri)) as { keys?: unknown };
    const next = new Map<string, BotKey>();
    for (const key of Array.isArray(set.keys) ? (set.keys as BotKey[]) : [])
      if (typeof key?.kid === 'string') next.set(key.kid, key);
    keys = next;
  }
  return {
    keyFor: async (kid, now) => {
      const stale = now - readAt > BOT_KEYS_KEEP_MS;
      if (stale || (!keys.has(kid) && now - readAt > BOT_KEYS_RETRY_MS)) {
        try {
          await refresh(now);
        } catch (error) {
          console.warn('[chat] bot keys unreachable', { error: String(error) });
        }
      }
      return keys.get(kid) ?? null;
    },
  };
}

const dec = new TextDecoder();

function partOf(text: string): Record<string, unknown> | null {
  const bytes = base64ToBytes(text);
  if (!bytes) return null;
  try {
    const value: unknown = JSON.parse(dec.decode(bytes));
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Whether an activity is the Bot Framework's for this app. `serviceUrl` is the activity's own; `now` in ms. */
export async function verifyBotFrameworkRequest(check: {
  authorization: string | null;
  appId: string;
  serviceUrl: string | null;
  now: number;
  keys: BotKeys;
}): Promise<TeamsCheck> {
  const { authorization, appId, serviceUrl, now, keys } = check;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token || !appId) return 'missing';
  const [headText, bodyText, sigText, extra] = token.split('.');
  if (!headText || !bodyText || !sigText || extra !== undefined) return 'bad';
  const head = partOf(headText);
  const body = partOf(bodyText);
  const signature = base64ToBytes(sigText);
  if (!head || !body || !signature) return 'bad';
  if (head.alg !== 'RS256' || typeof head.kid !== 'string') return 'bad';
  if (body.iss !== BOT_FRAMEWORK_ISSUER || body.aud !== appId) return 'bad';
  // The activity names where to answer; the token must say the same, so a forged activity can't send us elsewhere.
  if (!serviceUrl || body.serviceurl !== serviceUrl) return 'bad';
  const seconds = now / 1000;
  if (typeof body.exp !== 'number' || body.exp + CHAT_REQUEST_WINDOW_S < seconds) return 'stale';
  if (typeof body.nbf === 'number' && body.nbf - CHAT_REQUEST_WINDOW_S > seconds) return 'stale';
  const jwk = await keys.keyFor(head.kid, now);
  if (!jwk) return 'bad';
  // A key endorsed for some channels only must be endorsed for Teams.
  if (Array.isArray(jwk.endorsements) && !jwk.endorsements.includes('msteams')) return 'bad';
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const good = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      new Uint8Array(signature),
      new TextEncoder().encode(`${headText}.${bodyText}`),
    );
    return good ? 'ok' : 'bad';
  } catch {
    return 'bad';
  }
}

/** Whether an activity's `serviceUrl` is one of Teams': https on the Bot Framework's hosts. */
export function isTeamsServiceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return (
      parsed.protocol === 'https:' &&
      !parsed.port &&
      (host.endsWith('.trafficmanager.net') ||
        host.endsWith('.botframework.com') ||
        host.endsWith('.teams.microsoft.com'))
    );
  } catch {
    return false;
  }
}
