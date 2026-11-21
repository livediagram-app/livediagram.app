// `POST /internal/ai-key` (liveworkspace/docs/specs/003-accounts/ai-keys.md "How an app's server gets the key"; the
// blueprint's "The internal door" and threat model): the one door that answers a plain key, so the one with every
// lock. It is on no route of the zone, refuses anything that came from the internet or through a router, and
// answers only an app's server that proves both itself (its client credentials) and the person it serves (their own
// access token, minted for that same client, checked here). A team's key only for a joined member, read now. The
// answer is never cached anywhere, and nothing here logs a key, a token or a body.
import type { KeyProviderId } from '@liveworkspace/ai';
import { verifiedClient, vouchedPerson } from '../account-api/internal.ts';
import { error, json, readBody } from '../account-api/http.ts';
import type { Auth } from '../auth.ts';
import type { Env } from '../env.ts';
import { USER_ID } from '../ids.ts';
import { aiKeySecrets, AiKeySealError, openAiKey } from './seal.ts';
import { ownerOf, readApplyingKeys, type AiKeyRow } from './store.ts';

export const AI_KEY_INTERNAL_PATH = '/internal/ai-key';

// The headers a request from the internet carries, whichever way it came: Cloudflare sets CF-Connecting-IP on every
// request from outside, and an app's router adds its own two to whatever it forwards (@liveworkspace/sites
// workspace-proxy.ts). A Worker's call over a service binding is a fresh request with none of them.
const FROM_OUTSIDE = ['cf-connecting-ip', 'x-liveworkspace-proxy', 'x-liveworkspace-client-ip'];

/** Whether the request came over a service binding: none of the headers a request from outside carries. */
export const fromBinding = (request: Request): boolean =>
  FROM_OUTSIDE.every((name) => !request.headers.has(name));

// The same answer as an unknown path's, so a probe from outside learns nothing.
const notFound = () => new Response('Not found', { status: 404 });

const noStore = (body: unknown, status = 200) => json(body, status);

type Answer = { source: 'team' | 'account'; provider: KeyProviderId; model: string };

export async function handleAiKeyInternal(
  request: Request,
  env: Env,
  auth: Auth,
): Promise<Response> {
  if (request.method !== 'POST' || !fromBinding(request)) return notFound();
  const secrets = aiKeySecrets(env);
  if (!secrets) return error(503, 'ai_keys_unavailable');
  const client = await verifiedClient(request, auth, env.AUTH_DB);
  if (!client) return error(401, 'invalid_client');
  const body = await readBody(request);
  const person = await vouchedPerson(request, auth, client.clientId, body.token);
  if (person instanceof Response) return person;
  // An account's own token only: a guest has no key.
  if (!USER_ID.test(person)) return error(401, 'invalid_token');
  if (env.AI_KEY_LIMITER && !(await env.AI_KEY_LIMITER.limit({ key: `use:${person}` })).success) {
    return error(429, 'rate_limited');
  }
  const { teamId, want } = body;
  if (teamId !== undefined && teamId !== null) {
    if (typeof teamId !== 'string' || teamId.length === 0 || teamId.length > 100) {
      return error(400, 'invalid_team');
    }
  }
  if (want !== 'key' && want !== 'which') return error(400, 'invalid_want');
  const keys = await readApplyingKeys(
    env.AUTH_DB,
    person,
    typeof teamId === 'string' ? teamId : null,
  );
  const row: AiKeyRow | null = keys.team ?? keys.account;
  if (!row) return noStore({ source: null });
  const answer: Answer = { source: row.ownerKind, provider: row.provider, model: row.model };
  if (want === 'which') return noStore(answer);
  try {
    const key = await openAiKey(secrets, ownerOf(row), row.provider, row.sealed);
    return noStore({ ...answer, key });
  } catch (cause) {
    if (!(cause instanceof AiKeySealError)) throw cause;
    console.warn('[ai-keys] unreadable', { source: row.ownerKind, version: row.keyVersion });
    return noStore({ error: 'ai_key_unreadable', source: row.ownerKind }, 409);
  }
}
