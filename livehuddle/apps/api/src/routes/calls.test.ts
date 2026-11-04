// The calls mint route (docs/specs/012-collaboration/proximity-audio.md "The mint route"), against a mocked Cloudflare
// Realtime: the grant first, then the gate, then the session's token and the locators' signatures, and only then a
// call upstream, with only the fields the editor needs coming back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@livehuddle/api-schema';
import type { Env } from '../types';
import type { ItemGrant } from '../index-service';
import { sealSessionToken, sealTrackToken } from '../calls/call-tokens';
import { makeTestRouteContext } from './test-route-context';

let grant: ItemGrant | null | Response = null;
vi.mock('./document-grant', () => ({
  resolveDocumentGrant: vi.fn(async () => grant),
}));
const { handleCallRoutes, MAX_SUBSCRIBE_BATCH } = await import('./calls');

const SECRETS = {
  REALTIME_APP_ID: 'app1',
  REALTIME_APP_TOKEN: 'secret',
  TURN_KEY_ID: 'turn1',
  TURN_KEY_API_TOKEN: 'turn-secret',
};
const DOC = 'doc1';

function grantAt(level: AccessLevel, trashed = false): ItemGrant {
  return {
    item: DOC,
    level,
    tab: null,
    sub: 'guest_00000000-0000-4000-8000-000000000002',
    team: null,
    exp: 9_999_999_999,
    shareCode: 'LINK',
    token: 'signed',
    ...(trashed ? { trashed: true } : {}),
  };
}

type Upstream = { url: string; method: string; auth: string | null; body: unknown };
let upstream: Upstream[] = [];
let answer: (url: string) => Response;

beforeEach(() => {
  grant = grantAt('participate');
  upstream = [];
  answer = (url) => {
    if (url.endsWith('/sessions/new'))
      return Response.json({ sessionId: 'sess1', extra: 'hidden' });
    if (url.includes('/turn/')) {
      return Response.json(
        {
          iceServers: [
            {
              urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53?transport=udp'],
            },
            { urls: 'turn:turn.cloudflare.com:443?transport=tcp', username: 'u', credential: 'c' },
            { urls: [] },
            null,
          ],
        },
        { status: 201 },
      );
    }
    return Response.json({
      requiresImmediateRenegotiation: true,
      sessionDescription: { type: 'offer', sdp: 'v=0 sfu' },
      tracks: [{ mid: '0', trackName: 'mic', sessionId: 'pub1', secret: 'no' }, 'junk'],
      leaked: true,
    });
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      upstream.push({
        url,
        method: init.method ?? 'GET',
        auth: new Headers(init.headers).get('Authorization'),
        body: init.body ? JSON.parse(init.body as string) : undefined,
      });
      return answer(url);
    }),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function call(method: string, action: string, body?: unknown, env: Partial<Env> = SECRETS) {
  return handleCallRoutes(
    makeTestRouteContext(method, `/api/documents/${DOC}/calls/${action}`, {
      env: env as Env,
      ...(body === undefined ? {} : { body }),
    }),
  ) as Promise<Response>;
}

const speakerProof = async () => ({
  sessionId: 'sess1',
  sessionToken: await sealSessionToken('secret', DOC, 'sess1', 's'),
});
const listenerProof = async () => ({
  sessionId: 'sess1',
  sessionToken: await sealSessionToken('secret', DOC, 'sess1', 'l'),
});
const locator = async (doc = DOC, sessionId = 'pub1') => ({
  sessionId,
  trackName: 'mic',
  token: await sealTrackToken('secret', doc, sessionId),
});

describe('which requests are calls routes', () => {
  it('leaves every other path to the next handler, and 404s an unknown action or method', async () => {
    const ctx = makeTestRouteContext('POST', `/api/documents/${DOC}/room-ticket`, {
      env: {} as Env,
    });
    expect(await handleCallRoutes(ctx)).toBeNull();
    expect((await call('GET', 'session')).status).toBe(404);
    expect((await call('POST', 'hangup')).status).toBe(404);
    expect(upstream).toEqual([]);
  });
});

describe('the gates, in order', () => {
  it('answers 404 with no grant, the grant’s own refusal, and 410 for a Space in the Trash', async () => {
    grant = null;
    expect((await call('POST', 'session')).status).toBe(404);
    grant = new Response(null, { status: 401 });
    expect((await call('POST', 'session')).status).toBe(401);
    grant = grantAt('edit', true);
    expect((await call('POST', 'session')).status).toBe(410);
    expect(upstream).toEqual([]);
  });

  it('refuses every session on production, whatever is set (the hard flag)', async () => {
    const res = await call('POST', 'session', undefined, {
      ...SECRETS,
      APP_BASE_URL: 'https://www.livehuddle.app',
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'calls_off', reason: 'production' });
    expect(upstream).toEqual([]);
  });

  it('is off without the secrets', async () => {
    const res = await call('POST', 'session', undefined, {});
    expect(await res.json()).toEqual({ error: 'calls_off', reason: 'unconfigured' });
  });
});

describe('POST session', () => {
  it('mints a speaker’s session with TURN, leaving out port 53 and anything malformed', async () => {
    const res = await call('POST', 'session');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      sessionId: 'sess1',
      sessionToken: (await speakerProof()).sessionToken,
      trackToken: (await locator(DOC, 'sess1')).token,
      canSpeak: true,
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478'] },
        { urls: 'turn:turn.cloudflare.com:443?transport=tcp', username: 'u', credential: 'c' },
      ],
    });
    expect(upstream.map((u) => [u.method, u.url, u.auth])).toEqual([
      ['POST', 'https://rtc.live.cloudflare.com/v1/apps/app1/sessions/new', 'Bearer secret'],
      [
        'POST',
        'https://rtc.live.cloudflare.com/v1/turn/keys/turn1/credentials/generate-ice-servers',
        'Bearer turn-secret',
      ],
    ]);
    expect(upstream[1]!.body).toEqual({ ttl: 14_400 });
  });

  it('mints a listener’s for a Viewer: no track token, no speaking', async () => {
    grant = grantAt('view');
    const body = (await (await call('POST', 'session')).json()) as Record<string, unknown>;
    expect(body.canSpeak).toBe(false);
    expect(body).not.toHaveProperty('trackToken');
    expect(body.sessionToken).toBe((await listenerProof()).sessionToken);
  });

  it('answers 502 when Realtime fails, or answers without a session', async () => {
    answer = () => new Response('nope', { status: 500 });
    expect((await call('POST', 'session')).status).toBe(502);
    answer = (url) =>
      url.includes('/turn/') ? Response.json({}) : Response.json({ sessionId: '' });
    expect((await call('POST', 'session')).status).toBe(502);
    answer = () => new Response('not json', { status: 200 });
    expect((await call('POST', 'session')).status).toBe(502);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    );
    const res = await call('POST', 'session');
    expect(await res.json()).toEqual({ error: 'calls_upstream' });
  });

  it('passes on an error that is not Realtime’s', async () => {
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(new TypeError('bug'));
    await expect(call('POST', 'session')).rejects.toThrow('bug');
  });
});

describe('POST tracks', () => {
  it('publishes a speaker’s microphone, named by the server, and answers only the known fields', async () => {
    const res = await call('POST', 'tracks', {
      ...(await speakerProof()),
      publish: { sdp: 'v=0 offer', mid: '0' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      requiresImmediateRenegotiation: true,
      sessionDescription: { type: 'offer', sdp: 'v=0 sfu' },
      tracks: [{ mid: '0', trackName: 'mic', sessionId: 'pub1' }, {}],
    });
    expect(upstream[0]).toMatchObject({
      method: 'POST',
      url: 'https://rtc.live.cloudflare.com/v1/apps/app1/sessions/sess1/tracks/new',
      body: {
        sessionDescription: { type: 'offer', sdp: 'v=0 offer' },
        tracks: [{ location: 'local', mid: '0', trackName: 'mic' }],
      },
    });
  });

  it('refuses a Viewer’s publish, and a listener session’s even with a speaker’s grant', async () => {
    grant = grantAt('view');
    const publish = { sdp: 'v=0', mid: '0' };
    const viewer = await call('POST', 'tracks', { ...(await speakerProof()), publish });
    expect(viewer.status).toBe(403);
    expect(await viewer.json()).toEqual({ error: 'calls_listen_only' });
    grant = grantAt('edit');
    expect((await call('POST', 'tracks', { ...(await listenerProof()), publish })).status).toBe(
      403,
    );
    expect(upstream).toEqual([]);
  });

  it('subscribes anyone, a Viewer included, to microphones signed for this Space', async () => {
    grant = grantAt('view');
    const res = await call('POST', 'tracks', {
      ...(await listenerProof()),
      subscribe: [await locator(), await locator(DOC, 'pub2')],
    });
    expect(res.status).toBe(200);
    expect(upstream[0]!.body).toEqual({
      tracks: [
        { location: 'remote', sessionId: 'pub1', trackName: 'mic' },
        { location: 'remote', sessionId: 'pub2', trackName: 'mic' },
      ],
    });
  });

  it('refuses a locator from another Space, a forged one, a camera, an empty or oversized batch', async () => {
    const proof = await listenerProof();
    const tooMany = await Promise.all(
      Array.from({ length: MAX_SUBSCRIBE_BATCH + 1 }, (_, i) => locator(DOC, `p${i}`)),
    );
    for (const subscribe of [
      [await locator('doc2')],
      [{ ...(await locator()), token: 'forged' }],
      [{ ...(await locator()), trackName: 'camera' }],
      [],
      tooMany,
      'pub1',
    ]) {
      const res = await call('POST', 'tracks', { ...proof, subscribe });
      expect(res.status).toBe(400);
    }
    expect(upstream).toEqual([]);
  });

  it('refuses a session token for another session, a bad body, and publish with subscribe', async () => {
    const proof = await speakerProof();
    const publish = { sdp: 'v=0', mid: '0' };
    for (const body of [
      { ...proof, sessionId: 'sess2', publish },
      { sessionId: 'sess1', publish },
      { ...proof, sessionId: 7, publish },
      { ...proof },
      { ...proof, publish, subscribe: [await locator()] },
      { ...proof, publish: { sdp: '', mid: '0' } },
      { ...proof, publish: { sdp: 'v=0', mid: 'x'.repeat(17) } },
      { ...proof, publish: null },
    ]) {
      expect((await call('POST', 'tracks', body)).status).toBe(400);
    }
    expect((await call('POST', 'tracks', [1])).status).toBe(400);
    const raw = makeTestRouteContext('POST', `/api/documents/${DOC}/calls/tracks`, {
      env: SECRETS as Env,
      rawBody: '{nope',
    });
    expect((await handleCallRoutes(raw))!.status).toBe(400);
    expect(upstream).toEqual([]);
  });
});

describe('PUT renegotiate and close', () => {
  it('passes the browser’s answer on', async () => {
    const res = await call('PUT', 'renegotiate', { ...(await listenerProof()), sdp: 'v=0 answer' });
    expect(await res.json()).toEqual({ ok: true });
    expect(upstream[0]).toMatchObject({
      method: 'PUT',
      url: 'https://rtc.live.cloudflare.com/v1/apps/app1/sessions/sess1/renegotiate',
      body: { sessionDescription: { type: 'answer', sdp: 'v=0 answer' } },
    });
    expect((await call('PUT', 'renegotiate', { ...(await listenerProof()) })).status).toBe(400);
    expect((await call('PUT', 'renegotiate', { sdp: 'v=0' })).status).toBe(400);
  });

  it('closes with the browser’s offer, or forces the close without one', async () => {
    const proof = await listenerProof();
    await call('PUT', 'close', { ...proof, mids: ['1', '2'], sdp: 'v=0 offer' });
    await call('PUT', 'close', { ...proof, mids: ['3'] });
    expect(upstream.map((u) => u.body)).toEqual([
      {
        tracks: [{ mid: '1' }, { mid: '2' }],
        sessionDescription: { type: 'offer', sdp: 'v=0 offer' },
        force: false,
      },
      { tracks: [{ mid: '3' }], force: true },
    ]);
    expect(upstream[0]!.url).toBe(
      'https://rtc.live.cloudflare.com/v1/apps/app1/sessions/sess1/tracks/close',
    );
  });

  it('refuses no mids, too many, a malformed one, or a malformed offer', async () => {
    const proof = await listenerProof();
    for (const body of [
      { ...proof, mids: [] },
      { ...proof, mids: Array.from({ length: MAX_SUBSCRIBE_BATCH + 1 }, (_, i) => String(i)) },
      { ...proof, mids: [3] },
      { ...proof, mids: ['1'], sdp: '' },
      { ...proof, mids: 'all' },
    ]) {
      expect((await call('PUT', 'close', body)).status).toBe(400);
    }
    expect(upstream).toEqual([]);
  });
});
