// The calls mint route (docs/specs/012-collaboration/proximity-audio.md "The mint route"), against a mocked Cloudflare
// Realtime: the grant first, then the gate, then the session's token and the locators' signatures, and only then a
// call upstream, with only the fields the editor needs coming back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@livehuddle/api-schema';
import type { Env } from '../types';
import type { ItemGrant } from '../index-service';
import { sealSessionToken, sealTrackToken } from '../calls/call-tokens';
import { resetCallsModeCache } from '../calls/calls-mode';
import { fakeKv } from '../calls/fake-kv';
import { makeTestRouteContext } from './test-route-context';

let grant: ItemGrant | null | Response = null;
vi.mock('./document-grant', () => ({
  resolveDocumentGrant: vi.fn(async () => grant),
}));
// What kind of media a track name carries: the real table, unless a test plays a video track through the route.
const trackKinds = vi.hoisted(() => ({ asVideo: false }));
vi.mock('../calls/calls-mode', async (load) => {
  const real = await load<typeof import('../calls/calls-mode')>();
  return {
    ...real,
    callTrackKind: (name: string) => (trackKinds.asVideo ? 'video' : real.callTrackKind(name)),
  };
});
// The Space's room answers the hearing check (#483): every track heard, unless a test says otherwise.
const room = vi.hoisted(() => ({
  answers: null as null | ((asks: { sessionId: string }[]) => string[]),
  asked: [] as { subscriber: string; asks: unknown }[],
  // The Space's Community post, when it has one (docs/specs/025-community/community.md).
  post: null as null | { code: string; open: boolean },
}));
vi.mock('../document-client', () => ({
  documentRoom: () => ({
    community: async () => room.post,
    callsHearing: async (subscriber: string, asks: { sessionId: string }[]) => {
      room.asked.push({ subscriber, asks });
      return room.answers ? room.answers(asks) : asks.map(() => 'heard');
    },
  }),
}));
const { handleCallRoutes, MAX_SUBSCRIBE_BATCH, mediaRefused } = await import('./calls');

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
  resetCallsModeCache();
  trackKinds.asVideo = false;
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
  room.answers = null;
  room.asked = [];
  room.post = null;
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

  // docs/specs/025-community/community.md: a Community post's link is a content-only pass, never the room, so never
  // a call in it, whether the post is listed or hidden.
  it('refuses a Community post’s link with 403 community_link, before it says whether calls are on', async () => {
    grant = { ...grantAt('view'), shareCode: 'POST' };
    for (const open of [true, false]) {
      room.post = { code: 'POST', open };
      const res = await call('POST', 'session');
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'community_link' });
      expect((await call('POST', 'tracks', { sessionId: 'x' })).status).toBe(403);
      // Calls off: still the Community refusal, never `calls_off`.
      expect((await call('POST', 'session', undefined, {})).status).toBe(403);
    }
    expect(upstream).toEqual([]);
    // An ordinary view link on a Space with a post still listens in.
    grant = grantAt('view');
    expect((await call('POST', 'session')).status).toBe(200);
  });

  it('mints a session on production once the secrets are set', async () => {
    const res = await call('POST', 'session', undefined, {
      ...SECRETS,
      APP_BASE_URL: 'https://www.livehuddle.app',
    });
    expect(res.status).toBe(200);
    expect(upstream.length).toBeGreaterThan(0);
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
      mode: 'on',
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

  // proximity-audio.md "A session that expires": Realtime's 410 is its own answer, so the browser renews the session.
  it('answers 410 calls_session_gone when Realtime says the session is gone', async () => {
    answer = () => new Response('gone', { status: 410 });
    const res = await call('POST', 'tracks', {
      ...(await speakerProof()),
      publish: { sdp: 'v=0 offer', mid: '0' },
    });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: 'calls_session_gone' });
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

  // docs/specs/012-collaboration/meeting-rooms-and-stage.md "Trust" (#483): the room says who may hear whom.
  it('subscribes only what the room says the caller may hear, answering the rest not_heard in place', async () => {
    for (const level of ['edit', 'participate', 'view'] as const) {
      grant = grantAt(level);
      upstream = [];
      room.answers = (asks) => asks.map((a) => (a.sessionId === 'pub2' ? 'heard' : 'apart'));
      const res = await call('POST', 'tracks', {
        ...(await listenerProof()),
        subscribe: [await locator(), await locator(DOC, 'pub2')],
      });
      expect(res.status).toBe(200);
      expect(room.asked.at(-1)).toEqual({
        subscriber: 'sess1',
        asks: [
          { sessionId: 'pub1', trackName: 'mic' },
          { sessionId: 'pub2', trackName: 'mic' },
        ],
      });
      expect(upstream[0]!.body).toEqual({
        tracks: [{ location: 'remote', sessionId: 'pub2', trackName: 'mic' }],
      });
      const body = (await res.json()) as { tracks: unknown[] };
      expect(body.tracks[0]).toEqual({
        sessionId: 'pub1',
        trackName: 'mic',
        errorCode: 'not_heard',
      });
      expect(body.tracks[1]).toMatchObject({ mid: '0' });
    }
  });

  it('asks Realtime nothing when the room refuses every track', async () => {
    room.answers = (asks) => asks.map(() => 'unknown-session');
    const res = await call('POST', 'tracks', {
      ...(await listenerProof()),
      subscribe: [await locator()],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      requiresImmediateRenegotiation: false,
      tracks: [{ sessionId: 'pub1', trackName: 'mic', errorCode: 'not_heard' }],
    });
    expect(upstream).toEqual([]);
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

// The calls kill switch (docs/specs/016-platform/calls-kill-switch.md "The mint route"): every session and track
// is checked against its mode, after the production flag and the secrets.
describe('the kill switch', () => {
  const withMode = (mode: string) => ({ ...SECRETS, CALLS_SWITCH: fakeKv({ 'calls-mode': mode }) });

  it('pauses every session, publish, subscribe and renegotiation while off, and asks Realtime nothing', async () => {
    const env = withMode('off');
    const proof = await speakerProof();
    const refused = [
      await call('POST', 'session', undefined, env),
      await call('POST', 'tracks', { ...proof, publish: { sdp: 'v=0', mid: '0' } }, env),
      await call('POST', 'tracks', { ...proof, subscribe: [await locator()] }, env),
      await call('PUT', 'renegotiate', { ...proof, sdp: 'v=0 answer' }, env),
    ];
    for (const res of refused) {
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'calls_off', reason: 'paused' });
    }
    expect(upstream).toEqual([]);
  });

  it('still closes tracks while paused: closing never costs', async () => {
    const res = await call(
      'PUT',
      'close',
      { ...(await listenerProof()), mids: ['1'] },
      withMode('off'),
    );
    expect(res.status).toBe(200);
    expect(upstream.map((u) => u.body)).toEqual([{ tracks: [{ mid: '1' }], force: true }]);
  });

  it('holds unset secrets before the switch, close included', async () => {
    const proof = await listenerProof();
    const bare = await call('PUT', 'close', { ...proof, mids: ['1'] }, { CALLS_SWITCH: fakeKv() });
    expect(await bare.json()).toEqual({ error: 'calls_off', reason: 'unconfigured' });
    expect(upstream).toEqual([]);
  });

  it('mints audio while audio only, and says so on the session', async () => {
    const env = withMode('audio-only');
    const session = (await (await call('POST', 'session', undefined, env)).json()) as {
      mode: string;
    };
    expect(session.mode).toBe('audio-only');
    const publish = await call(
      'POST',
      'tracks',
      { ...(await speakerProof()), publish: { sdp: 'v=0', mid: '0' } },
      env,
    );
    expect(publish.status).toBe(200);
    const subscribe = await call(
      'POST',
      'tracks',
      { ...(await listenerProof()), subscribe: [await locator()] },
      env,
    );
    expect(subscribe.status).toBe(200);
  });

  it('checks every publish and subscribe by its track kind: video is refused while audio only', async () => {
    trackKinds.asVideo = true;
    const env = withMode('audio-only');
    const refused = [
      await call(
        'POST',
        'tracks',
        { ...(await speakerProof()), publish: { sdp: 'v=0', mid: '0' } },
        env,
      ),
      await call(
        'POST',
        'tracks',
        { ...(await listenerProof()), subscribe: [await locator()] },
        env,
      ),
    ];
    for (const res of refused) {
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'calls_off', reason: 'audio-only' });
    }
    expect(upstream).toEqual([]);
    // With calls on, the same tracks go through.
    resetCallsModeCache();
    const on = await call(
      'POST',
      'tracks',
      { ...(await listenerProof()), subscribe: [await locator()] },
      withMode('on'),
    );
    expect(on.status).toBe(200);
  });

  it('refuses a track whose kind the mode does not allow, or that no call publishes (video and screen add theirs)', async () => {
    expect(mediaRefused('on', ['mic'])).toBeNull();
    expect(mediaRefused('audio-only', ['mic'])).toBeNull();
    const refusal = mediaRefused('audio-only', ['mic', 'cam']);
    expect(refusal?.status).toBe(503);
    expect(await refusal?.json()).toEqual({ error: 'calls_off', reason: 'audio-only' });
    expect(mediaRefused('on', ['nobody-publishes-this'])?.status).toBe(503);
  });
});

// docs/specs/012-collaboration/video-and-screen-bubbles.md "The mint route" and "Share roles".
describe('the camera and a shared screen', () => {
  const withMode = (mode: string) => ({ ...SECRETS, CALLS_SWITCH: fakeKv({ 'calls-mode': mode }) });
  const publish = (trackName?: string) => ({
    sdp: 'v=0',
    mid: '1',
    ...(trackName === undefined ? {} : { trackName }),
  });
  const camera = async (sessionId = 'pub1') => ({
    ...(await locator(DOC, sessionId)),
    trackName: 'cam',
  });
  const publishAs = async (trackName: string, proof = speakerProof) =>
    call('POST', 'tracks', { ...(await proof()), publish: publish(trackName) });

  it('publishes a camera for an Editor or a Participant, named as asked', async () => {
    for (const level of ['participate', 'edit'] as const) {
      grant = grantAt(level);
      upstream = [];
      const res = await publishAs('cam');
      expect(res.status).toBe(200);
      expect(upstream[0]!.body).toMatchObject({
        tracks: [{ location: 'local', mid: '1', trackName: 'cam' }],
      });
    }
    grant = grantAt('view');
    expect(await (await publishAs('cam')).json()).toEqual({ error: 'calls_listen_only' });
  });

  it('publishes a screen for an Editor only', async () => {
    grant = grantAt('participate');
    const participant = await publishAs('screen');
    expect(participant.status).toBe(403);
    expect(await participant.json()).toEqual({ error: 'calls_editor_only' });
    grant = grantAt('view');
    expect(await (await publishAs('screen')).json()).toEqual({ error: 'calls_listen_only' });
    expect(upstream).toEqual([]);
    grant = grantAt('edit');
    expect((await publishAs('screen')).status).toBe(200);
    expect(upstream[0]!.body).toMatchObject({ tracks: [{ trackName: 'screen' }] });
    // A listener's session stays one, even for an Editor.
    expect((await publishAs('screen', listenerProof)).status).toBe(403);
  });

  it('refuses a publish naming a track no call publishes', async () => {
    expect((await publishAs('camera')).status).toBe(400);
    expect(upstream).toEqual([]);
  });

  it('subscribes a camera on its small layer, or the layer asked, and a screen without layers', async () => {
    grant = grantAt('view');
    const screen = { ...(await locator(DOC, 'pub3')), trackName: 'screen' };
    const res = await call('POST', 'tracks', {
      ...(await listenerProof()),
      subscribe: [
        await camera(),
        { ...(await camera('pub2')), layer: 'f' },
        screen,
        await locator(),
      ],
    });
    expect(res.status).toBe(200);
    expect(upstream[0]!.body).toEqual({
      tracks: [
        {
          location: 'remote',
          sessionId: 'pub1',
          trackName: 'cam',
          simulcast: { preferredRid: 'h', priorityOrdering: 'none', ridNotAvailable: 'none' },
        },
        {
          location: 'remote',
          sessionId: 'pub2',
          trackName: 'cam',
          simulcast: {
            preferredRid: 'f',
            priorityOrdering: 'asciibetical',
            ridNotAvailable: 'asciibetical',
          },
        },
        { location: 'remote', sessionId: 'pub3', trackName: 'screen' },
        { location: 'remote', sessionId: 'pub1', trackName: 'mic' },
      ],
    });
  });

  it('refuses a layer on anything but a camera, or a layer that is not one', async () => {
    const proof = await listenerProof();
    for (const subscribe of [
      [{ ...(await locator()), layer: 'h' }],
      [{ ...(await camera()), layer: 'q' }],
    ]) {
      expect((await call('POST', 'tracks', { ...proof, subscribe })).status).toBe(400);
    }
    expect(upstream).toEqual([]);
  });

  it('switches camera subscriptions between layers with tracks/update', async () => {
    grant = grantAt('view');
    const track = { mid: '4', sessionId: 'pub1', trackName: 'cam', layer: 'f' };
    const res = await call('PUT', 'layer', { ...(await listenerProof()), tracks: [track] });
    expect(res.status).toBe(200);
    expect(upstream[0]).toMatchObject({
      method: 'PUT',
      url: 'https://rtc.live.cloudflare.com/v1/apps/app1/sessions/sess1/tracks/update',
      body: {
        tracks: [
          {
            location: 'remote',
            mid: '4',
            sessionId: 'pub1',
            trackName: 'cam',
            simulcast: { preferredRid: 'f' },
          },
        ],
      },
    });
  });

  it('refuses a malformed layer change, and a forged session', async () => {
    const proof = await listenerProof();
    const ok = { mid: '4', sessionId: 'pub1', trackName: 'cam', layer: 'h' };
    for (const body of [
      { ...proof, tracks: [] },
      { ...proof, tracks: 'all' },
      { ...proof, tracks: [{ ...ok, trackName: 'mic' }] },
      { ...proof, tracks: [{ ...ok, layer: 'q' }] },
      { ...proof, tracks: [{ ...ok, mid: 4 }] },
      { ...proof, tracks: [{ ...ok, sessionId: '' }] },
      { ...proof, tracks: [null] },
      { ...proof, tracks: Array.from({ length: MAX_SUBSCRIBE_BATCH + 1 }, () => ok) },
      { sessionId: 'sess1', tracks: [ok] },
    ]) {
      expect((await call('PUT', 'layer', body)).status).toBe(400);
    }
    expect(upstream).toEqual([]);
  });

  it('refuses a camera, a screen and a layer change while audio only, and pauses all while off', async () => {
    grant = grantAt('edit');
    const env = withMode('audio-only');
    const proof = await speakerProof();
    const layer = { mid: '4', sessionId: 'pub1', trackName: 'cam', layer: 'f' };
    const refused = [
      await call('POST', 'tracks', { ...proof, publish: publish('cam') }, env),
      await call('POST', 'tracks', { ...proof, publish: publish('screen') }, env),
      await call('POST', 'tracks', { ...proof, subscribe: [await camera()] }, env),
      await call('PUT', 'layer', { ...proof, tracks: [layer] }, env),
    ];
    for (const res of refused) {
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'calls_off', reason: 'audio-only' });
    }
    resetCallsModeCache();
    const off = await call('PUT', 'layer', { ...proof, tracks: [layer] }, withMode('off'));
    expect(await off.json()).toEqual({ error: 'calls_off', reason: 'paused' });
    expect(upstream).toEqual([]);
  });
});
