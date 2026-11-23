// The Space's Call Minutes meter (docs/specs/012-collaboration/call-minutes.md "The meter", "Edge cases"), against a
// stand-in subscription service: who is charged, when, and what happens when the owner's month is used.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallMinutesOp } from '@livehuddle/api-schema';
import {
  SPEND_AMOUNT_MAX,
  type OwnerScope,
  type SpendResult,
  type SubscriptionClient,
} from '@liveworkspace/subscription';
import { fakeSubscription, type FakeSubscription } from '../test-subscription-service';
import {
  CALL_MINUTE_MS,
  CALL_ORPHAN_GRACE_MS,
  CALL_ORPHANS_MAX,
  CALL_UNVERIFIED_PEOPLE_MAX,
  CallMeter,
  GUEST_SPACE,
  unverifiedPerson,
  type CallMeterState,
} from './call-meter';

const OWNER: OwnerScope = 'p:user_owner';
const TEAM: OwnerScope = 't:team_garden';
// 20 November 2026, noon UTC.
const START = Date.UTC(2026, 10, 20, 12);

function setup(options: { service?: FakeSubscription | null; stored?: CallMeterState } = {}) {
  const service = options.service === undefined ? fakeSubscription() : options.service;
  const clock = { now: START };
  // Session id to the person holding it, as the room's connections say.
  const sessions = new Map<string, string>();
  const told: CallMinutesOp[] = [];
  const severed: string[] = [];
  // Each time every connection let go of its call session: the sessions they held.
  const ended: string[][] = [];
  const saved: CallMeterState[] = [];
  const work: Promise<unknown>[] = [];
  const load = vi.fn(async () => options.stored);
  const arm = vi.fn();
  const meter = new CallMeter({
    client: () => (service ? service.client(() => clock.now) : null),
    now: () => clock.now,
    load,
    save: (state) => void saved.push(structuredClone(state)),
    sessions: () => new Map(sessions),
    end: () => {
      ended.push([...sessions.keys()]);
      sessions.clear();
    },
    tell: (op) => void told.push(op),
    sever: async (id) => void severed.push(id),
    arm,
    defer: (p) => void work.push(p),
  });
  /** A person's connection proves a session, and the room's background work settles. */
  const prove = async (sessionId: string, person: string, replaced: string | null = null) => {
    sessions.set(sessionId, person);
    meter.proved(sessionId, replaced);
    await settled();
  };
  const settled = async () => {
    while (work.length > 0) await work.shift();
  };
  /** A minute passes and the room's alarm runs. */
  const minute = async () => {
    clock.now += CALL_MINUTE_MS;
    await meter.alarm(clock.now);
    await settled();
  };
  return {
    meter,
    service,
    clock,
    sessions,
    told,
    severed,
    ended,
    saved,
    load,
    arm,
    prove,
    settled,
    minute,
  };
}

/** Two people in a call in a restored, metered room. */
async function call(options: Parameters<typeof setup>[0] = {}) {
  const kit = setup(options);
  await kit.meter.restore();
  expect(await kit.meter.admit(OWNER)).toMatchObject({ ok: true });
  await kit.prove('S-a', 'ada');
  expect(await kit.meter.admit(OWNER)).toMatchObject({ ok: true });
  await kit.prove('S-b', 'ben');
  return kit;
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('with Pro off', () => {
  it('counts nothing, stores nothing, arms nothing and asks nothing', async () => {
    const kit = setup({ service: null });
    await kit.meter.restore();
    expect(kit.meter.on).toBe(false);
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    kit.sessions.set('S-a', 'ada');
    kit.sessions.set('S-b', 'ben');
    kit.meter.proved('S-a', null);
    kit.meter.proved('S-b', 'S-old');
    kit.meter.left('S-a');
    kit.meter.dropped('S-b');
    kit.meter.forget();
    await kit.meter.alarm(START + 10 * CALL_MINUTE_MS);
    expect(kit.meter.due()).toBeNull();
    expect(await kit.meter.read(OWNER)).toBeNull();
    expect(kit.load).not.toHaveBeenCalled();
    expect([kit.saved, kit.told, kit.severed, kit.arm.mock.calls]).toEqual([[], [], [], []]);
  });
});

describe('a minute is one person in a call for one minute', () => {
  it('charges nobody who is alone: a call is two or more people', async () => {
    const kit = setup();
    await kit.meter.restore();
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    await kit.prove('S-a', 'ada');
    expect(kit.service!.spends()).toEqual([]);
    // No alarm runs for calls while nobody is in one.
    expect(kit.meter.due()).toBeNull();
  });

  it('pays the first minute as the call starts, then one a person each minute, in one spend', async () => {
    const kit = await call();
    // The join that makes it a call pays for the person already there; the joiner pays on proving.
    expect(kit.service!.spends()).toEqual([
      { owner: OWNER, amount: 1 },
      { owner: OWNER, amount: 1 },
    ]);
    expect(kit.meter.due()).toBe(START + CALL_MINUTE_MS);
    await kit.minute();
    await kit.prove('S-c', 'cy');
    await kit.minute();
    expect(kit.service!.spends().slice(2)).toEqual([
      { owner: OWNER, amount: 2 },
      { owner: OWNER, amount: 1 },
      { owner: OWNER, amount: 3 },
    ]);
    expect(kit.service!.used.get(OWNER)).toBe(8);
  });

  it('counts a person in two tabs once, and never charges twice inside one minute', async () => {
    const kit = await call();
    await kit.prove('S-a2', 'ada');
    // A renewed session, a re-proof and a rejoin inside the minute cost nothing more.
    await kit.prove('S-b2', 'ben', 'S-b');
    kit.sessions.delete('S-b');
    await kit.prove('S-b2', 'ben');
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    expect(kit.service!.spends()).toHaveLength(2);
    // A proof said again changes nothing, so nothing is written to the room's storage for it.
    const writes = kit.saved.length;
    await kit.prove('S-b2', 'ben');
    await kit.prove('S-a2', 'ada');
    expect(kit.saved).toHaveLength(writes);
    await kit.minute();
    expect(kit.service!.spends()[2]).toEqual({ owner: OWNER, amount: 2 });
  });

  it('is alone in two tabs: no call, nothing charged', async () => {
    const kit = setup();
    await kit.meter.restore();
    await kit.meter.admit(OWNER);
    await kit.prove('S-a', 'ada');
    await kit.meter.admit(OWNER);
    await kit.prove('S-a2', 'ada');
    // The second join looked like a call starting, so the person there paid a minute; the tick finds one person.
    expect(kit.service!.spends()).toEqual([{ owner: OWNER, amount: 1 }]);
    await kit.minute();
    expect(kit.service!.spends()).toHaveLength(1);
    expect(kit.meter.due()).toBeNull();
  });

  it('stops when the call is over: no spend, and no alarm left for calls', async () => {
    const kit = await call();
    kit.sessions.delete('S-b');
    await kit.minute();
    expect(kit.service!.spends()).toHaveLength(2);
    expect(kit.meter.due()).toBeNull();
    // An alarm for something else in the room touches nothing.
    await kit.meter.alarm(kit.clock.now + CALL_MINUTE_MS);
    expect(kit.service!.spends()).toHaveLength(2);
  });

  it("charges the Space's owner it was told, and starts again for a new owner", async () => {
    const kit = await call();
    expect(await kit.meter.admit(TEAM)).toEqual({ ok: true, low: false });
    await kit.minute();
    // The new owner pays from now: the minute under way, then the next.
    expect(kit.service!.spends().slice(2)).toEqual([
      { owner: TEAM, amount: 2 },
      { owner: TEAM, amount: 2 },
    ]);
    expect(kit.service!.used.get(OWNER)).toBe(2);
  });

  it('charges nothing for a session proven before any join named an owner', async () => {
    const kit = setup();
    await kit.meter.restore();
    await kit.prove('S-a', 'ada');
    await kit.prove('S-b', 'ben');
    expect(kit.service!.asked).toEqual([]);
    expect(kit.meter.due()).toBeNull();
  });
});

describe('when the month is used', () => {
  it('shares the last minutes, ends the call at the next tick and refuses every join', async () => {
    const service = fakeSubscription();
    service.limits.set(OWNER, 5);
    const kit = await call({ service });
    await kit.minute();
    // One minute left for two people: it is spent, and the call runs it.
    await kit.minute();
    expect(service.used.get(OWNER)).toBe(5);
    expect(kit.told.filter((op) => op.state === 'used')).toEqual([]);
    await kit.minute();
    // The word is the state alone: it goes to every connection, so it names no owner and no number.
    expect(kit.told.at(-1)).toEqual({ kind: 'call-minutes', state: 'used' });
    // Every call session of the Space is closed at Realtime, and every connection lets go of its session, so a
    // browser that ignores the message loses its media and can hear nobody (the hearing check knows no subscriber).
    expect(kit.severed.sort()).toEqual(['S-a', 'S-b']);
    expect(kit.ended).toEqual([['S-a', 'S-b']]);
    expect(kit.sessions.size).toBe(0);
    expect(kit.meter.paused).toBe(true);
    expect(kit.meter.due()).toBeNull();
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: false, used: 5, limit: 5 });
    expect(await kit.meter.read(OWNER)).toEqual({ used: 5, limit: 5, low: false, paused: true });
    // A stale proof replayed on a new socket spends nothing and tells nobody again.
    const spends = service.spends().length;
    await kit.prove('S-a', 'ada');
    expect(service.spends()).toHaveLength(spends);
    expect(kit.told.filter((op) => op.state === 'used')).toHaveLength(1);
  });

  it('refuses the join that would start a call with nothing left, before a session is minted', async () => {
    const service = fakeSubscription();
    service.limits.set(OWNER, 0);
    const kit = setup({ service });
    await kit.meter.restore();
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    await kit.prove('S-a', 'ada');
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: false, used: 0, limit: 0 });
    expect(kit.told).toEqual([{ kind: 'call-minutes', state: 'used' }]);
    expect(kit.severed).toEqual(['S-a']);
  });

  it('ends the call when the joiner cannot be paid for', async () => {
    const service = fakeSubscription();
    service.limits.set(OWNER, 1);
    const kit = setup({ service });
    await kit.meter.restore();
    await kit.meter.admit(OWNER);
    await kit.prove('S-a', 'ada');
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    await kit.prove('S-b', 'ben');
    expect(kit.told.at(-1)).toEqual({ kind: 'call-minutes', state: 'used' });
    expect(await kit.meter.read(OWNER)).toMatchObject({ used: 1, limit: 1, paused: true });
  });

  it('starts calls again as soon as the owner may use more, and says so', async () => {
    const service = fakeSubscription();
    service.limits.set(OWNER, 2);
    const kit = await call({ service });
    await kit.minute();
    expect(kit.told.at(-1)).toMatchObject({ state: 'used' });
    kit.sessions.clear();
    // The owner moved to a tier with more: the next join finds out (the client asks again after a minute).
    service.limits.set(OWNER, 5_000);
    kit.clock.now += 2 * CALL_MINUTE_MS;
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    expect(kit.told.at(-1)).toEqual({ kind: 'call-minutes', state: 'ok' });
    expect(kit.meter.paused).toBe(false);
    expect(await kit.meter.read(OWNER)).toMatchObject({ paused: false, limit: 5_000 });
  });

  it('starts again in a new month: at the next join, or the next proof', async () => {
    const service = fakeSubscription();
    service.limits.set(OWNER, 2);
    const kit = await call({ service });
    await kit.minute();
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: false, used: 2, limit: 2 });
    // 1 December: the service counts a new month.
    kit.clock.now = Date.UTC(2026, 11, 1, 0, 5);
    service.used.clear();
    // A new month lifts the pause by itself: a proof is taken again, and the call is charged from the new month.
    expect(kit.meter.paused).toBe(false);
    await kit.prove('S-a', 'ada');
    await kit.prove('S-b', 'ben');
    expect(kit.told.at(-1)).toEqual({ kind: 'call-minutes', state: 'ok' });
    expect(service.used.get(OWNER)).toBe(2);

    const next = await call({
      service: (() => {
        const s = fakeSubscription();
        s.limits.set(OWNER, 2);
        return s;
      })(),
    });
    await next.minute();
    next.clock.now = Date.UTC(2026, 11, 1, 0, 5);
    next.service!.used.clear();
    next.sessions.clear();
    expect(await next.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    expect(next.told.at(-1)).toEqual({ kind: 'call-minutes', state: 'ok' });
  });
});

describe('people without an account', () => {
  it('are counted, but no more than ten of them a minute, however many connect', async () => {
    const service = fakeSubscription();
    const kit = setup({ service });
    await kit.meter.restore();
    await kit.meter.admit(OWNER);
    // One visitor opens a hundred connections, each a "person" of its own.
    for (let n = 0; n < 100; n += 1) kit.sessions.set(`v${n}`, unverifiedPerson(`conn-${n}`));
    kit.meter.proved('v0', null);
    await kit.settled();
    expect(service.used.get(OWNER)).toBe(CALL_UNVERIFIED_PEOPLE_MAX);
    // Leaving and coming back as new connections inside the minute costs nothing more.
    kit.sessions.clear();
    for (let n = 100; n < 200; n += 1) kit.sessions.set(`v${n}`, unverifiedPerson(`conn-${n}`));
    kit.meter.proved('v100', null);
    await kit.settled();
    expect(service.used.get(OWNER)).toBe(CALL_UNVERIFIED_PEOPLE_MAX);
    // The next minute pays for ten again, never a hundred.
    await kit.minute();
    expect(service.used.get(OWNER)).toBe(2 * CALL_UNVERIFIED_PEOPLE_MAX);
  });

  it('never hold back anyone with an account: everyone signed in is counted', async () => {
    const service = fakeSubscription();
    const kit = setup({ service });
    await kit.meter.restore();
    await kit.meter.admit(OWNER);
    for (let n = 0; n < 15; n += 1) kit.sessions.set(`v${n}`, unverifiedPerson(`conn-${n}`));
    for (let n = 0; n < 25; n += 1) kit.sessions.set(`a${n}`, `account-${n}`);
    kit.meter.proved('a0', null);
    await kit.settled();
    expect(service.used.get(OWNER)).toBe(25 + CALL_UNVERIFIED_PEOPLE_MAX);
  });

  it('are a call of two: two visitors are charged, where one shared key used to be one person charged nothing', async () => {
    const service = fakeSubscription();
    const kit = setup({ service });
    await kit.meter.restore();
    await kit.meter.admit(OWNER);
    await kit.prove('S-a', unverifiedPerson('conn-a'));
    await kit.meter.admit(OWNER);
    await kit.prove('S-b', unverifiedPerson('conn-b'));
    expect(service.used.get(OWNER)).toBe(2);
  });
});

describe("a guest's Space", () => {
  const FREE = 1000;

  it("counts its own minutes against Free's month and never asks the subscription service", async () => {
    const service = fakeSubscription();
    const kit = setup({ service });
    await kit.meter.restore();
    expect(await kit.meter.admit(GUEST_SPACE)).toEqual({ ok: true, low: false });
    await kit.prove('S-a', 'ada');
    await kit.meter.admit(GUEST_SPACE);
    await kit.prove('S-b', 'ben');
    await kit.minute();
    expect(await kit.meter.read(GUEST_SPACE)).toEqual({
      used: 4,
      limit: FREE,
      low: false,
      paused: false,
    });
    expect(service.spends()).toEqual([]);
    expect(service.asked).toEqual([]);
    expect(kit.saved.at(-1)).toMatchObject({ owner: GUEST_SPACE, used: 4 });
  });

  it('shares the last minutes, says the month is low, then ends the call and refuses the next join', async () => {
    const stored: CallMeterState = {
      owner: GUEST_SPACE,
      month: '2026-11',
      tickAt: null,
      paid: [],
      used: FREE - 83,
      spent: null,
      lowTold: false,
      orphans: [],
    };
    const kit = setup({ stored });
    await kit.meter.restore();
    await kit.meter.admit(GUEST_SPACE);
    await kit.prove('S-a', 'ada');
    await kit.meter.admit(GUEST_SPACE);
    await kit.prove('S-b', 'ben');
    await kit.minute();
    expect(kit.told).toEqual([{ kind: 'call-minutes', state: 'low' }]);
    // 79 left for two people: 39 minutes of two, one last minute shared, and the tick after it cannot be paid.
    for (let n = 0; n < 41; n += 1) await kit.minute();
    expect(kit.told.at(-1)).toEqual({ kind: 'call-minutes', state: 'used' });
    expect(kit.ended).toHaveLength(1);
    expect(await kit.meter.admit(GUEST_SPACE)).toEqual({ ok: false, used: FREE, limit: FREE });
    expect(await kit.meter.read(GUEST_SPACE)).toMatchObject({ paused: true, used: FREE });
    // Signing in makes the Space a person's: the count starts again with their month, at the service.
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
  });
});

describe('running low', () => {
  it('says so once, at 80 minutes left, and tells a later join', async () => {
    const service = fakeSubscription();
    service.limits.set(OWNER, 84);
    const kit = await call({ service });
    expect(kit.told).toEqual([]);
    await kit.minute();
    expect(kit.told).toEqual([{ kind: 'call-minutes', state: 'low' }]);
    await kit.minute();
    expect(kit.told).toHaveLength(1);
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: true });
    expect(await kit.meter.read(OWNER)).toEqual({ used: 6, limit: 84, low: true, paused: false });
  });
});

describe('the subscription service out of reach', () => {
  it('never drops a call, and learns nothing from a spend it could not make', async () => {
    const service = fakeSubscription();
    const kit = await call({ service });
    service.down = true;
    await kit.minute();
    kit.clock.now += 20_000;
    await kit.minute();
    expect(kit.told).toEqual([]);
    expect(kit.severed).toEqual([]);
    expect(kit.meter.due()).not.toBeNull();
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    // What the room last heard stands.
    expect((await kit.meter.read(OWNER))?.used).toBe(2);
  });
});

describe('the subscription service refusing the room', () => {
  it('starts no call it cannot meter, and never says the month is used', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = fakeSubscription();
    service.refuse = 401;
    const kit = setup({ service });
    await kit.meter.restore();
    kit.sessions.set('s1', 'ada');
    // The join that would start a call: refused, as unchecked, with nothing remembered as used.
    expect(await kit.meter.admit(OWNER)).toMatchObject({ ok: false, unchecked: true });
    expect(kit.told).toEqual([]);
    expect(kit.severed).toEqual([]);
    expect((await kit.meter.read(OWNER))?.paused).toBe(false);
    // The key is put right: the next join goes in, with no month to wait out.
    service.refuse = null;
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
  });

  it('keeps a running call going and asks again each minute: it is the room’s key at fault, not the people', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = fakeSubscription();
    const kit = await call({ service });
    const before = service.spends().length;
    service.refuse = 403;
    await kit.minute();
    await kit.minute();
    expect(kit.severed).toEqual([]);
    expect(kit.told).toEqual([]);
    // Asked each minute, and once the service answers the minute is paid again.
    expect(service.spends().length).toBe(before + 2);
    expect(kit.meter.due()).not.toBeNull();
    // A new join, whose minute could not be paid either, is refused: nobody is let in unmetered.
    expect(await kit.meter.admit(OWNER)).toMatchObject({ ok: false, unchecked: true });
    expect((await kit.meter.read(OWNER))?.paused).toBe(false);
    service.refuse = null;
    await kit.minute();
    expect(service.used.get(OWNER)).toBe(4);
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
  });
});

describe('a very large call', () => {
  it('pays for everyone in spends the service takes: never more than a thousand at once, never none', async () => {
    const service = fakeSubscription('callMinutes', 100_000);
    const kit = setup({ service });
    await kit.meter.restore();
    await kit.meter.admit(OWNER);
    for (let person = 0; person < 2500; person += 1) kit.sessions.set(`s${person}`, `p${person}`);
    kit.meter.proved('s0', null);
    await kit.settled();
    const amounts = service.spends().map((spend) => spend.amount);
    expect(amounts).toEqual([1000, 1000, 500]);
    expect(service.used.get(OWNER)).toBe(2500);
    expect(amounts.every((amount) => amount >= 1 && amount <= SPEND_AMOUNT_MAX)).toBe(true);
    // The next minute: the same again.
    await kit.minute();
    expect(service.used.get(OWNER)).toBe(5000);
    expect(kit.severed).toEqual([]);
  });

  it('shares what is left when a part cannot be paid, then ends at the next tick', async () => {
    const service = fakeSubscription('callMinutes', 1200);
    const kit = setup({ service });
    await kit.meter.restore();
    await kit.meter.admit(OWNER);
    for (let person = 0; person < 1500; person += 1) kit.sessions.set(`s${person}`, `p${person}`);
    kit.meter.proved('s0', null);
    await kit.settled();
    // A thousand, then the two hundred left of the five hundred asked for.
    expect(service.spends().map((spend) => spend.amount)).toEqual([1000, 500, 200]);
    expect(service.used.get(OWNER)).toBe(1200);
    expect(kit.severed).toEqual([]);
    await kit.minute();
    expect(kit.told.at(-1)).toEqual({ kind: 'call-minutes', state: 'used' });
    expect(await kit.meter.read(OWNER)).toMatchObject({ used: 1200, limit: 1200, paused: true });
  });
});

describe('a session nobody holds any more', () => {
  it('is closed at Realtime after the grace, unless a connection proves it again', async () => {
    const kit = await call();
    kit.sessions.delete('S-b');
    kit.meter.dropped('S-b');
    expect(kit.meter.due()).toBe(START + CALL_ORPHAN_GRACE_MS);
    // The socket reconnected and proved the same session: nothing is closed.
    await kit.prove('S-b', 'ben');
    expect(kit.meter.due()).toBe(START + CALL_MINUTE_MS);

    kit.sessions.delete('S-a');
    kit.meter.dropped('S-a');
    kit.clock.now += CALL_ORPHAN_GRACE_MS;
    await kit.meter.alarm(kit.clock.now);
    await kit.settled();
    expect(kit.severed).toEqual(['S-a']);
  });

  it('closes a session that said it left, and one a renewal replaced, but never one still held', async () => {
    const kit = await call();
    kit.meter.left('S-a');
    kit.sessions.delete('S-a');
    await kit.prove('S-b2', 'ben', 'S-b');
    // Still on a connection (a second tab holds it): left alone.
    kit.clock.now += CALL_ORPHAN_GRACE_MS;
    await kit.meter.alarm(kit.clock.now);
    await kit.settled();
    expect(kit.severed).toEqual(['S-a']);
    expect(kit.saved.at(-1)?.orphans).toEqual([]);
  });

  it('remembers a bounded number of them, closing the oldest at once past it', async () => {
    const kit = setup();
    await kit.meter.restore();
    for (let i = 0; i <= CALL_ORPHANS_MAX; i++) kit.meter.dropped(`S-${i}`);
    await kit.settled();
    expect(kit.severed).toEqual(['S-0']);
    expect(kit.saved.at(-1)?.orphans).toHaveLength(CALL_ORPHANS_MAX);
  });
});

describe('the room hibernating', () => {
  it('takes up the stored meter, and forgets it when the room is purged', async () => {
    const stored: CallMeterState = {
      owner: OWNER,
      month: '2026-11',
      tickAt: START + 5_000,
      paid: ['ada', 'ben'],
      used: 40,
      spent: null,
      lowTold: false,
      orphans: [],
    };
    const kit = setup({ stored });
    await kit.meter.restore();
    expect(kit.meter.due()).toBe(START + 5_000);
    kit.sessions.set('S-a', 'ada');
    kit.sessions.set('S-b', 'ben');
    kit.clock.now = START + 5_000;
    await kit.meter.alarm(kit.clock.now);
    expect(kit.service!.spends()).toEqual([{ owner: OWNER, amount: 2 }]);
    kit.meter.forget();
    expect(kit.meter.due()).toBeNull();
  });

  it('starts fresh when it was never restored, and waits for that before it counts a proof', async () => {
    const kit = setup();
    kit.sessions.set('S-a', 'ada');
    kit.meter.proved('S-a', null);
    kit.meter.dropped('S-a');
    expect(kit.meter.due()).toBeNull();
    expect(await kit.meter.admit(OWNER)).toEqual({ ok: true, low: false });
    expect(await kit.meter.read(TEAM)).toEqual({
      used: null,
      limit: 1000,
      low: false,
      paused: false,
    });
  });

  it('carries on after a step that failed', async () => {
    const kit = await call();
    const sessions = vi.fn((): Map<string, string> => {
      throw new Error('sockets unavailable');
    });
    const broken = new CallMeter({
      client: () => kit.service!.client(),
      now: () => START,
      load: async () => undefined,
      save: () => {},
      sessions,
      end: () => {},
      tell: () => {},
      sever: async () => {},
      arm: () => {},
      defer: () => {},
    });
    await broken.restore();
    await expect(broken.admit(OWNER)).rejects.toThrow('sockets unavailable');
    sessions.mockImplementation(() => new Map());
    expect(await broken.admit(OWNER)).toEqual({ ok: true, low: false });
  });
});

describe('an answer that names no limit', () => {
  // The service's answer for a meter is always a number; one that is not is read as none left, never as unlimited.
  const answering = (answer: SpendResult) => {
    const sessions = new Map([
      ['S-a', 'ada'],
      ['S-b', 'ben'],
    ]);
    const told: CallMinutesOp[] = [];
    const meter = new CallMeter({
      client: () =>
        ({
          enabled: true,
          spend: async () => answer,
          entitlement: async () => null,
        }) as unknown as SubscriptionClient,
      now: () => START,
      load: async () => undefined,
      save: () => {},
      sessions: () => sessions,
      end: () => sessions.clear(),
      tell: (op) => void told.push(op),
      sever: async () => {},
      arm: () => {},
      defer: () => {},
    });
    return { meter, told };
  };

  it('is the month used at nought, and a refused request at nought, never a number made up', async () => {
    const used = answering({ ok: false, used: 3, limit: null, tier: 'free' });
    await used.meter.restore();
    expect(await used.meter.admit(OWNER)).toEqual({ ok: false, used: 3, limit: 0 });
    expect(used.told).toEqual([{ kind: 'call-minutes', state: 'used' }]);
    const refused = answering({
      ok: false,
      used: 0,
      limit: null,
      tier: 'free',
      unmetered: 'refused',
    });
    await refused.meter.restore();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await refused.meter.admit(OWNER)).toEqual({
      ok: false,
      used: 0,
      limit: 0,
      unchecked: true,
    });
  });
});
