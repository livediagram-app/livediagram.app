// Registering an app (a confidential OAuth client) with this Worker. Behind ADMIN_TOKEN
// rather than open dynamic registration: the only clients are our own apps, and each is
// registered once per environment with scripts/register-client.ts.
import { makeSignature } from 'better-auth/crypto';
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { RESOURCES } from './resources.ts';
import { ADMIN_HEADER, sameSecret } from './secrets.ts';

// Under the accounts API, like every liveworkspace API.
export const CLIENTS_PATH = `${AUTH_BASE_PATH}/internal/clients`;

// Better Auth only registers clients on behalf of a signed-in account. This one stands in
// for "liveworkspace itself": it is created on first use, and since `.invalid` can never
// receive mail, nobody can sign in as it.
const REGISTRAR_EMAIL = 'client-registrar@liveworkspace.invalid';

function isLoopback(uri: string): boolean {
  try {
    const { protocol, hostname } = new URL(uri);
    return protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

interface RegisterBody {
  name?: unknown;
  redirectUris?: unknown;
  resource?: unknown;
}

export async function registerClient(request: Request, env: Env, auth: Auth): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!env.ADMIN_TOKEN || !(await sameSecret(token, env.ADMIN_TOKEN))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as RegisterBody;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const redirectUris = Array.isArray(body.redirectUris)
    ? body.redirectUris.filter((uri): uri is string => typeof uri === 'string')
    : [];
  const resource = typeof body.resource === 'string' ? body.resource : '';
  if (!name || redirectUris.length === 0 || !RESOURCES[env.ENVIRONMENT].includes(resource)) {
    return Response.json(
      {
        error: 'invalid_request',
        message: `Needs name, redirectUris and a resource from: ${RESOURCES[env.ENVIRONMENT].join(', ')}`,
      },
      { status: 400 },
    );
  }

  const ctx = await auth.$context;
  const registrar =
    (await ctx.internalAdapter.findUserByEmail(REGISTRAR_EMAIL))?.user ??
    (await ctx.internalAdapter.createUser(
      { email: REGISTRAR_EMAIL, name: 'liveworkspace client registrar', emailVerified: false },
      { method: 'admin' },
    ));
  const session = await ctx.internalAdapter.createSession(registrar.id);
  const signed = `${session.token}.${await makeSignature(session.token, env.BETTER_AUTH_SECRET)}`;

  try {
    const client = await auth.api
      .adminCreateOAuthClient({
        headers: new Headers({
          cookie: `${ctx.authCookies.sessionToken.name}=${encodeURIComponent(signed)}`,
          [ADMIN_HEADER]: env.ADMIN_TOKEN,
        }),
        body: {
          client_name: name,
          redirect_uris: redirectUris,
          // A local dev app calls back to http://localhost, which Better Auth (per RFC 8252)
          // only allows for "native" clients; every deployed app is a "web" client on https.
          application_type: redirectUris.every(isLoopback) ? 'native' : 'web',
          token_endpoint_auth_method: 'client_secret_basic',
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          scope: 'openid profile email offline_access',
          resources: [resource],
          require_pkce: true,
          // First-party apps: signing in is the consent.
          skip_consent: true,
        },
      })
      // Only an admin reaches this, so the reason goes back in full.
      .catch((error: unknown) => error as Error & { status?: string; body?: unknown });
    if (client instanceof Error) {
      return Response.json(
        {
          error: 'registration_failed',
          status: client.status,
          detail: client.body ?? client.message,
        },
        { status: 400 },
      );
    }
    return Response.json({
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uris: client.redirect_uris,
      resource,
    });
  } finally {
    await ctx.internalAdapter.deleteSession(session.token);
  }
}
