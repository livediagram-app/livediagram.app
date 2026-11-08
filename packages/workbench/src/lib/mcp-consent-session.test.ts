// The consent screen's trust boundary (docs/specs/015-api/mcp-server.md §3): what it is allowed to believe about an
// authorize request, and where that comes from.
//
// The screen tells the user which host a full-access API token is about to be delivered to. It used to read that off
// its own query params, which whoever sent the user there controls, so an attacker could register a client, obtain a
// session, and hand the victim a consent URL reading "Access will be sent to notion.so" while the code went to their
// own redirect_uri. These cases pin the properties that fix it: the answer is fetched from the TRUSTED MCP origin,
// anything less than a well-formed answer reads as "couldn't resolve", and only the server's `verified: true` makes
// a client verified.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchConsentSession, parseConsentSession } from './mcp-consent-session';

const MCP_ORIGIN = 'https://mcp.example.app';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Stub fetch and record the URL it was called with.
function stubFetch(res: Partial<Response> | Error) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (res instanceof Error) throw res;
      return res as Response;
    }),
  );
  return calls;
}

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Partial<Response>;

describe('parseConsentSession', () => {
  it('accepts a well-formed body, unverified unless the server says so', () => {
    expect(parseConsentSession({ clientName: 'Claude', redirectHost: 'claude.ai' })).toEqual({
      clientName: 'Claude',
      redirectHost: 'claude.ai',
      clientId: null,
      verified: false,
    });
    expect(
      parseConsentSession({ clientName: 'Claude', redirectHost: 'claude.ai', verified: 'true' }),
    ).toMatchObject({ verified: false });
  });

  it('keeps the public client id, which tells the CLI apart, and its verified mark', () => {
    expect(
      parseConsentSession({
        clientName: 'example CLI',
        redirectHost: '127.0.0.1:5',
        clientId: 'example-cli',
        verified: true,
      }),
    ).toEqual({
      clientName: 'example CLI',
      redirectHost: '127.0.0.1:5',
      clientId: 'example-cli',
      verified: true,
    });
  });

  it('tolerates a blank host (the server reports one for an unparseable uri)', () => {
    expect(parseConsentSession({ clientName: 'Claude', redirectHost: '' })).toMatchObject({
      clientName: 'Claude',
      redirectHost: '',
    });
  });

  it('rejects a missing or wrongly-typed field rather than rendering undefined', () => {
    expect(parseConsentSession({ clientName: 'Claude' })).toBeNull();
    expect(parseConsentSession({ redirectHost: 'claude.ai' })).toBeNull();
    expect(parseConsentSession({ clientName: 'Claude', redirectHost: 42 })).toBeNull();
    expect(parseConsentSession({ clientName: '', redirectHost: 'x' })).toBeNull();
  });

  it('rejects non-objects', () => {
    for (const v of [null, undefined, 'Claude', 7, []]) expect(parseConsentSession(v)).toBeNull();
  });
});

describe('fetchConsentSession', () => {
  it('asks the trusted MCP origin, never a value from the page URL', async () => {
    const calls = stubFetch(ok({ clientName: 'Claude', redirectHost: 'claude.ai' }));
    await fetchConsentSession(MCP_ORIGIN, 'sess-1');
    expect(calls).toEqual([`${MCP_ORIGIN}/oauth/session/sess-1`]);
  });

  it('encodes the session id into the path', async () => {
    const calls = stubFetch(ok({ clientName: 'C', redirectHost: 'h' }));
    await fetchConsentSession(MCP_ORIGIN, 'a/../b?x=1');
    expect(calls[0]).toBe(`${MCP_ORIGIN}/oauth/session/a%2F..%2Fb%3Fx%3D1`);
  });

  it('returns the parsed session on success', async () => {
    stubFetch(ok({ clientName: 'Claude', redirectHost: 'claude.ai' }));
    expect(await fetchConsentSession(MCP_ORIGIN, 's')).toEqual({
      clientName: 'Claude',
      redirectHost: 'claude.ai',
      clientId: null,
      verified: false,
    });
  });

  it('is null on a 404 (expired / unknown session)', async () => {
    stubFetch({ ok: false, status: 404, json: async () => ({ error: 'invalid_session' }) });
    expect(await fetchConsentSession(MCP_ORIGIN, 's')).toBeNull();
  });

  it('is null when the network fails', async () => {
    stubFetch(new Error('offline'));
    expect(await fetchConsentSession(MCP_ORIGIN, 's')).toBeNull();
  });

  it('is null on a 200 carrying a malformed body', async () => {
    stubFetch(ok({ clientName: 'Claude' }));
    expect(await fetchConsentSession(MCP_ORIGIN, 's')).toBeNull();
  });
});
