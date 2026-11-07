// Each app's fixed local OAuth client (liveworkspace/docs/specs/003-accounts/sign-in.md "Local clients"), so a fresh
// checkout signs in and makes guests with no registration step. Local values only, like ADMIN_TOKEN=local-admin-token:
// they are only ever written to a `--local` database, and no deployed environment takes the `http://localhost/api`
// resource. Each app's apps/api/.dev.vars.example names the same id and secret (local-clients.test.ts checks).
import { createHash } from 'node:crypto';

export const LOCAL_RESOURCE = 'http://localhost/api';

export interface LocalClient {
  // The app's site id, as @liveworkspace/sites spells it.
  app:
    | 'livediagram.app'
    | 'liveplanner.app'
    | 'livedocuments.app'
    | 'livedesign.app'
    | 'livehuddle.app';
  clientId: string;
  clientSecret: string;
  // The app's router, its first port (AGENTS.md's port blocks): where the browser comes back to.
  origin: string;
}

const local = (name: string, port: number): LocalClient => ({
  app: `${name}.app` as LocalClient['app'],
  clientId: `local-${name}`,
  clientSecret: `local-${name}-client-secret`,
  origin: `http://localhost:${port}`,
});

export const LOCAL_CLIENTS: readonly LocalClient[] = [
  local('livediagram', 3100),
  local('liveplanner', 3200),
  local('livedocuments', 3300),
  local('livedesign', 3400),
  local('livehuddle', 3500),
];

// A loopback http origin and nothing else: these become redirect URIs, so a typo must not widen them.
function loopbackOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1'].includes(url.hostname);
    return url.protocol === 'http:' && loopback && url.origin === value ? url.origin : null;
  } catch {
    return null;
  }
}

// LOCAL_CLIENT_ORIGINS, for a stack on other ports: `livedesign.app=http://localhost:3660,livediagram.app=…`.
// Split on the separators rather than matched with a pattern, and anything that isn't an app and a loopback origin is
// named in `refused` and left out.
export function parseExtraOrigins(text: string | undefined): {
  origins: Map<LocalClient['app'], string[]>;
  refused: string[];
} {
  const origins = new Map<LocalClient['app'], string[]>();
  const refused: string[] = [];
  for (const entry of (text ?? '').split(',')) {
    const item = entry.trim();
    if (!item) continue;
    const at = item.indexOf('=');
    const app = LOCAL_CLIENTS.find((client) => client.app === item.slice(0, at).trim())?.app;
    const origin = at === -1 ? null : loopbackOrigin(item.slice(at + 1).trim());
    if (!app || !origin) {
      refused.push(item);
      continue;
    }
    origins.set(app, [...(origins.get(app) ?? []), origin]);
  }
  return { origins, refused };
}

// The two doors an app's api sends the browser back to (its routes/auth.ts): the sign-in callback and the guest hand-off.
export function redirectUrisFor(client: LocalClient, extra: readonly string[] = []): string[] {
  const origins = [...new Set([client.origin, ...extra])];
  return origins.flatMap((origin) => [`${origin}/api/auth/callback`, `${origin}/auth/guest`]);
}

// How @better-auth/oauth-provider keeps a client secret by default ("hashed"): SHA-256, base64url without padding.
export function hashedSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('base64url');
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

// One batch that upserts every local client as POST /api/auth/internal/clients registers one (src/clients.ts): a
// confidential "native" client (its redirects are loopback), PKCE, no consent, the development resource, and its app.
// A client already there gets the fixture's secret and redirects back; clients registered by hand are never touched.
export function localClientsSql(
  now: string,
  extra: ReadonlyMap<LocalClient['app'], string[]> = new Map(),
): string {
  const at = quote(now);
  const lines = [
    `INSERT INTO oauthResource (id, identifier, name, dpopBoundAccessTokensRequired, disabled, createdAt, updatedAt, policyVersion) VALUES ('local-resource', ${quote(LOCAL_RESOURCE)}, ${quote(LOCAL_RESOURCE)}, 0, 0, ${at}, ${at}, 1) ON CONFLICT (identifier) DO NOTHING;`,
  ];
  for (const client of LOCAL_CLIENTS) {
    const id = quote(client.clientId);
    const redirects = quote(JSON.stringify(redirectUrisFor(client, extra.get(client.app))));
    lines.push(
      `INSERT INTO oauthClient (id, clientId, clientSecret, disabled, skipConsent, scopes, clientCredentialsScopes, createdAt, updatedAt, name, redirectUris, tokenEndpointAuthMethod, applicationType, grantTypes, responseTypes, requirePKCE, dpopBoundAccessTokens, referenceId) VALUES (${id}, ${id}, ${quote(hashedSecret(client.clientSecret))}, 0, 1, '["openid","profile","email","offline_access"]', '[]', ${at}, ${at}, ${quote(`${client.app.replace('.app', '')}-local`)}, ${redirects}, 'client_secret_basic', 'native', '["authorization_code","refresh_token"]', '["code"]', 1, 0, 'liveworkspace') ON CONFLICT (clientId) DO UPDATE SET clientSecret = excluded.clientSecret, redirectUris = excluded.redirectUris, disabled = 0, updatedAt = excluded.updatedAt;`,
      `INSERT INTO oauthClientResource (id, clientId, resourceId, createdAt) SELECT ${quote(`${client.clientId}-resource`)}, ${id}, ${quote(LOCAL_RESOURCE)}, ${at} WHERE NOT EXISTS (SELECT 1 FROM oauthClientResource WHERE clientId = ${id} AND resourceId = ${quote(LOCAL_RESOURCE)});`,
      `INSERT INTO oauth_client_app (clientId, app) VALUES (${id}, ${quote(client.app)}) ON CONFLICT (clientId) DO UPDATE SET app = excluded.app;`,
    );
  }
  return `${lines.join('\n')}\n`;
}
