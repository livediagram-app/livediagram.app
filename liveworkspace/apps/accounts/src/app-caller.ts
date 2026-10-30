// An app's server, acting for someone signed in to it: its client credentials (Basic, as for /oauth2/token) and the
// person's access token in the body, both checked through the provider's introspection. A token on its own (lifted from
// a page, say) does nothing, and an app can only act for someone signed in to it. Closing an account and its deletion
// code (delete-account.ts, deletion-code.ts) start here.
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { introspectWithLegacy, type Introspected } from './legacy-issuer.ts';

export function basicClientId(header: string | null): string | null {
  const encoded = header?.match(/^Basic\s+(.+)$/i)?.[1];
  if (!encoded) return null;
  try {
    const decoded = atob(encoded);
    const colon = decoded.indexOf(':');
    return colon > 0 ? decodeURIComponent(decoded.slice(0, colon)) : null;
  } catch {
    return null;
  }
}

export interface CallerConfig {
  auth: Auth;
  // Where this Worker is, so an access token minted under the bare issuer before the move to www. is still taken
  // (legacy-issuer.ts). Left out, only the provider's own introspection decides.
  issuerEnv?: Pick<Env, 'BASE_URL' | 'ENVIRONMENT'>;
}

export type Caller =
  | { ok: true; userId: string; clientId: string; body: Record<string, unknown> }
  | { ok: false; response: Response };

export async function introspectCaller(request: Request, config: CallerConfig): Promise<Caller> {
  const { auth, issuerEnv } = config;
  const authorization = request.headers.get('authorization');
  const clientId = basicClientId(authorization);
  // `?? {}` too: a body of `null` parses, and reading `.token` off it would answer 500 instead of 400. An array or a
  // string parses as well, and is read as no fields.
  const parsed: unknown = await request.json().catch(() => null);
  const body =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const token = typeof body.token === 'string' ? body.token : '';
  if (!clientId || !authorization || !token) {
    return {
      ok: false,
      response: Response.json(
        { error: 'invalid_request', message: 'Needs client credentials and the access token' },
        { status: 400 },
      ),
    };
  }

  const url = new URL(`${AUTH_BASE_PATH}/oauth2/introspect`, request.url);
  const introspect = () =>
    auth.handler(
      new Request(url, {
        method: 'POST',
        headers: {
          authorization,
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString(),
      }),
    );
  const { status, result } = issuerEnv
    ? await introspectWithLegacy(introspect, token, clientId, issuerEnv, auth)
    : await introspect().then(async (checked) => ({
        status: checked.status,
        result: (await checked.json().catch(() => ({}))) as Introspected,
      }));
  if (status === 401) {
    return { ok: false, response: Response.json({ error: 'invalid_client' }, { status: 401 }) };
  }
  if (
    status !== 200 ||
    result.active !== true ||
    typeof result.sub !== 'string' ||
    result.client_id !== clientId
  ) {
    return { ok: false, response: Response.json({ error: 'invalid_token' }, { status: 401 }) };
  }
  return { ok: true, userId: result.sub, clientId, body };
}
