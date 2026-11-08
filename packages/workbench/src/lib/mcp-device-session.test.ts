import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { deviceSessionClient, parseDeviceSession, userCodeOf } from './mcp-device-session';

// docs/specs/015-api/blueprints/cli.md "The device grant", CLI36.

const MCP_ORIGIN = 'https://mcp.example.app';
const device = deviceSessionClient(MCP_ORIGIN);

function stubFetch(answer: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; body?: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init?.body ? { body: sentJson(init) } : {}) });
    return answer(url, init);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('userCodeOf', () => {
  it('reads a typed code in any case and spacing, and refuses what cannot be one', () => {
    expect(userCodeOf(' bcdf ghjk ')).toBe('BCDF-GHJK');
    expect(userCodeOf('BCDF-GHJA')).toBeNull();
    expect(userCodeOf('')).toBeNull();
  });
});

describe('parseDeviceSession', () => {
  it('keeps the name, the time and the place the server gave', () => {
    expect(
      parseDeviceSession({
        clientName: 'example CLI',
        startedAt: 5,
        startedIn: { city: 'Dublin', country: 'IE' },
      }),
    ).toEqual({
      clientName: 'example CLI',
      startedAt: 5,
      startedIn: { city: 'Dublin', country: 'IE' },
    });
    expect(parseDeviceSession({ clientName: 'c', startedIn: { country: 'NZ', city: '' } })).toEqual(
      {
        clientName: 'c',
        startedAt: null,
        startedIn: { country: 'NZ' },
      },
    );
    expect(parseDeviceSession({ clientName: 'c', startedIn: { city: 'Lima' } })).toMatchObject({
      startedIn: { city: 'Lima' },
    });
  });

  it('shows nothing for a missing or malformed time or place', () => {
    for (const extra of [
      {},
      { startedAt: 'soon', startedIn: 'Dublin' },
      { startedAt: Number.NaN, startedIn: null },
      { startedIn: { city: 7 } },
    ])
      expect(parseDeviceSession({ clientName: 'c', ...extra })).toEqual({
        clientName: 'c',
        startedAt: null,
        startedIn: null,
      });
  });

  it('is null without a name', () => {
    for (const body of [null, 'x', {}, { clientName: '' }, { clientName: 4 }])
      expect(parseDeviceSession(body)).toBeNull();
  });
});

describe('fetchSession', () => {
  it('asks the MCP origin and returns the session', async () => {
    const calls = stubFetch(() => Response.json({ clientName: 'example CLI', startedAt: 1 }));
    expect(await device.fetchSession('BCDF-GHJK')).toEqual({
      clientName: 'example CLI',
      startedAt: 1,
      startedIn: null,
    });
    expect(calls[0]!.url).toBe(`${MCP_ORIGIN}/oauth/device/session/BCDF-GHJK`);
  });

  it('is null for an unknown code, a malformed answer and a network failure', async () => {
    stubFetch(() => Response.json({ error: 'invalid_code' }, { status: 404 }));
    expect(await device.fetchSession('X')).toBeNull();
    stubFetch(() => Response.json({ clientName: '' }));
    expect(await device.fetchSession('X')).toBeNull();
    stubFetch(() => Response.json(null));
    expect(await device.fetchSession('X')).toBeNull();
    stubFetch(() => {
      throw new Error('offline');
    });
    expect(await device.fetchSession('X')).toBeNull();
  });
});

describe('complete and deny', () => {
  it('post the code with the token, or the refusal, and say whether it landed', async () => {
    const calls = stubFetch(() => Response.json({ ok: true }));
    expect(await device.complete('BCDF-GHJK', 'lwt_x', 5)).toBe(true);
    expect(await device.complete('BCDF-GHJK', 'lwt_y', null)).toBe(true);
    expect(await device.deny('BCDF-GHJK')).toBe(true);
    expect(calls.map((c) => [c.url.replace(MCP_ORIGIN, ''), c.body])).toEqual([
      ['/oauth/device/complete', { userCode: 'BCDF-GHJK', token: 'lwt_x', expiresAt: 5 }],
      ['/oauth/device/complete', { userCode: 'BCDF-GHJK', token: 'lwt_y' }],
      ['/oauth/device/deny', { userCode: 'BCDF-GHJK' }],
    ]);
    stubFetch(() => Response.json({ error: 'invalid_code' }, { status: 400 }));
    expect(await device.deny('X')).toBe(false);
    stubFetch(() => {
      throw new Error('offline');
    });
    expect(await device.complete('X', 't', null)).toBe(false);
  });
});
