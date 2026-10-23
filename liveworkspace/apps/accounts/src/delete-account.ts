// Closing a liveworkspace account, asked for by an app's own server when the person deletes their
// account there. The app sends its client credentials (Basic, as for /oauth2/token) and the
// person's access token; the provider's introspection checks both, so a token on its own (lifted
// from a page, say) closes nothing, and an app can only close the account of someone signed in to it.
//
// Deleting the user takes everything else with it: sessions and linked Google accounts through
// Better Auth, and the OAuth tokens and consents through their foreign keys; teams and settings
// are cleared first, explicitly. Every app's refresh token stops working at once; an access token
// already issued runs out on its own (minutes).
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Auth } from './auth.ts';
import { deleteSettings } from './settings.ts';
import { leaveAllTeams } from './teams.ts';

export const DELETE_ACCOUNT_PATH = '/delete-account';

interface Introspection {
  active?: boolean;
  sub?: unknown;
  client_id?: unknown;
}

function basicClientId(header: string | null): string | null {
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

export async function deleteAccount(
  request: Request,
  auth: Auth,
  db: D1Database,
): Promise<Response> {
  const authorization = request.headers.get('authorization');
  const clientId = basicClientId(authorization);
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === 'string' ? body.token : '';
  if (!clientId || !authorization || !token) {
    return Response.json(
      { error: 'invalid_request', message: 'Needs client credentials and the access token' },
      { status: 400 },
    );
  }

  const url = new URL(`${AUTH_BASE_PATH}/oauth2/introspect`, request.url);
  const checked = await auth.handler(
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
  if (checked.status === 401) return Response.json({ error: 'invalid_client' }, { status: 401 });
  const result = (await checked.json().catch(() => ({}))) as Introspection;
  if (
    !checked.ok ||
    result.active !== true ||
    typeof result.sub !== 'string' ||
    result.client_id !== clientId
  ) {
    return Response.json({ error: 'invalid_token' }, { status: 401 });
  }

  // Teams first, so the apps hear that the account left each one and a team it ran passes on.
  await leaveAllTeams(db, result.sub);
  // Settings have no foreign key to the account (a guest's rows have no account), so they go here.
  await deleteSettings(db, result.sub);
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUser(result.sub);
  return Response.json({ deleted: true });
}
