import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connect, fetchConsentSession, handOverError, mcpOrigin } from './mcp-connect';

// The one MCP's consent hand-over (liveworkspace/docs/specs/021-mcp/mcp.md "Sign-in and per-app consent"): every
// call the page makes, against a stubbed MCP and accounts API.
type Seen = { url: string; method: string; body: unknown };
let seen: Seen[];
let routes: Record<string, (body: unknown) => Response>;

beforeEach(() => {
  seen = [];
  routes = {
    'GET https://mcp.test/oauth/session/s1': () =>
      Response.json({ clientName: 'Claude', redirectHost: 'claude.ai', verified: false }),
    'POST /api/account/tokens': () =>
      Response.json({ id: 't-new', secret: 'lwt_new', expiresAt: 99 }, { status: 201 }),
    'POST https://mcp.test/oauth/complete': () =>
      Response.json({
        redirectTo: 'https://claude.ai/cb?code=c',
        replaces: ['t-old', 't-other', 't-new'],
      }),
    'GET /api/account/tokens': () =>
      Response.json({
        tokens: [
          { id: 't-new', name: 'Claude' },
          { id: 't-old', name: 'Claude' },
          { id: 't-other', name: 'My script' },
        ],
      }),
  };
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    seen.push({ url: input, method, body });
    const route = routes[`${method} ${input}`];
    if (route) return route(body);
    if (method === 'DELETE') return Response.json({ id: input.split('/').pop() });
    return new Response('{}', { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mcpOrigin', () => {
  it('follows the page’s own host', () => {
    expect(mcpOrigin({ hostname: 'www.liveworkspace.app', protocol: 'https:' })).toBe(
      'https://mcp.liveworkspace.app',
    );
    expect(mcpOrigin({ hostname: 'staging.liveworkspace.app', protocol: 'https:' })).toBe(
      'https://mcp-staging.liveworkspace.app',
    );
    expect(mcpOrigin({ hostname: 'localhost', protocol: 'http:' })).toBe('http://localhost:3013');
  });
});

describe('fetchConsentSession', () => {
  it('reads the request, and null when it has gone', async () => {
    expect(await fetchConsentSession('https://mcp.test', 's1')).toEqual({
      clientName: 'Claude',
      redirectHost: 'claude.ai',
      verified: false,
    });
    expect(await fetchConsentSession('https://mcp.test', 'gone')).toBeNull();
  });

  it('names an unnamed client "An app"', async () => {
    routes['GET https://mcp.test/oauth/session/s1'] = () => Response.json({});
    expect((await fetchConsentSession('https://mcp.test', 's1'))?.clientName).toBe('An app');
  });
});

describe('connect', () => {
  it('mints a read-only token when read-only is chosen', async () => {
    await connect('https://mcp.test', 's1', 'Claude', ['livediagram'], true);
    expect(seen.find((s) => s.method === 'POST' && s.url === '/api/account/tokens')?.body).toEqual({
      name: 'Claude',
      readOnly: true,
    });
  });

  it('mints a token named for the client, hands it over with the ticked apps and retires its earlier one', async () => {
    const result = await connect('https://mcp.test', 's1', 'Claude', [
      'livediagram',
      'liveplanner',
    ]);
    expect(result).toEqual({ ok: true, redirectTo: 'https://claude.ai/cb?code=c' });
    expect(seen.find((s) => s.method === 'POST' && s.url === '/api/account/tokens')?.body).toEqual({
      name: 'Claude',
      readOnly: false,
    });
    expect(seen.find((s) => s.url === 'https://mcp.test/oauth/complete')?.body).toEqual({
      session: 's1',
      token: 'lwt_new',
      expiresAt: 99,
      tokenId: 't-new',
      apps: ['livediagram', 'liveplanner'],
    });
    // Only the client's own earlier token goes: never the new one, never another name's.
    expect(seen.filter((s) => s.method === 'DELETE').map((s) => s.url)).toEqual([
      '/api/account/tokens/t-old',
    ]);
  });

  it('stops at an expired request before minting anything', async () => {
    expect(await connect('https://mcp.test', 'gone', 'Claude', ['livediagram'])).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(seen.some((s) => s.url === '/api/account/tokens')).toBe(false);
  });

  it('says so at the token limit', async () => {
    routes['POST /api/account/tokens'] = () =>
      Response.json({ error: 'token_limit_reached' }, { status: 409 });
    expect(await connect('https://mcp.test', 's1', 'Claude', [])).toEqual({
      ok: false,
      reason: 'token_limit',
    });
  });

  it('fails on a mint the accounts API refused', async () => {
    routes['POST /api/account/tokens'] = () => Response.json({}, { status: 500 });
    expect(await connect('https://mcp.test', 's1', 'Claude', [])).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('revokes the new token when the MCP refuses it, or answers a redirect that is not a web address', async () => {
    routes['POST https://mcp.test/oauth/complete'] = () => Response.json({}, { status: 400 });
    expect(await connect('https://mcp.test', 's1', 'Claude', [])).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(seen.filter((s) => s.method === 'DELETE').map((s) => s.url)).toEqual([
      '/api/account/tokens/t-new',
    ]);
    seen = [];
    routes['POST https://mcp.test/oauth/complete'] = () =>
      Response.json({ redirectTo: 'javascript:alert(1)' });
    expect(await connect('https://mcp.test', 's1', 'Claude', [])).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(seen.filter((s) => s.method === 'DELETE')).toHaveLength(1);
  });

  it('leaves tokens be when nothing is replaced or the list can’t be read', async () => {
    routes['POST https://mcp.test/oauth/complete'] = () =>
      Response.json({ redirectTo: 'https://claude.ai/cb' });
    expect((await connect('https://mcp.test', 's1', 'Claude', [])).ok).toBe(true);
    routes['POST https://mcp.test/oauth/complete'] = () =>
      Response.json({ redirectTo: 'https://claude.ai/cb', replaces: ['t-old'] });
    routes['GET /api/account/tokens'] = () => Response.json({}, { status: 500 });
    expect((await connect('https://mcp.test', 's1', 'Claude', [])).ok).toBe(true);
    expect(seen.filter((s) => s.method === 'DELETE')).toEqual([]);
  });
});

describe('handOverError', () => {
  it('says what to do for each failure', () => {
    expect(handOverError('expired')).toContain('Start again');
    expect(handOverError('token_limit')).toContain('API Tokens');
    expect(handOverError('failed')).toContain('Couldn’t connect');
  });
});
