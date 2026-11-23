// A Space's Call Minutes meter (docs/specs/012-collaboration/call-minutes.md "The meter"; blueprint call-minutes.md).
// The Space's room is the meter: it knows which connections hold a proven call session, and it spends one minute for
// each person in a call, at the start of each minute, from the Space's OWNER's month at the subscription service. No
// browser reports time, and nothing a browser sends names a tier or an owner.
//
// A guest's Space (its owner has no account) is never sent to the service: the room itself counts its minutes, in
// its own storage, against Free's month for that one Space (liveworkspace 019 "A guest's item").
//
// With Pro off (`on` is false) every door here returns at once: nothing is counted, stored or armed, and the service
// is never asked.
import { CALL_MINUTES_LOW, type CallMinutesOp } from '@livehuddle/api-schema';
import {
  guestLimit,
  limitOf,
  monthKey,
  refusedByService,
  SPEND_AMOUNT_MAX,
  type OwnerScope,
  type SpendResult,
  type SubscriptionClient,
} from '@liveworkspace/subscription';

/** One call minute. */
export const CALL_MINUTE_MS = 60_000;
/** A session whose connection dropped, was replaced or said it left is closed at Realtime after this long, unless a
 *  connection holds it again (a socket that reconnects proves its session on the new one). */
export const CALL_ORPHAN_GRACE_MS = 30_000;
/** The room's storage key for the meter. */
export const CALL_METER_KEY = 'call-meter';
/** The most sessions waiting to be closed that the meter remembers: past it the oldest is closed at once. */
export const CALL_ORPHANS_MAX = 64;

/** A guest's Space: nobody at the subscription service pays, and the room counts the Space's own month. */
export const GUEST_SPACE = 'guest';
/** Who pays for a Space's calls: its owner's scope, or the Space itself for a guest's. */
export type CallsPayer = OwnerScope | typeof GUEST_SPACE;

/**
 * The most people WITHOUT AN ACCOUNT (guests and link visitors) counted in one Space in one minute. Anyone can be
 * as many of them as the room has connections (100), each a "person" of its own, so uncapped one visitor could
 * spend a hundred of the owner's minutes a minute. Ten is more signed-out people than a Space's call usually
 * holds, and a tenth of what the room's connections would allow. People with an account are always all counted.
 * Safe range 2..50: lower under-counts real gatherings of guests, higher lets a visitor spend the month faster.
 */
export const CALL_UNVERIFIED_PEOPLE_MAX = 10;
const UNVERIFIED = '~';
/** The meter's key for a person without an account: a guest by their collab key, a link visitor by connection. */
export const unverifiedPerson = (id: string): string => `${UNVERIFIED}${id}`;
const isUnverified = (person: string): boolean => person.startsWith(UNVERIFIED);

export type CallMeterState = {
  /** Who pays, as the last join's grant named them. */
  owner: CallsPayer | null;
  /** The UTC month the numbers below belong to. */
  month: string;
  /** When the next minute is paid; null while no call runs. */
  tickAt: number | null;
  /** The people (collab keys) whose current minute is paid. */
  paid: string[];
  /** What the service last said the owner has used this month; null until it has said. */
  used: number | null;
  /** The owner's month is used, in the numbers the service refused with: joins are refused until the month or the
   *  tier changes. Null while minutes are left. */
  spent: { used: number; limit: number } | null;
  /** The room has said the month is running low. */
  lowTold: boolean;
  /** Sessions no connection holds any more, and when each is closed at Realtime. */
  orphans: { id: string; due: number }[];
};

export type CallMeterHost = {
  /** The subscription client, or null for a room with no env (a unit test's). */
  client: () => SubscriptionClient | null;
  now: () => number;
  load: () => Promise<CallMeterState | undefined>;
  save: (state: CallMeterState) => void;
  /** Every call session a connection holds now, with the person holding it: an account's collab key, or
   *  `unverifiedPerson(...)` for someone without one. */
  sessions: () => Map<string, string>;
  /** Every connection lets go of its call session: nobody is in a call, so the hearing check refuses everyone. */
  end: () => void;
  /** Every connection hears the room's word on the owner's minutes. */
  tell: (op: CallMinutesOp) => void;
  /** Close a session's tracks at Realtime. Never throws. */
  sever: (sessionId: string) => Promise<void>;
  /** Set the room's alarm again: the meter's next time moved. */
  arm: () => void;
  /** The room's background work. */
  defer: (work: Promise<unknown>) => void;
};

/** A join's answer. `unchecked`: the subscription service refused the room's request (a wrong key), so the owner's
 *  minutes could not be asked about; the join is refused as calls being unavailable, never as minutes used. */
export type CallAdmission =
  { ok: true; low: boolean } | { ok: false; used: number; limit: number; unchecked?: true };

type Refusal = { used: number; limit: number; unchecked?: true };

/** What the minutes read answers of the owner's month, as the room knows it. */
export type CallMinutesReading = {
  used: number | null;
  limit: number;
  low: boolean;
  paused: boolean;
};

const fresh = (month: string): CallMeterState => ({
  owner: null,
  month,
  tickAt: null,
  paid: [],
  used: null,
  spent: null,
  lowTold: false,
  orphans: [],
});

export class CallMeter {
  private readonly host: CallMeterHost;
  private held: SubscriptionClient | null | undefined;
  private state: CallMeterState | null = null;
  // One step at a time: a spend awaits the service, and the room takes other events meanwhile.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(host: CallMeterHost) {
    this.host = host;
  }

  private get client(): SubscriptionClient | null {
    if (this.held === undefined) this.held = this.host.client();
    return this.held;
  }

  /** Whether Pro is on here. Off, nothing below does anything. */
  get on(): boolean {
    return this.client?.enabled === true;
  }

  /** Read the stored meter (the room's constructor, before any event). Nothing is read with Pro off. */
  async restore(): Promise<void> {
    if (!this.on) return;
    this.state = (await this.host.load()) ?? fresh(monthKey(this.host.now()));
  }

  /** The room was purged: nothing is remembered. */
  forget(): void {
    this.state = this.on ? fresh(monthKey(this.host.now())) : null;
  }

  /** When the room's alarm is next needed for calls: the next minute, or a session to close. Null with neither. */
  due(): number | null {
    const s = this.state;
    if (!this.on || !s) return null;
    const times = s.orphans.map((o) => o.due);
    if (s.tickAt !== null) times.push(s.tickAt);
    return times.length === 0 ? null : Math.min(...times);
  }

  /**
   * A join, asked by the mint route before it mints (call-minutes.md "A join is admitted first"). Refused while the
   * owner's month is used. A join that starts a call pays the minute of the people already in it.
   */
  admit(owner: CallsPayer): Promise<CallAdmission> {
    if (!this.on) return Promise.resolve({ ok: true, low: false });
    return this.run(async (s) => {
      if (s.owner !== owner) Object.assign(s, fresh(s.month), { owner, orphans: s.orphans });
      let resumed = this.roll(s);
      if (s.spent) {
        // The month is used: calls start again once the owner's tier allows more (the client asks the service at
        // most once a minute, whoever asks).
        if ((await this.limit(owner)) <= s.spent.limit) return { ok: false, ...s.spent };
        s.spent = null;
        s.lowTold = false;
        resumed = true;
      }
      const refused = await this.settle(s, true);
      if (refused) return { ok: false, ...refused };
      if (resumed) this.host.tell({ kind: 'call-minutes', state: 'ok' });
      return { ok: true, low: s.lowTold };
    });
  }

  /**
   * The owner's month is used and no join has lifted it: no connection may hold a call session, and the calls routes
   * refuse every track (call-minutes.md "When the minutes are used"). A new month lifts it by itself.
   */
  get paused(): boolean {
    const s = this.state;
    return this.on && !!s && s.spent !== null && s.month === monthKey(this.host.now());
  }

  /** A connection proved a call session: it is in the call now. `replaced` is the session it held before. */
  proved(sessionId: string, replaced: string | null): void {
    if (!this.on || !this.state) return;
    const s = this.state;
    s.orphans = s.orphans.filter((o) => o.id !== sessionId);
    if (replaced && replaced !== sessionId) this.orphan(replaced, CALL_ORPHAN_GRACE_MS);
    this.host.defer(this.run((state) => this.settle(state, false)));
  }

  /** A session said it left the call: closed at Realtime at the alarm's next run, if it is still not held. */
  left(sessionId: string): void {
    this.orphan(sessionId, 0);
  }

  /** A connection holding a session closed: the session is closed at Realtime unless a connection proves it again. */
  dropped(sessionId: string): void {
    this.orphan(sessionId, CALL_ORPHAN_GRACE_MS);
  }

  /** The room's alarm: pay the next minute when it is due, and close the sessions nobody holds. Safe to call early. */
  async alarm(now: number): Promise<void> {
    if (this.due() === null) return;
    await this.run(async (s) => {
      if (s.tickAt !== null && s.tickAt <= now) {
        s.paid = [];
        s.tickAt = null;
        await this.settle(s, false);
      }
      const held = this.host.sessions();
      const due = s.orphans.filter((o) => o.due <= now);
      if (due.length === 0) return;
      s.orphans = s.orphans.filter((o) => o.due > now);
      for (const o of due) if (!held.has(o.id)) this.host.defer(this.host.sever(o.id));
    });
  }

  /** The owner's month for the minutes read: the service's limit now, and what the room last heard was used. */
  async read(owner: CallsPayer): Promise<CallMinutesReading | null> {
    if (!this.on) return null;
    const limit = await this.limit(owner);
    const held = this.state;
    const s =
      held && held.owner === owner && held.month === monthKey(this.host.now()) ? held : null;
    const spent = s?.spent ?? null;
    if (spent && limit <= spent.limit) return { ...spent, low: false, paused: true };
    const used = s ? s.used : null;
    const left = used === null ? limit : limit - used;
    return { used, limit, low: left > 0 && left <= CALL_MINUTES_LOW, paused: false };
  }

  // The owner's limit as the service has it now (the client keeps an answer for a minute); Free's for a guest's
  // Space, which the service is never asked about.
  private async limit(owner: CallsPayer): Promise<number> {
    if (owner === GUEST_SPACE) return guestLimit('callMinutesPerMonth');
    return limitOf(await this.client!.entitlement(owner), 'callMinutesPerMonth', 0);
  }

  // One step on the meter, after every step before it, saved when it changed anything and re-armed after. A failed
  // step never wedges the next.
  private run<T>(step: (state: CallMeterState) => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      const s = this.state ?? (this.state = fresh(monthKey(this.host.now())));
      // A proof said again (a browser says it after every refused subscribe) changes nothing: no storage write.
      const before = JSON.stringify(s);
      try {
        return await step(s);
      } finally {
        if (JSON.stringify(s) !== before) this.host.save(s);
        this.host.arm();
      }
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  // A new UTC month starts the count again. True when that lifted a used month.
  private roll(s: CallMeterState): boolean {
    const month = monthKey(this.host.now());
    if (month === s.month) return false;
    const lifted = s.spent !== null;
    Object.assign(s, { month, used: null, spent: null, lowTold: false });
    return lifted;
  }

  /**
   * Everyone in the call has the current minute paid, and the next is due a minute on. `joining`: one more person is
   * about to join, who pays when their connection proves the session. Answers the refusal's numbers when the owner's
   * month is used, else null.
   */
  private async settle(s: CallMeterState, joining: boolean): Promise<Refusal | null> {
    const owner = s.owner;
    if (owner === null) return null;
    if (this.roll(s)) this.host.tell({ kind: 'call-minutes', state: 'ok' });
    if (s.spent) return s.spent;
    const people = new Set(this.host.sessions().values());
    // A call is two or more people: someone alone in a Space pays nothing.
    if (people.size + (joining ? 1 : 0) < 2) return null;
    const unpaid = this.owed(s, people);
    if (unpaid.length > 0) {
      const result = await this.charge(s, owner, unpaid.length);
      if (refusedByService(result)) {
        // The service refused the room's request (its key, never the owner's month): nothing is remembered as used.
        // A join is refused; a call already running keeps running, and its minute is asked for again a minute on.
        console.error('[calls] minutes not checked: the subscription service refused the request');
        if (!joining && s.tickAt === null) s.tickAt = this.host.now() + CALL_MINUTE_MS;
        return joining ? { used: result.used, limit: result.limit ?? 0, unchecked: true } : null;
      }
      if (!result.ok) return this.exhaust(s, result);
      s.paid.push(...unpaid);
    }
    if (s.tickAt === null) s.tickAt = this.host.now() + CALL_MINUTE_MS;
    return null;
  }

  // The people whose current minute is still to pay: everyone with an account, and of the people without one no
  // more than CALL_UNVERIFIED_PEOPLE_MAX in any one minute, however many connect, leave and come back inside it.
  private owed(s: CallMeterState, people: ReadonlySet<string>): string[] {
    const unpaid = [...people].filter((key) => !s.paid.includes(key));
    const room = Math.max(0, CALL_UNVERIFIED_PEOPLE_MAX - s.paid.filter(isUnverified).length);
    return [
      ...unpaid.filter((key) => !isUnverified(key)),
      ...unpaid.filter(isUnverified).sort().slice(0, room),
    ];
  }

  // A guest's Space's minutes, counted here against Free's month for the Space: what is left is spent (the last
  // minutes are shared), and nothing once none is.
  private chargeHere(s: CallMeterState, count: number): SpendResult {
    const limit = guestLimit('callMinutesPerMonth');
    const used = s.used ?? 0;
    const left = limit - used;
    if (left <= 0) return { ok: false, used, limit, tier: 'free' };
    return {
      ok: true,
      used: used + Math.min(Math.max(1, Math.floor(count)), left),
      limit,
      tier: 'free',
    };
  }

  // `count` people's minute (one or more), spent in parts of at most SPEND_AMOUNT_MAX: the service takes no larger
  // spend, so a very large call still pays for everyone. With fewer minutes left than people, what is left is spent
  // and the call runs its last minute. The service out of reach allows it (the client's rule) and counts nothing.
  private async charge(s: CallMeterState, owner: CallsPayer, count: number): Promise<SpendResult> {
    const result =
      owner === GUEST_SPACE ? this.chargeHere(s, count) : await this.chargeOwner(owner, count);
    // The client's own answer for a service it could not reach (or one that reads nothing used): the minute is
    // allowed and nothing is learned from it.
    if (!result.ok || result.unmetered || result.used === 0 || result.limit === null) return result;
    s.used = result.used;
    const after = result.limit - result.used;
    if (after > 0 && after <= CALL_MINUTES_LOW && !s.lowTold) {
      s.lowTold = true;
      this.host.tell({ kind: 'call-minutes', state: 'low' });
    }
    return result;
  }

  private async chargeOwner(owner: OwnerScope, count: number): Promise<SpendResult> {
    const client = this.client!;
    let result!: SpendResult;
    for (let unpaid = Math.max(1, Math.floor(count)); unpaid > 0;) {
      const amount = Math.min(unpaid, SPEND_AMOUNT_MAX);
      result = await client.spend(owner, 'callMinutes', amount);
      if (!result.ok) {
        // Only the service's own count says what is left: the client's own answer (`unmetered`) knows none.
        const left =
          result.unmetered || result.limit === null
            ? 0
            : Math.min(amount - 1, result.limit - result.used);
        if (left > 0) result = await client.spend(owner, 'callMinutes', left);
        break;
      }
      unpaid -= amount;
    }
    return result;
  }

  // The owner's month is used: every connection is told (the state alone: the numbers are the owner's, and the
  // minutes read gives them to whoever may know), every call session of the Space is closed at Realtime, and every
  // connection lets go of its session, so a browser that ignores the word can hear nobody and be heard by nobody.
  private exhaust(s: CallMeterState, refusal: SpendResult): { used: number; limit: number } {
    const spent = { used: refusal.used, limit: refusal.limit ?? 0 };
    Object.assign(s, { spent, used: refusal.used, tickAt: null, paid: [] });
    console.info('[calls] minutes used');
    this.host.tell({ kind: 'call-minutes', state: 'used' });
    for (const id of this.host.sessions().keys()) this.host.defer(this.host.sever(id));
    this.host.end();
    return spent;
  }

  private orphan(sessionId: string, wait: number): void {
    const s = this.state;
    if (!this.on || !s) return;
    s.orphans = s.orphans.filter((o) => o.id !== sessionId);
    s.orphans.push({ id: sessionId, due: this.host.now() + wait });
    while (s.orphans.length > CALL_ORPHANS_MAX) {
      this.host.defer(this.host.sever(s.orphans.shift()!.id));
    }
    this.host.save(s);
    this.host.arm();
  }
}
