// The authorization server's endpoints for Work Tracker 1447 to 1450 (liveworkspace/docs/specs/021-mcp/mcp.md
// "Tokens", "Client ID Metadata Documents", "Redirect addresses"): the refresh grant over HTTP, the resource a token is
// for, a metadata-document client signing in end to end, and app-scheme redirects. The built-in CLI keeps getting the
// account token it always got.
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pkceChallenge } from '@liveworkspace/api-kit/oauth';
import { cliClients } from './oauth-clients';
import { registerOauthRoutes, type OauthServer } from './oauth';
import { REUSE_GRACE_MS, resolveAccessToken } from './oauth-tokens';

type Env = { OAUTH_KV: KVNamespace; CONSENT_BASE_URL?: string };
const SERVER: OauthServer<Env> = {
  appBase: () => 'https://live.test',
  builtInClients: cliClients('example-cli', 'example CLI'),
};

function mockKV(): KVNamespace {
  const m = new Map<string, string>();
  return {
    get: async (k: string, type?: string): Promise<unknown> => {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => {
      m.set(k, v);
    },
    delete: async (k: string) => {
      m.delete(k);
    },
  } as unknown as KVNamespace;
}

const ORIGIN = 'https://mcp.liveworkspace.test';
const RESOURCE = `${ORIGIN}/mcp`;
const VERIFIER = 'v'.repeat(64);

let app: Hono<{ Bindings: Env }>;
let env: Env;

beforeEach(() => {
  app = new Hono<{ Bindings: Env }>();
  registerOauthRoutes(app, SERVER);
  env = { OAUTH_KV: mockKV() };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const call = (path: string, init: RequestInit = {}) => app.request(`${ORIGIN}${path}`, init, env);

async function register(redirectUris: string[], clientName = 'Example Assistant') {
  return call('/oauth/register', {
    method: 'POST',
    body: JSON.stringify({ redirect_uris: redirectUris, client_name: clientName }),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function authorize(clientId: string, redirectUri: string, extra = '') {
  return call(
    `/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code_challenge=${await pkceChallenge(VERIFIER)}&code_challenge_method=S256&response_type=code&state=s${extra}`,
  );
}

const sessionOf = (res: Response) =>
  new URL(res.headers.get('location')!).searchParams.get('session')!;

async function codeFor(clientId: string, redirectUri: string, token = 'lwt_account') {
  const auth = await authorize(clientId, redirectUri);
  expect(auth.status).toBe(302);
  const complete = await call('/oauth/complete', {
    method: 'POST',
    body: JSON.stringify({
      session: sessionOf(auth),
      token,
      expiresAt: Date.now() + 180 * 86_400_000,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  return new URL((await complete.json<{ redirectTo: string }>()).redirectTo).searchParams.get(
    'code',
  )!;
}

async function tokenCall(fields: Record<string, string>) {
  const res = await call('/oauth/token', {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return { res, body: await res.json<Record<string, string | number>>() };
}

async function signIn(clientId: string, redirectUri: string, extra: Record<string, string> = {}) {
  return tokenCall({
    grant_type: 'authorization_code',
    code: await codeFor(clientId, redirectUri),
    code_verifier: VERIFIER,
    redirect_uri: redirectUri,
    client_id: clientId,
    ...extra,
  });
}

describe('discovery and registration', () => {
  it('advertises the refresh grant and metadata documents', async () => {
    const meta = await (
      await call('/.well-known/oauth-authorization-server')
    ).json<Record<string, unknown>>();
    expect(meta.grant_types_supported).toContain('refresh_token');
    expect(meta.client_id_metadata_document_supported).toBe(true);
    const reg = await register(['https://client.test/cb']);
    expect((await reg.json<{ grant_types: string[] }>()).grant_types).toEqual([
      'authorization_code',
      'refresh_token',
    ]);
  });
});

describe('the refresh grant over HTTP (Work Tracker 1448)', () => {
  it('rotates on every use, never cached, and a spent token ends the sign-in', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client_id } = await (
      await register(['https://client.test/cb'])
    ).json<{ client_id: string }>();
    const first = await signIn(client_id, 'https://client.test/cb');
    expect(first.body.expires_in).toBe(3600);
    const refresh = (refreshToken: string, clientId = client_id) =>
      tokenCall({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });
    const second = await refresh(String(first.body.refresh_token));
    expect(second.res.status).toBe(200);
    expect(second.res.headers.get('Cache-Control')).toBe('no-store');
    expect(second.body.refresh_token).not.toBe(first.body.refresh_token);
    expect(
      await resolveAccessToken(env.OAUTH_KV, String(second.body.access_token), RESOURCE),
    ).toMatchObject({ ok: true, upstream: 'lwt_account' });
    // Long after the rotation, so not a client's own two calls at once: a stolen token.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + REUSE_GRACE_MS + 1000);
    const replay = await refresh(String(first.body.refresh_token));
    expect(replay.res.status).toBe(400);
    expect(replay.body.error).toBe('invalid_grant');
    expect((await refresh(String(second.body.refresh_token))).body.error).toBe('invalid_grant');
    expect(
      await resolveAccessToken(env.OAUTH_KV, String(second.body.access_token), RESOURCE),
    ).toMatchObject({ ok: false });
  });

  it('needs the client id the sign-in was for', async () => {
    const { client_id } = await (
      await register(['https://client.test/cb'])
    ).json<{ client_id: string }>();
    const first = await signIn(client_id, 'https://client.test/cb');
    const missing = await tokenCall({
      grant_type: 'refresh_token',
      refresh_token: String(first.body.refresh_token),
    });
    expect(missing.body.error).toBe('invalid_request');
    const other = await tokenCall({
      grant_type: 'refresh_token',
      refresh_token: String(first.body.refresh_token),
      client_id: 'someone-else',
    });
    expect(other.body.error).toBe('invalid_grant');
  });
});

describe('the resource a token is for (Work Tracker 1447, RFC 8707)', () => {
  it('issues for this server’s /mcp, with or without a query, and refuses any other', async () => {
    const { client_id } = await (
      await register(['https://client.test/cb'])
    ).json<{ client_id: string }>();
    const named = await signIn(client_id, 'https://client.test/cb', { resource: RESOURCE });
    expect(named.res.status).toBe(200);
    const all = await signIn(client_id, 'https://client.test/cb', {
      resource: `${RESOURCE}?tools=all`,
    });
    expect(all.res.status).toBe(200);
    expect(
      await resolveAccessToken(env.OAUTH_KV, String(all.body.access_token), RESOURCE),
    ).toMatchObject({ ok: true });
    const other = await signIn(client_id, 'https://client.test/cb', {
      resource: 'https://api.example.com/mcp',
    });
    expect(other.body).toMatchObject({ error: 'invalid_target' });
    const refreshOther = await tokenCall({
      grant_type: 'refresh_token',
      refresh_token: String(named.body.refresh_token),
      client_id,
      resource: 'not a url',
    });
    expect(refreshOther.body.error).toBe('invalid_target');
  });

  it('sends a foreign resource at authorize back to the client', async () => {
    const { client_id } = await (
      await register(['https://client.test/cb'])
    ).json<{ client_id: string }>();
    const res = await authorize(
      client_id,
      'https://client.test/cb',
      `&resource=${encodeURIComponent('https://evil.test/mcp')}`,
    );
    const back = new URL(res.headers.get('location')!);
    expect(back.origin).toBe('https://client.test');
    expect(back.searchParams.get('error')).toBe('invalid_target');
    expect(back.searchParams.get('state')).toBe('s');
  });
});

describe('the built-in CLI (compatibility)', () => {
  it('still gets the account token itself, as every CLI version expects', async () => {
    const res = await signIn('example-cli', 'http://127.0.0.1:53124/callback');
    expect(res.body).toMatchObject({ access_token: 'lwt_account', token_type: 'Bearer' });
    expect(res.body).not.toHaveProperty('refresh_token');
  });
});

describe('a Client ID Metadata Document client (Work Tracker 1449)', () => {
  const CLIENT = 'https://client.example.com/oauth/metadata.json';
  const CALLBACK = 'https://client.example.com/callback';

  function serve(doc: Record<string, unknown>) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        Response.json({ client_id: CLIENT, redirect_uris: [CALLBACK], ...doc }),
      );
  }

  it('signs in end to end, its document fetched once, shown unverified', async () => {
    const network = serve({ client_name: 'Example Assistant' });
    const auth = await authorize(CLIENT, CALLBACK);
    expect(auth.status).toBe(302);
    const session = await (await call(`/oauth/session/${sessionOf(auth)}`)).json();
    expect(session).toEqual({
      clientName: 'Example Assistant',
      redirectHost: 'client.example.com',
      clientId: CLIENT,
      verified: false,
    });
    const token = await signIn(CLIENT, CALLBACK);
    expect(token.body.access_token).toMatch(/^lwm_/);
    expect(network).toHaveBeenCalledTimes(1);
    // Refresh binds to the same URL client id.
    const refreshed = await tokenCall({
      grant_type: 'refresh_token',
      refresh_token: String(token.body.refresh_token),
      client_id: CLIENT,
    });
    expect(refreshed.res.status).toBe(200);
  });

  it('enforces the document’s redirect_uris and refuses a bad document on the page', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    serve({ client_name: 'Example Assistant' });
    expect((await authorize(CLIENT, 'https://evil.test/cb')).status).toBe(400);
    // Served at another URL, the same document names a client_id that isn't where it was fetched from.
    const refused = await authorize('https://client.example.com/oauth/elsewhere.json', CALLBACK);
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain('client_id is not the URL');
  });

  it('never fetches a non-https or private client id', async () => {
    const network = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const id of [
      'http://client.example.com/m.json',
      'https://169.254.169.254/latest/meta-data',
    ])
      expect((await authorize(id, CALLBACK)).status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });

  it('never renews a metadata client as a registration', async () => {
    serve({ client_name: 'Example Assistant' });
    const put = vi.spyOn(env.OAUTH_KV, 'put');
    await authorize(CLIENT, CALLBACK);
    expect(put.mock.calls.map((c) => c[0])).not.toContain(`client:${CLIENT}`);
  });
});

describe('app-scheme redirects (Work Tracker 1450)', () => {
  const CURSOR = 'cursor://anysphere.cursor-retrieval/oauth/user-mcp/callback';

  it('registers Cursor’s own scheme, matches it exactly, and tells the consent page', async () => {
    const reg = await register([CURSOR], 'Cursor');
    expect(reg.status).toBe(201);
    const { client_id } = await reg.json<{ client_id: string }>();
    const auth = await authorize(client_id, CURSOR);
    expect(auth.status).toBe(302);
    expect(await (await call(`/oauth/session/${sessionOf(auth)}`)).json()).toMatchObject({
      clientName: 'Cursor',
      verified: false,
      localScheme: 'cursor',
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const near of [
      'cursor://anysphere.cursor-retrieval/oauth/user-mcp/callback2',
      'cursor://evil/oauth/user-mcp/callback',
      'cursor-evil://anysphere.cursor-retrieval/oauth/user-mcp/callback',
    ])
      expect((await authorize(client_id, near)).status).toBe(400);
    // The code goes back to the app, and the token exchange takes it.
    const token = await signIn(client_id, CURSOR);
    expect(token.body.access_token).toMatch(/^lwm_/);
  });

  it('sends a request the client got wrong back to its app scheme with the error', async () => {
    const { client_id } = await (await register([CURSOR], 'Cursor')).json<{ client_id: string }>();
    const res = await call(
      `/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(CURSOR)}&response_type=token&state=s`,
    );
    const back = res.headers.get('location')!;
    expect(back.startsWith(`${CURSOR}?`)).toBe(true);
    expect(new URL(back).searchParams.get('error')).toBe('unsupported_response_type');
  });

  it('leaves a web redirect without the local-app mark', async () => {
    const { client_id } = await (
      await register(['https://client.test/cb'])
    ).json<{ client_id: string }>();
    const auth = await authorize(client_id, 'https://client.test/cb');
    expect(await (await call(`/oauth/session/${sessionOf(auth)}`)).json()).not.toHaveProperty(
      'localScheme',
    );
  });

  it('refuses web and system schemes, and a reserved name on an app scheme', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const uri of [
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      'intent://x',
      'c:/x',
    ])
      expect((await register([uri])).status).toBe(400);
    expect((await register([CURSOR], 'livediagram')).status).toBe(400);
    expect((await register([CURSOR], 'Claude')).status).toBe(400);
    expect((await register(['claude://callback'], 'Claude')).status).toBe(201);
    expect((await register(['vscode://publisher.ext/cb'], 'My VS Code helper')).status).toBe(201);
  });
});
