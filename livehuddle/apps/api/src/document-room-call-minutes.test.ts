// Call Minutes through the real room (docs/specs/012-collaboration/call-minutes.md): the Space's room is the meter.
// With Pro off it counts nothing and asks nothing; with it on, each person in a call costs the Space's OWNER one
// minute a minute, a call in progress ends when the month is used, a client that goes silent loses its session, and
// the subscription service being down never drops a call.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerScope } from '@liveworkspace/subscription';
import { CALL_METER_KEY, CALL_MINUTE_MS, CALL_ORPHAN_GRACE_MS } from './calls/call-meter';
import { sealSessionToken } from './calls/call-tokens';
import { DocumentRoom } from './document-room/document-room';
import { forgetEntitlementsForTests } from './subscription';
import { fakeSubscription, type FakeSubscription } from './test-subscription-service';

type Socket = { sent: string[]; attachment: Record<string, unknown> };
type Frame = { kind: string; from?: string; op?: Record<string, unknown> };

const SECRET = 'secret';
const DOC = 'doc1';
const OWNER: OwnerScope = 'p:user_owner';
const TEAM: OwnerScope = 't:team_garden';
const START = Date.UTC(2026, 10, 20, 12);
const REALTIME = {
  REALTIME_APP_ID: 'app',
  REALTIME_APP_TOKEN: SECRET,
  TURN_KEY_ID: 'turn',
  TURN_KEY_API_TOKEN: 'turn-secret',
};

const wsCache = new WeakMap<Socket, WebSocket>();
function wsOf(s: Socket): WebSocket {
  let ws = wsCache.get(s);
  if (!ws) {
    ws = {
      send: (d: string) => void s.sent.push(d),
      serializeAttachment: (v: Record<string, unknown>) => void (s.attachment = v),
      deserializeAttachment: () => s.attachment,
    } as unknown as WebSocket;
    wsCache.set(s, ws);
  }
  return ws;
}

// Each test's service has an address of its own, so one test's outage is never another's.
let services = 0;

function newSpace(pro: boolean, calls: Record<string, string> = REALTIME) {
  const service = fakeSubscription();
  const sockets: Socket[] = [];
  const stored = new Map<string, unknown>();
  const alarms: (number | null)[] = [];
  const work: Promise<unknown>[] = [];
  const state = {
    acceptWebSocket: () => {},
    getWebSockets: () => sockets.map(wsOf),
    storage: {
      get: (key: string) => Promise.resolve(stored.get(key)),
      put: (key: string, value: unknown) => {
        stored.set(key, structuredClone(value));
        return Promise.resolve();
      },
      delete: () => Promise.resolve(false),
      list: () => Promise.resolve(new Map()),
      setAlarm: (at: number) => {
        alarms.push(at);
        return Promise.resolve();
      },
      deleteAlarm: () => {
        alarms.push(null);
        return Promise.resolve();
      },
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: (p: Promise<unknown>) => void work.push(p),
  };
  const env = {
    ...calls,
    ...(pro
      ? {
          PRO_ENABLED: 'true',
          SUBSCRIPTION_KEY: 'app-key',
          SUBSCRIPTION_URL: `https://subscription.test/${++services}`,
          SUBSCRIPTION: service.fetcher,
        }
      : {}),
  };
  const open = () => new DocumentRoom(state as unknown as DurableObjectState, env as never);
  let room = open();
  const join = (id: string, key: string, over: Record<string, unknown> = {}) => {
    const s: Socket = {
      sent: [],
      attachment: {
        presenceId: id,
        verifiedRole: 'participate',
        presence: null,
        documentId: DOC,
        collabKey: key,
        // Signed in to an account, unless a test says otherwise: the key is the api's word on who this is.
        account: true,
        ...over,
      },
    };
    sockets.push(s);
    room.webSocketMessage(
      wsOf(s),
      JSON.stringify({ kind: 'hello', participant: { name: id, color: '#abc', tabId: 't', key } }),
    );
    s.sent.length = 0;
    return s;
  };
  const settled = async () => {
    // The proof's token check (two calls into the platform's crypto), then the room's background work.
    await new Promise((resolve) => setTimeout(resolve, 20));
    while (work.length > 0) await work.shift();
  };
  const say = (s: Socket, op: unknown) =>
    room.webSocketMessage(wsOf(s), JSON.stringify({ kind: 'op', op }));
  /** What a browser does to join a call: the mint route's question, then the proof on its connection. */
  const enter = async (s: Socket, sessionId: string, owner: OwnerScope = OWNER) => {
    const admitted = pro ? await room.callsAdmit(DOC, owner) : { ok: true as const, low: false };
    if (!admitted.ok) return admitted;
    await prove(s, sessionId);
    return admitted;
  };
  const prove = async (s: Socket, sessionId: string, left = false) => {
    say(s, {
      kind: 'call-session',
      tabId: 't',
      sessionId,
      sessionToken: await sealSessionToken(SECRET, DOC, sessionId, 's'),
      ...(left ? { left: true } : {}),
    });
    await settled();
  };
  const drop = (s: Socket) => {
    sockets.splice(sockets.indexOf(s), 1);
    room.webSocketClose(wsOf(s));
  };
  /** Time passes and the room's alarm runs. */
  const after = async (ms: number) => {
    vi.setSystemTime(Date.now() + ms);
    await room.alarm();
    await settled();
  };
  return {
    service,
    stored,
    alarms,
    join,
    say,
    enter,
    prove,
    drop,
    after,
    settled,
    get room() {
      return room;
    },
    // The room wakes from hibernation: a new object over the same storage and sockets.
    wake: async () => {
      room = open();
      await settled();
    },
  };
}

const minutesOps = (s: Socket): Record<string, unknown>[] =>
  s.sent
    .map((raw) => JSON.parse(raw) as Frame)
    .filter((f) => f.op?.kind === 'call-minutes')
    .map((f) => ({ from: f.from, ...f.op }));

// Cloudflare Realtime, for the sessions the room closes: every session holds one track.
let realtime: { url: string; method: string }[] = [];
const severed = () =>
  realtime
    .filter((r) => r.method === 'PUT')
    .map((r) => r.url.split('/sessions/')[1]!.split('/')[0]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: START });
  forgetEntitlementsForTests();
  realtime = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      realtime.push({ url, method: String(init.method) });
      return Response.json(init.method === 'GET' ? { tracks: [{ mid: '0' }] } : { tracks: [] });
    }),
  );
  for (const level of ['info', 'warn'] as const)
    vi.spyOn(console, level).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const spendsOf = (service: FakeSubscription) => service.spends();

describe('with Pro off', () => {
  it('counts nothing, stores nothing, sets no alarm for calls and asks the service nothing', async () => {
    const space = newSpace(false);
    const ada = space.join('ada', 'k-ada');
    const ben = space.join('ben', 'k-ben');
    await space.enter(ada, 'S-ada');
    await space.enter(ben, 'S-ben');
    await space.after(CALL_MINUTE_MS);
    await space.after(CALL_MINUTE_MS);
    expect(space.service.asked).toEqual([]);
    expect(space.stored.has(CALL_METER_KEY)).toBe(false);
    expect(space.alarms.filter((at) => at !== null)).toEqual([]);
    expect([...minutesOps(ada), ...minutesOps(ben)]).toEqual([]);
    // Nobody sends a leave with Pro off, and one sent changes nothing.
    await space.prove(ada, 'S-ada', true);
    expect(ada.attachment.callSession).toBe('S-ada');
    space.drop(ben);
    await space.after(CALL_ORPHAN_GRACE_MS);
    expect(realtime).toEqual([]);
    expect(await space.room.callMinutes(DOC, OWNER)).toBeNull();
  });
});

describe('with Pro on, the room is the meter', () => {
  it("charges the Space's owner a minute a person a minute: its owner's, a collaborator's and a guest's", async () => {
    const space = newSpace(true);
    const owner = space.join('owner', 'k-owner', { isOwner: true });
    const collaborator = space.join('collaborator', 'k-collab');
    const guest = space.join('guest', 'k-guest', { verifiedRole: 'view' });
    await space.enter(owner, 'S-owner');
    expect(spendsOf(space.service)).toEqual([]);
    await space.enter(collaborator, 'S-collab');
    await space.enter(guest, 'S-guest');
    await space.after(CALL_MINUTE_MS);
    await space.after(CALL_MINUTE_MS);
    // Every spend names the owner, never the person in the call.
    expect(new Set(spendsOf(space.service).map((s) => s.owner))).toEqual(new Set([OWNER]));
    expect(space.service.used.get(OWNER)).toBe(3 + 3 + 3);
    expect(spendsOf(space.service).slice(-2)).toEqual([
      { owner: OWNER, amount: 3 },
      { owner: OWNER, amount: 3 },
    ]);
  });

  it("charges a team's Space to the team", async () => {
    const space = newSpace(true);
    const ada = space.join('ada', 'k-ada');
    const ben = space.join('ben', 'k-ben');
    await space.enter(ada, 'S-ada', TEAM);
    await space.enter(ben, 'S-ben', TEAM);
    await space.after(CALL_MINUTE_MS);
    expect(space.service.used.get(TEAM)).toBe(4);
    expect(space.service.used.has(OWNER)).toBe(false);
  });

  it('runs its alarm each minute of a call and never for calls once nobody is in one', async () => {
    const space = newSpace(true);
    const ada = space.join('ada', 'k-ada');
    const ben = space.join('ben', 'k-ben');
    await space.enter(ada, 'S-ada');
    expect(space.alarms.filter((at) => at !== null)).toEqual([]);
    await space.enter(ben, 'S-ben');
    expect(space.alarms.at(-1)).toBe(START + CALL_MINUTE_MS);
    await space.after(CALL_MINUTE_MS);
    expect(space.alarms.at(-1)).toBe(START + 2 * CALL_MINUTE_MS);
    // Ben leaves the call and says so: one person is no call.
    await space.prove(ben, 'S-ben', true);
    expect(ben.attachment.callSession).toBeNull();
    await space.after(CALL_MINUTE_MS);
    await space.after(CALL_MINUTE_MS);
    expect(space.alarms.at(-1)).toBeNull();
    expect(space.service.used.get(OWNER)).toBe(4);
    // The session that left was closed at Realtime.
    expect(severed()).toEqual(['S-ben']);
  });

  it('keeps counting across a hibernation', async () => {
    const space = newSpace(true);
    await space.enter(space.join('ada', 'k-ada'), 'S-ada');
    await space.enter(space.join('ben', 'k-ben'), 'S-ben');
    await space.wake();
    expect(space.alarms.at(-1)).toBe(START + CALL_MINUTE_MS);
    await space.after(CALL_MINUTE_MS);
    expect(space.service.used.get(OWNER)).toBe(4);
  });

  it('ends a running call when the month is used, tells everyone why, and refuses the next join', async () => {
    const space = newSpace(true);
    space.service.limits.set(OWNER, 4);
    const ada = space.join('ada', 'k-ada');
    const ben = space.join('ben', 'k-ben');
    // A visitor on a link to one tab is told too.
    const scoped = space.join('cy', 'k-cy', { tabScope: 't' });
    await space.enter(ada, 'S-ada');
    await space.enter(ben, 'S-ben');
    await space.after(CALL_MINUTE_MS);
    expect(minutesOps(ada).some((op) => op.state === 'used')).toBe(false);
    await space.after(CALL_MINUTE_MS);
    // The state alone, to everyone: no owner and no number of theirs rides a broadcast.
    const used = { from: 'system', kind: 'call-minutes', state: 'used' };
    for (const s of [ada, ben, scoped]) expect(minutesOps(s).at(-1)).toEqual(used);
    expect(severed().sort()).toEqual(['S-ada', 'S-ben']);
    expect(await space.room.callsAdmit(DOC, OWNER)).toEqual({ ok: false, used: 4, limit: 4 });
    expect(await space.room.callMinutes(DOC, OWNER)).toEqual({
      used: 4,
      limit: 4,
      low: false,
      paused: true,
    });
    // The Space itself carries on: an op still relays.
    space.say(ada, { kind: 'cursor', tabId: 't', x: 1, y: 2 });
    expect(ben.sent.some((raw) => raw.includes('"cursor"'))).toBe(true);
  });

  it('keeps media off for a browser that ignores the word: no session is held, proven again or heard', async () => {
    const space = newSpace(true);
    space.service.limits.set(OWNER, 2);
    const ada = space.join('ada', 'k-ada');
    const ben = space.join('ben', 'k-ben');
    await space.enter(ada, 'S-ada');
    await space.enter(ben, 'S-ben');
    const ask = [{ sessionId: 'S-ada', trackName: 'mic' }];
    expect(await space.room.callsHearing(DOC, 'S-ben', ask)).toEqual(['heard']);
    expect(await space.room.callsPaused(DOC)).toBe(false);
    await space.after(CALL_MINUTE_MS);
    expect(minutesOps(ben).at(-1)).toMatchObject({ state: 'used' });
    // Both browsers ignore the op, keep their session tokens (which never lapse) and carry on.
    expect(ada.attachment.callSession ?? null).toBeNull();
    expect(ben.attachment.callSession ?? null).toBeNull();
    expect(await space.room.callsPaused(DOC)).toBe(true);
    expect(await space.room.callsHearing(DOC, 'S-ben', ask)).toEqual(['minutes-used']);
    // They prove their sessions again, as a modified client would: the room holds nothing for them.
    await space.prove(ada, 'S-ada');
    await space.prove(ben, 'S-ben');
    expect(ada.attachment.callSession ?? null).toBeNull();
    expect(ben.attachment.callSession ?? null).toBeNull();
    expect(await space.room.callsHearing(DOC, 'S-ben', ask)).toEqual(['minutes-used']);
    // And nothing is counted or lifted by waiting.
    await space.after(CALL_MINUTE_MS);
    await space.after(CALL_MINUTE_MS);
    expect(space.service.used.get(OWNER)).toBe(2);
    expect(await space.room.callsPaused(DOC)).toBe(true);
    // Once the owner may use more, a join is admitted and the proof is taken again.
    space.service.limits.set(OWNER, 1000);
    await space.after(2 * CALL_MINUTE_MS);
    expect(await space.enter(ada, 'S-ada2')).toMatchObject({ ok: true });
    expect(ada.attachment.callSession).toBe('S-ada2');
    expect(await space.room.callsPaused(DOC)).toBe(false);
  });

  it('counts link visitors by connection: two sharing one browser secret are two people, and charged', async () => {
    const space = newSpace(true);
    // Both said the same visitor secret in their hello, so their collab keys are the same.
    const one = space.join('v1', 'k-shared', { account: false, keyVisitor: true });
    const two = space.join('v2', 'k-shared', { account: false, keyVisitor: true });
    await space.enter(one, 'S-1');
    await space.enter(two, 'S-2');
    expect(space.service.used.get(OWNER)).toBe(2);
  });

  it('counts someone signed in once across their tabs, and a guest once by the key the api gave them', async () => {
    const space = newSpace(true);
    const tabA = space.join('ada-1', 'k-ada');
    const tabB = space.join('ada-2', 'k-ada');
    await space.enter(tabA, 'S-a1');
    await space.enter(tabB, 'S-a2');
    // One person in two tabs: the second tab's join looked like a call starting, so their one minute is paid, once.
    expect(space.service.used.get(OWNER)).toBe(1);
    const guestA = space.join('gus-1', 'k-gus', { account: false });
    const guestB = space.join('gus-2', 'k-gus', { account: false });
    await space.enter(guestA, 'S-g1');
    await space.enter(guestB, 'S-g2');
    // The guest's two tabs are one more person.
    expect(space.service.used.get(OWNER)).toBe(2);
  });

  it('does not charge a client that never proves its session, and it hears nobody', async () => {
    const space = newSpace(true);
    const ada = space.join('ada', 'k-ada');
    space.join('silent', 'k-silent');
    await space.enter(ada, 'S-ada');
    // The silent client asked for a session and said nothing to the room.
    expect(await space.room.callsAdmit(DOC, OWNER)).toEqual({ ok: true, low: false });
    await space.after(CALL_MINUTE_MS);
    await space.after(CALL_MINUTE_MS);
    // The join looked like a call starting, so the person there paid one minute; nothing after it.
    expect(space.service.used.get(OWNER)).toBe(1);
    expect(
      await space.room.callsHearing(DOC, 'S-silent', [{ sessionId: 'S-ada', trackName: 'mic' }]),
    ).toEqual(['unknown-session']);
  });

  it('closes the session of a client whose connection drops, and stops charging for it', async () => {
    const space = newSpace(true);
    const ada = space.join('ada', 'k-ada');
    const ben = space.join('ben', 'k-ben');
    await space.enter(ada, 'S-ada');
    await space.enter(ben, 'S-ben');
    space.drop(ben);
    expect(space.alarms.at(-1)).toBe(START + CALL_ORPHAN_GRACE_MS);
    await space.after(CALL_ORPHAN_GRACE_MS);
    expect(severed()).toEqual(['S-ben']);
    await space.after(CALL_MINUTE_MS);
    expect(space.service.used.get(OWNER)).toBe(2);
  });

  it('keeps a session whose connection came back and proved it again', async () => {
    const space = newSpace(true);
    const ada = space.join('ada', 'k-ada');
    const ben = space.join('ben', 'k-ben');
    await space.enter(ada, 'S-ada');
    await space.enter(ben, 'S-ben');
    space.drop(ben);
    await space.prove(space.join('ben-2', 'k-ben'), 'S-ben');
    await space.after(CALL_ORPHAN_GRACE_MS);
    await space.after(CALL_MINUTE_MS);
    expect(severed()).toEqual([]);
    // Still two people, and the reconnection cost nothing more inside the minute.
    expect(spendsOf(space.service)).toEqual([
      { owner: OWNER, amount: 1 },
      { owner: OWNER, amount: 1 },
      { owner: OWNER, amount: 2 },
    ]);
  });

  it('never drops a call because the subscription service is down', async () => {
    const space = newSpace(true);
    const ada = space.join('ada', 'k-ada');
    const ben = space.join('ben', 'k-ben');
    await space.enter(ada, 'S-ada');
    await space.enter(ben, 'S-ben');
    space.service.down = true;
    await space.after(CALL_MINUTE_MS);
    await space.after(CALL_MINUTE_MS);
    expect([...minutesOps(ada), ...minutesOps(ben)]).toEqual([]);
    expect(realtime).toEqual([]);
    expect(await space.room.callsAdmit(DOC, OWNER)).toEqual({ ok: true, low: false });
    expect(space.alarms.at(-1)).not.toBeNull();
  });

  it('takes a leave for the session it names, and clears only a connection that holds it', async () => {
    const space = newSpace(true);
    const ada = space.join('ada', 'k-ada');
    await space.enter(ada, 'S-ada');
    await space.prove(ada, 'S-ada', true);
    // A leave for a session the connection does not hold changes nothing on it.
    const ben = space.join('ben', 'k-ben');
    await space.enter(ben, 'S-ben');
    await space.prove(ben, 'S-other', true);
    expect(ben.attachment.callSession).toBe('S-ben');
    await space.after(1000);
    expect(severed().sort()).toEqual(['S-ada', 'S-other']);
  });

  it('closes nothing at Realtime on a deployment without its keys', async () => {
    const space = newSpace(true, { REALTIME_APP_TOKEN: SECRET });
    const ada = space.join('ada', 'k-ada');
    await space.enter(ada, 'S-ada');
    await space.prove(ada, 'S-ada', true);
    await space.after(1000);
    expect(realtime).toEqual([]);
  });
});
