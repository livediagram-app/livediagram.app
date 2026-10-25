import { describe, expect, it } from 'vitest';
import {
  createDriveClient,
  driveConnectUrl,
  parseDriveOpenState,
  withCloudSyncOpen,
} from './client';

type Sent = { url: string; method: string; headers: Headers; body: unknown };

function stub(answer: (sent: Sent) => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    const call = {
      url,
      method: init.method ?? 'GET',
      headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    sent.push(call);
    return answer(call);
  }) as unknown as typeof globalThis.fetch;
  return { sent, fetch };
}

describe('createDriveClient', () => {
  it('calls this origin’s /api/drive with the person’s bearer', async () => {
    const { sent, fetch } = stub(() => Response.json({ enabled: true, connected: false }));
    const client = createDriveClient({ getToken: () => 'tok', fetch });
    expect(await client.config()).toEqual({ ok: true, data: { enabled: true, connected: false } });
    expect(sent[0]!.url).toBe('/api/drive/config');
    expect(sent[0]!.headers.get('authorization')).toBe('Bearer tok');
  });

  it('posts the bodies the routes take', async () => {
    const { sent, fetch } = stub(() => new Response(null, { status: 204 }));
    const client = createDriveClient({
      baseUrl: 'https://lw.test/api/drive/',
      getToken: () => 't',
      fetch,
    });
    await client.state('https://lw.test/explorer');
    await client.connect('c', 's');
    await client.cancelSwitch();
    await client.open('file_1');
    expect(sent.map((s) => [s.method, s.url, s.body])).toEqual([
      ['POST', 'https://lw.test/api/drive/state', { returnTo: 'https://lw.test/explorer' }],
      ['POST', 'https://lw.test/api/drive/connect', { code: 'c', state: 's' }],
      ['DELETE', 'https://lw.test/api/drive/account-switch', undefined],
      ['POST', 'https://lw.test/api/drive/open', { fileId: 'file_1' }],
    ]);
  });

  it('answers a refusal, an outage and a missing token as results, never throws', async () => {
    const refused = stub(() => Response.json({ error: 'needs_reconnect' }, { status: 409 }));
    expect(await createDriveClient({ getToken: () => 't', fetch: refused.fetch }).marks()).toEqual({
      ok: false,
      status: 409,
      error: 'needs_reconnect',
    });
    const odd = stub(() => new Response('<html>', { status: 502 }));
    expect(
      await createDriveClient({ getToken: () => 't', fetch: odd.fetch }).marks(),
    ).toMatchObject({
      error: 'failed',
    });
    const down = stub(() => {
      throw new TypeError('network');
    });
    expect(
      await createDriveClient({ getToken: () => 't', fetch: down.fetch }).marks(),
    ).toMatchObject({
      status: 0,
      error: 'offline',
    });
    const none = stub(() => Response.json({}));
    expect(
      await createDriveClient({ getToken: () => null, fetch: none.fetch }).marks(),
    ).toMatchObject({
      error: 'signed_out',
    });
    expect(none.sent).toEqual([]);
  });
});

describe('connect URL', () => {
  it('opens Settings on Cloud Sync in the page to come back to', () => {
    expect(withCloudSyncOpen('https://liveplanner.app/project/p1?tab=2#x', 'account:account')).toBe(
      'https://liveplanner.app/project/p1?tab=2&settings=account%3Aaccount&section=cloud-sync#x',
    );
    // An earlier deep link is replaced, not doubled.
    expect(
      withCloudSyncOpen('https://lw.test/explorer?settings=privacy&section=x&q=1', 'profile'),
    ).toBe('https://lw.test/explorer?q=1&settings=profile&section=cloud-sync');
  });

  it('goes to liveworkspace’s /drive/connect with the return page', () => {
    expect(driveConnectUrl('https://lw.test/', 'https://livediagram.app/d/1?settings=a')).toBe(
      'https://lw.test/drive/connect?return=https%3A%2F%2Flivediagram.app%2Fd%2F1%3Fsettings%3Da',
    );
  });
});

describe('parseDriveOpenState', () => {
  const search = (state: unknown) =>
    `?state=${encodeURIComponent(typeof state === 'string' ? state : JSON.stringify(state))}`;

  it('reads the first file Drive asks to open', () => {
    expect(
      parseDriveOpenState(
        search({ ids: ['1AbC_d-9'], action: 'open', userId: '1234', resourceKeys: {} }),
      ),
    ).toEqual({ fileId: '1AbC_d-9', userId: '1234' });
  });

  it('refuses anything else', () => {
    expect(parseDriveOpenState('')).toBeNull();
    expect(parseDriveOpenState(search('not json'))).toBeNull();
    expect(parseDriveOpenState(search({ ids: ['a'], action: 'create' }))).toBeNull();
    expect(parseDriveOpenState(search({ ids: [], action: 'open' }))).toBeNull();
    expect(parseDriveOpenState(search({ ids: ['../x'], action: 'open' }))).toBeNull();
  });
});
