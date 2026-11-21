// An app's server asking accounts which AI key applies to the person it serves, and for the key itself
// (liveworkspace/docs/specs/003-accounts/ai-keys.md "How an app's server gets the key"). Worker only: it sends the
// client secret and the person's own access token, and the answer may hold a customer's key, so:
// - it goes over the ACCOUNTS service binding and nowhere else: no public-route fallback, which accounts would refuse;
// - it gives up at a short deadline and never throws: any failure is `unavailable`, and the caller falls back;
// - nothing here logs, caches or keeps the answer; the caller uses the key for its one request and lets it go.
import { basicAuthorization, type ClientCredentials } from './oauth';
import { deadlineSignal } from './account-call';

export const AI_KEY_PATH = '/internal/ai-key';
// A model call waits on this before it starts, so it is short: accounts answers in a few ms over the binding.
export const AI_KEY_TIMEOUT_MS = 5_000;

export type AiKeyProvider = 'anthropic' | 'openai';
export type AiKeySource = 'team' | 'account';

export type AiKeyAnswer =
  // The key that applies: the team's (for a joined member), else the person's own. `key` only for `want: 'key'`.
  | { status: 'key'; source: AiKeySource; provider: AiKeyProvider; model: string; key?: string }
  // Neither has one: built-in AI answers.
  | { status: 'none' }
  // One is set but its sealed form no longer opens (a rotation gone wrong): the caller says so, never falls back
  // silently to built-in AI as if no key were set.
  | { status: 'unreadable'; source: AiKeySource }
  // Accounts could not answer (no binding, a refusal, a limit, a timeout): the caller treats it as no key.
  | { status: 'unavailable' };

const isProvider = (value: unknown): value is AiKeyProvider =>
  value === 'anthropic' || value === 'openai';
const isSource = (value: unknown): value is AiKeySource => value === 'team' || value === 'account';

/** Which AI key applies to the person whose `accessToken` this is, in `teamId`'s context; with `want: 'key'`, the key
 *  too. Never throws. */
export async function aiKeyFor(
  credentials: ClientCredentials,
  ask: { accessToken: string; teamId?: string | null; want: 'key' | 'which' },
  timeoutMs = AI_KEY_TIMEOUT_MS,
): Promise<AiKeyAnswer> {
  const binding = credentials.accounts;
  if (!binding || !ask.accessToken) return { status: 'unavailable' };
  let response: Response;
  try {
    response = await binding.fetch(new URL(AI_KEY_PATH, credentials.accountsUrl).href, {
      method: 'POST',
      headers: {
        authorization: basicAuthorization(credentials),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        token: ask.accessToken,
        ...(ask.teamId ? { teamId: ask.teamId } : {}),
        want: ask.want,
      }),
      signal: deadlineSignal(timeoutMs),
    });
  } catch {
    return { status: 'unavailable' };
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return { status: 'unavailable' };
  if (response.status === 409 && body.error === 'ai_key_unreadable' && isSource(body.source)) {
    return { status: 'unreadable', source: body.source };
  }
  if (!response.ok) return { status: 'unavailable' };
  if (body.source === null) return { status: 'none' };
  if (!isSource(body.source) || !isProvider(body.provider) || typeof body.model !== 'string') {
    return { status: 'unavailable' };
  }
  const answer: AiKeyAnswer = {
    status: 'key',
    source: body.source,
    provider: body.provider,
    model: body.model,
  };
  if (ask.want === 'key') {
    if (typeof body.key !== 'string' || body.key.length === 0) return { status: 'unavailable' };
    answer.key = body.key;
  }
  return answer;
}
