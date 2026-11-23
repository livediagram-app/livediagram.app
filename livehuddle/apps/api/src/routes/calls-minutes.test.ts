// Call Minutes at the calls routes (docs/specs/012-collaboration/call-minutes.md "Who pays", "The wire"): with Pro off
// the routes ask nothing and answer as before; with it on, a session is admitted by the Space's room against its
// OWNER's month (never the caller's, and never anything the request claims), and the minutes read says what each
// person may know.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@livehuddle/api-schema';
import type { TeamClaim } from '@liveworkspace/auth-client';
import type { Env } from '../types';
import type { ItemGrant } from '../index-service';
import type { CallAdmission, CallMinutesReading } from '../calls/call-meter';
import { resetCallsModeCache } from '../calls/calls-mode';
import { sealSessionToken, sealTrackToken } from '../calls/call-tokens';
import { makeTestRouteContext } from './test-route-context';

let grant: ItemGrant | null | Response = null;
vi.mock('./document-grant', () => ({
  resolveDocumentGrant: vi.fn(async () => grant),
}));
const room = vi.hoisted(() => ({
  admits: [] as string[],
  admission: { ok: true, low: false } as CallAdmission,
  reads: [] as string[],
  reading: null as CallMinutesReading | null,
  // The owner's month is used (the room's `callsPaused`, and what its hearing answers then).
  paused: false,
  pauseFails: false,
  pauseAsks: 0,
  hearings: 0,
  post: null as null | { code: string; open: boolean },
}));
vi.mock('../document-client', () => ({
  documentRoom: () => ({
    community: async () => room.post,
    callsAdmit: async (owner: string) => {
      room.admits.push(owner);
      return room.admission;
    },
    callMinutes: async (owner: string) => {
      room.reads.push(owner);
      return room.reading;
    },
    callsPaused: async () => {
      room.pauseAsks += 1;
      if (room.pauseFails) throw new Error('room unavailable');
      return room.paused;
    },
    callsHearing: async (_subscriber: string, asks: unknown[]) => {
      room.hearings += 1;
      return asks.map(() => (room.paused ? 'minutes-used' : 'heard'));
    },
  }),
}));
const { callsPayer, handleCallRoutes } = await import('./calls');

const SECRETS = {
  REALTIME_APP_ID: 'app1',
  REALTIME_APP_TOKEN: 'secret',
  TURN_KEY_ID: 'turn1',
  TURN_KEY_API_TOKEN: 'turn-secret',
};
const PRO = { ...SECRETS, PRO_ENABLED: 'true', SUBSCRIPTION_KEY: 'app-key' };
const DOC = 'doc1';
const OWNER = 'user_owner';
const GUEST = 'guest_00000000-0000-4000-8000-000000000002';

function grantFor(sub: string, over: Partial<ItemGrant> = {}, level: AccessLevel = 'participate') {
  return {
    item: DOC,
    level,
    tab: null,
    sub,
    team: null,
    owner: OWNER,
    exp: 9_999_999_999,
    shareCode: null,
    token: 'signed',
    ...over,
  } satisfies ItemGrant;
}

let minted = 0;
// Every request made of Cloudflare Realtime.
let upstream: string[] = [];
beforeEach(() => {
  resetCallsModeCache();
  room.admits = [];
  room.reads = [];
  room.admission = { ok: true, low: false };
  room.reading = null;
  room.post = null;
  room.paused = false;
  room.pauseFails = false;
  room.pauseAsks = 0;
  room.hearings = 0;
  minted = 0;
  upstream = [];
  grant = grantFor(GUEST);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      upstream.push(url);
      if (url.endsWith('/sessions/new')) {
        minted++;
        return Response.json({ sessionId: 'sess1' });
      }
      return Response.json({ iceServers: [] });
    }),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function call(
  method: string,
  action: string,
  options: { env?: Partial<Env>; body?: unknown; teams?: TeamClaim[] } = {},
) {
  return handleCallRoutes(
    makeTestRouteContext(method, `/api/documents/${DOC}/calls/${action}`, {
      env: (options.env ?? PRO) as Env,
      ...(options.body === undefined ? {} : { body: options.body }),
      ...(options.teams ? { teams: options.teams } : {}),
    }),
  ) as Promise<Response>;
}

describe('with Pro off', () => {
  it('mints a session without asking the room, and its answer names no minutes', async () => {
    for (const env of [SECRETS, { ...SECRETS, PRO_ENABLED: 'false' }]) {
      const res = await call('POST', 'session', { env });
      expect(res.status).toBe(200);
      expect(await res.json()).not.toHaveProperty('minutes');
    }
    expect(room.admits).toEqual([]);
    expect(minted).toBe(2);
  });

  it('answers the minutes read as not metered, asking nobody', async () => {
    const res = await call('GET', 'minutes', { env: SECRETS });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ metered: false });
    expect(room.reads).toEqual([]);
  });
});

describe('who pays for a session', () => {
  it("is the Space's owner, whoever joins: a guest, a collaborator, the owner", async () => {
    for (const sub of [GUEST, 'user_collaborator', OWNER]) {
      grant = grantFor(sub);
      const res = await call('POST', 'session');
      expect(res.status).toBe(200);
      // The owner is named to a signed-in caller alone (they ask which action they may take), never to a guest.
      expect((await res.json<{ minutes: unknown }>()).minutes).toEqual(
        sub === GUEST ? { low: false } : { owner: 'p:user_owner', low: false },
      );
    }
    expect(room.admits).toEqual(['p:user_owner', 'p:user_owner', 'p:user_owner']);
  });

  it("is the Space itself for a guest's Space: no scope is ever made from a guest's id", async () => {
    grant = grantFor('user_visitor', { owner: GUEST });
    expect(callsPayer(grant)).toBe('guest');
    const res = await call('POST', 'session');
    expect((await res.json<{ minutes: unknown }>()).minutes).toEqual({ guest: true, low: false });
    room.reading = { used: 1000, limit: 1000, low: false, paused: true };
    expect(await (await call('GET', 'minutes')).json()).toEqual({
      metered: true,
      guest: true,
      used: null,
      limit: null,
      low: false,
      paused: true,
    });
    room.admission = { ok: false, used: 1000, limit: 1000 };
    expect(await (await call('POST', 'session')).json()).toEqual({
      error: 'calls_minutes_used',
      guest: true,
    });
    expect([...room.admits, ...room.reads]).toEqual(['guest', 'guest', 'guest']);
  });

  it("is the team for a team's Space, also when the person joining has Pro of their own", async () => {
    grant = grantFor('user_pro_person', { team: 'team_garden' });
    await call('POST', 'session');
    grant = grantFor('user_pro_person', { team: 'team_garden', owner: null });
    await call('POST', 'session');
    expect(room.admits).toEqual(['t:team_garden', 't:team_garden']);
  });

  it('is never what the request claims', async () => {
    const res = await call('POST', 'session', {
      body: { tier: 'pro', owner: 'p:user_rich', limit: 5_000, minutes: { owner: 'p:user_rich' } },
    });
    expect(res.status).toBe(200);
    expect(room.admits).toEqual(['p:user_owner']);
    expect((await res.json<{ minutes: unknown }>()).minutes).toEqual({ low: false });
  });

  it('is nobody for a grant that names no owner: the session is not metered', async () => {
    grant = grantFor(GUEST, { owner: null });
    expect(callsPayer(grant)).toBeNull();
    const res = await call('POST', 'session');
    expect(await res.json()).not.toHaveProperty('minutes');
    expect(room.admits).toEqual([]);
  });

  it('says the month is running low', async () => {
    room.admission = { ok: true, low: true };
    grant = grantFor('user_collaborator');
    const res = await call('POST', 'session');
    expect((await res.json<{ minutes: unknown }>()).minutes).toEqual({
      owner: 'p:user_owner',
      low: true,
    });
  });
});

describe('a join when the minutes are used', () => {
  it('is refused before anything is minted: the numbers to the owner, the owner to the signed in, the state to all', async () => {
    room.admission = { ok: false, used: 1000, limit: 1000 };
    // A signed-out visitor: the state alone, no account id and no usage of the owner's.
    const res = await call('POST', 'session');
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'calls_minutes_used' });
    // A signed-in collaborator: whose month it is, to ask which action they may take, and no numbers.
    grant = grantFor('user_collaborator');
    expect(await (await call('POST', 'session')).json()).toEqual({
      error: 'calls_minutes_used',
      owner: 'p:user_owner',
    });
    // The owner: their own numbers.
    grant = grantFor(OWNER);
    expect(await (await call('POST', 'session')).json()).toEqual({
      error: 'calls_minutes_used',
      used: 1000,
      limit: 1000,
      owner: 'p:user_owner',
    });
    expect(minted).toBe(0);
  });

  it('is refused as calls being unavailable when the minutes could not be checked, never as minutes used', async () => {
    // The subscription service refused the room's request (a rotated key): nothing is minted unmetered, and nobody
    // is told the owner's month is used or offered an upgrade.
    room.admission = { ok: false, used: 0, limit: 1000, unchecked: true };
    const res = await call('POST', 'session');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'calls_off', reason: 'unconfigured' });
    expect(minted).toBe(0);
  });
});

// A browser that ignores the room's word keeps its session token (tokens never lapse): the routes are what stops it.
describe('media while the month is used', () => {
  const proof = async () => ({
    sessionId: 'sess1',
    sessionToken: await sealSessionToken('secret', DOC, 'sess1', 's'),
  });
  const locator = async () => ({
    sessionId: 'pub1',
    trackName: 'mic',
    token: await sealTrackToken('secret', DOC, 'pub1'),
  });
  const media = async (): Promise<[string, string, unknown][]> => [
    ['POST', 'tracks', { ...(await proof()), publish: { sdp: 'v=0 offer', mid: '0' } }],
    ['POST', 'tracks', { ...(await proof()), subscribe: [await locator()] }],
    ['PUT', 'renegotiate', { ...(await proof()), sdp: 'v=0 answer' }],
    [
      'PUT',
      'layer',
      {
        ...(await proof()),
        tracks: [{ mid: '1', sessionId: 'pub1', trackName: 'cam', layer: 'h' }],
      },
    ],
  ];

  it('refuses a publish, a subscribe, a renegotiation and a layer switch, asking Realtime for nothing', async () => {
    room.paused = true;
    for (const [method, action, body] of await media()) {
      const res = await call(method, action, { body });
      expect([action, res.status]).toEqual([action, 429]);
      expect(await res.json()).toEqual({ error: 'calls_minutes_used' });
    }
    expect(upstream).toEqual([]);
    // A subscribe learns it from the hearing answer it already asks for: one room call a request, never two.
    expect([room.pauseAsks, room.hearings]).toEqual([3, 1]);
  });

  it('lets media through while minutes are left, and still closes tracks while they are used', async () => {
    for (const [method, action, body] of await media()) {
      const res = await call(method, action, { body });
      expect([action, res.status]).not.toEqual([action, 429]);
    }
    room.paused = true;
    const close = await call('PUT', 'close', { body: { ...(await proof()), mids: ['0'] } });
    expect(close.status).not.toBe(429);
  });

  it('asks the room nothing of minutes with Pro off, and where nothing is metered', async () => {
    room.paused = true;
    for (const [method, action, body] of await media()) {
      const res = await call(method, action, { env: SECRETS, body });
      expect([action, res.status]).not.toEqual([action, 429]);
    }
    grant = grantFor(GUEST, { owner: null });
    const [method, action, body] = (await media())[0]!;
    expect((await call(method, action, { body })).status).not.toBe(429);
    expect(room.pauseAsks).toBe(0);
  });

  it('pauses nothing when the room cannot answer: the check never ends a call by failing', async () => {
    room.paused = true;
    room.pauseFails = true;
    const [method, action, body] = (await media())[0]!;
    expect((await call(method, action, { body })).status).not.toBe(429);
    expect(room.pauseAsks).toBe(1);
  });
});

describe('the minutes read', () => {
  const READING: CallMinutesReading = { used: 240, limit: 1000, low: false, paused: false };

  it('gives the owner and the owning team their numbers', async () => {
    room.reading = READING;
    grant = grantFor(OWNER);
    expect(await (await call('GET', 'minutes')).json()).toEqual({
      metered: true,
      owner: 'p:user_owner',
      used: 240,
      limit: 1000,
      low: false,
      paused: false,
    });
    grant = grantFor('user_member', { team: 'team_garden' });
    const teams = [{ id: 'team_garden' } as TeamClaim];
    expect(await (await call('GET', 'minutes', { teams })).json()).toMatchObject({
      owner: 't:team_garden',
      used: 240,
      limit: 1000,
    });
    expect(room.reads).toEqual(['p:user_owner', 't:team_garden']);
  });

  it('gives anyone else no numbers, also once the limit is met, and a signed-out visitor no owner', async () => {
    room.reading = { ...READING, low: true };
    grant = grantFor('user_collaborator', { team: 'team_garden' });
    const outsider = [{ id: 'team_other' } as TeamClaim];
    expect(await (await call('GET', 'minutes', { teams: outsider })).json()).toEqual({
      metered: true,
      owner: 't:team_garden',
      used: null,
      limit: null,
      low: true,
      paused: false,
    });
    // A guest on a team's Space carries no teams at all.
    grant = grantFor(GUEST, { team: 'team_garden' });
    expect(await (await call('GET', 'minutes')).json()).toMatchObject({ used: null, limit: null });
    grant = grantFor(GUEST);
    room.reading = { used: 1000, limit: 1000, low: false, paused: true };
    expect(await (await call('GET', 'minutes')).json()).toEqual({
      metered: true,
      used: null,
      limit: null,
      low: false,
      paused: true,
    });
  });

  it('is not metered where nothing can be counted', async () => {
    grant = grantFor(GUEST, { owner: null });
    expect(await (await call('GET', 'minutes')).json()).toEqual({ metered: false });
    grant = grantFor(GUEST);
    room.reading = null;
    expect(await (await call('GET', 'minutes')).json()).toEqual({ metered: false });
  });

  it('keeps the routes own gates: a grant first, a Community link never, no other method', async () => {
    expect((await call('POST', 'minutes')).status).toBe(404);
    grant = null;
    expect((await call('GET', 'minutes')).status).toBe(404);
    grant = grantFor(GUEST, { shareCode: 'POST1' });
    room.post = { code: 'POST1', open: true };
    expect((await call('GET', 'minutes')).status).toBe(403);
    expect(room.reads).toEqual([]);
  });

  it('answers while calls are off: the month is the owner’s either way', async () => {
    room.reading = READING;
    grant = grantFor(OWNER);
    const res = await call('GET', 'minutes', {
      env: { PRO_ENABLED: 'true', SUBSCRIPTION_KEY: 'app-key' },
    });
    expect(await res.json()).toMatchObject({ metered: true, used: 240 });
  });
});
