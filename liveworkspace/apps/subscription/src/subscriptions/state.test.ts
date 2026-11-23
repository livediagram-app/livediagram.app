// The States table (subscription.md "States"): every change a provider reports, from every state, and what the clock
// does to a row nobody has swept.
import {
  addMonth,
  GRACE_MS,
  RENEWAL_TOLERANCE_MS,
  TEAM_SEATS_MAX,
  type SubscriptionState,
} from '@liveworkspace/subscription';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEATS_MAX } from '../config';
import { ENTITLED_LIMIT, limitBinds } from '../meters/limits';
import { DAY, rowOf, subscribe } from '../test-kit';
import { testDb } from '../test-sqlite-d1';
import { entitlementAt, summaryAt, tierAt } from './entitlement';
import {
  changed,
  isLive,
  liveUntil,
  renewedTo,
  seatsOf,
  stateAt,
  subscribed,
  type SubscriptionChange,
} from './state';

const NOW = Date.UTC(2026, 10, 20, 12);
const pro = (state: SubscriptionState, patch = {}) => rowOf('p:user_ada', NOW, { state, ...patch });
// A renewal that failed as the period ended: grace runs seven days from then.
const pastDue = (patch = {}) =>
  pro('past_due', { period_end: NOW, grace_end: NOW + GRACE_MS, ...patch });

describe('the clock', () => {
  it('keeps an active subscription for the renewal tolerance past its period, so Renews never quietly means ends', () => {
    const row = pro('active');
    expect(stateAt(row, row.period_end - 1)).toBe('active');
    // The provider's word on the renewal is on its way: still Pro, and still able to take it.
    expect(stateAt(row, row.period_end)).toBe('active');
    expect(stateAt(row, row.period_end + RENEWAL_TOLERANCE_MS - 1)).toBe('active');
    expect(stateAt(row, row.period_end + RENEWAL_TOLERANCE_MS)).toBe('ended');
    expect(isLive(row, row.period_end + RENEWAL_TOLERANCE_MS)).toBe(false);
    expect(RENEWAL_TOLERANCE_MS).toBe(3 * DAY);
  });

  it('ends a cancelled subscription at its period’s end exactly', () => {
    const row = pro('cancelling');
    expect(stateAt(row, row.period_end - 1)).toBe('cancelling');
    expect(stateAt(row, row.period_end)).toBe('ended');
    expect(liveUntil(row)).toBe(row.period_end);
  });

  it('keeps past_due until the LATER of the paid period’s end and grace’s: grace never ends Pro early', () => {
    // Failed with twenty days of the month still paid for: grace alone would end Pro thirteen days early.
    const early = pro('past_due', { period_end: NOW + 20 * DAY, grace_end: NOW + GRACE_MS });
    expect(stateAt(early, NOW + GRACE_MS)).toBe('past_due');
    expect(stateAt(early, NOW + 20 * DAY - 1)).toBe('past_due');
    expect(stateAt(early, NOW + 20 * DAY)).toBe('ended');
    // Failed as the period ended: the seven days of grace are what is left.
    const late = pastDue();
    expect(stateAt(late, NOW + GRACE_MS - 1)).toBe('past_due');
    expect(stateAt(late, NOW + GRACE_MS)).toBe('ended');
    // No grace recorded: the period paid for is all there is.
    expect(liveUntil(pro('past_due'))).toBe(pro('past_due').period_end);
  });

  it('never brings an ended row back', () => {
    expect(stateAt(pro('ended'), NOW)).toBe('ended');
    expect(isLive(pro('ended'), NOW)).toBe(false);
    expect(liveUntil(pro('ended'))).toBe(0);
  });

  it('says the same in SQL as in TypeScript, for every state at every edge', async () => {
    const db = testDb();
    const edges = [-RENEWAL_TOLERANCE_MS - 1, -RENEWAL_TOLERANCE_MS, -DAY, -1, 0, 1, DAY, GRACE_MS];
    const graces = [null, ...edges.map((edge) => NOW + edge)];
    let compared = 0;
    for (const state of ['active', 'cancelling', 'past_due', 'ended'] as const) {
      for (const period of edges) {
        for (const grace_end of graces) {
          const row = await subscribe(db.env, 'p:user_ada', NOW, {
            state,
            period_end: NOW + period,
            grace_end,
          });
          const sql = await db.env.SUBSCRIPTION_DB.prepare(`${ENTITLED_LIMIT} SELECT paid FROM ent`)
            .bind(...limitBinds('p:user_ada', 'aiCreditsPerMonth', NOW))
            .first<{ paid: number }>();
          expect(sql!.paid === 1, `${state} period ${period} grace ${grace_end}`).toBe(
            isLive(row, NOW),
          );
          compared++;
        }
      }
    }
    expect(compared).toBe(4 * edges.length * graces.length);
  });
});

describe('each change, from each state', () => {
  const allowed: Record<SubscriptionChange['kind'], SubscriptionState[]> = {
    cancel: ['active', 'past_due'],
    resume: ['cancelling'],
    payment_failed: ['active'],
    payment_recovered: ['past_due'],
    grace_ended: ['past_due'],
    period_ended: ['active', 'cancelling'],
    renewed: ['active'],
    seats: [],
  };
  // Each at the end of its period, where a renewal is taken.
  const rows = {
    active: pro('active', { period_end: NOW + DAY }),
    cancelling: pro('cancelling', { period_end: NOW + DAY }),
    past_due: pastDue(),
    ended: pro('ended'),
  };

  for (const [kind, from] of Object.entries(allowed)) {
    it(`${kind} is allowed only from ${from.join(', ') || 'a live team'}`, () => {
      for (const [state, row] of Object.entries(rows)) {
        const patch = changed(row, { kind, seats: 5 } as SubscriptionChange, NOW);
        expect(patch !== null, `${kind} from ${state}`).toBe(
          from.includes(state as SubscriptionState),
        );
      }
    });
  }

  it('cancel keeps the period and resume undoes it', () => {
    expect(changed(pro('active'), { kind: 'cancel' }, NOW)).toEqual({
      state: 'cancelling',
      cancel_at_period_end: 1,
    });
    expect(changed(pro('cancelling'), { kind: 'resume' }, NOW)).toEqual({
      state: 'active',
      cancel_at_period_end: 0,
    });
  });

  it('cancel while past due keeps what it had, and resume goes back to past due, never to paid', () => {
    const late = pastDue();
    const patch = changed(late, { kind: 'cancel' }, NOW);
    expect(patch).toEqual({ state: 'cancelling', cancel_at_period_end: 1 });
    const cancelled = { ...late, ...patch };
    // Grace is still what it had: it ends at the later of the period's end and grace's.
    expect(liveUntil(cancelled)).toBe(NOW + GRACE_MS);
    expect(stateAt(cancelled, NOW + GRACE_MS - 1)).toBe('cancelling');
    expect(stateAt(cancelled, NOW + GRACE_MS)).toBe('ended');
    // The renewal was never paid, so resuming cannot make it active.
    expect(changed(cancelled, { kind: 'resume' }, NOW)).toEqual({
      state: 'past_due',
      cancel_at_period_end: 0,
    });
    expect(changed(cancelled, { kind: 'payment_recovered' }, NOW)).toBeNull();
  });

  it('a failed payment starts seven days of grace', () => {
    expect(changed(pro('active'), { kind: 'payment_failed' }, NOW)).toEqual({
      state: 'past_due',
      grace_end: NOW + 7 * DAY,
    });
  });

  it('a renewal or a failure reported after the period ended is taken, on the stored state', () => {
    // A real provider's word lands hours after the period ended: refused before, so grace could never start.
    const row = pro('active', { period_end: NOW - 2 * DAY });
    expect(changed(row, { kind: 'payment_failed' }, NOW)).toEqual({
      state: 'past_due',
      grace_end: NOW + GRACE_MS,
    });
    expect(changed(row, { kind: 'renewed' }, NOW)).toEqual({
      period_start: row.period_end,
      period_end: addMonth(row.period_end, row.anchor_day),
    });
    // Past the tolerance the row has ended, and takes neither.
    const gone = pro('active', { period_end: NOW - RENEWAL_TOLERANCE_MS });
    expect(changed(gone, { kind: 'payment_failed' }, NOW)).toBeNull();
    expect(changed(gone, { kind: 'renewed' }, NOW)).toBeNull();
  });

  it('a recovered payment keeps a period still running, and moves one that ended on a month', () => {
    expect(changed(pastDue({ period_end: NOW + DAY }), { kind: 'payment_recovered' }, NOW)).toEqual(
      {
        state: 'active',
        grace_end: null,
        cancel_at_period_end: 0,
      },
    );
    const lapsed = pastDue({ period_end: NOW - DAY });
    expect(changed(lapsed, { kind: 'payment_recovered' }, NOW)).toEqual({
      state: 'active',
      grace_end: null,
      cancel_at_period_end: 0,
      period_start: NOW - DAY,
      period_end: addMonth(NOW - DAY, lapsed.anchor_day),
    });
  });

  it('grace and the period end now', () => {
    expect(changed(pastDue(), { kind: 'grace_ended' }, NOW)).toEqual({
      state: 'ended',
      grace_end: NOW,
      ended_at: NOW,
    });
    expect(changed(pro('cancelling'), { kind: 'period_ended' }, NOW)).toEqual({
      state: 'ended',
      period_end: NOW,
      grace_end: null,
      ended_at: NOW,
    });
  });

  it('a renewal moves the period on a month from where it ended, on its anchor day', () => {
    // Taken on the 31st of January, now in its February period (the 28th): March is the 31st again.
    const feb = Date.UTC(2027, 1, 28, 10);
    const row = pro('active', {
      period_start: Date.UTC(2027, 0, 31, 10),
      period_end: feb,
      anchor_day: 31,
    });
    expect(changed(row, { kind: 'renewed' }, feb)).toEqual({
      period_start: feb,
      period_end: Date.UTC(2027, 2, 31, 10),
    });
  });

  it('a renewal is only taken near the period’s end: months never stack', () => {
    const row = pro('active');
    expect(changed(row, { kind: 'renewed' }, NOW)).toBeNull();
    expect(changed(row, { kind: 'renewed' }, row.period_end - RENEWAL_TOLERANCE_MS - 1)).toBeNull();
    const first = changed(row, { kind: 'renewed' }, row.period_end - RENEWAL_TOLERANCE_MS);
    expect(first).not.toBeNull();
    // Renewed once, the new period's end is a month away: pressing again does nothing.
    expect(changed({ ...row, ...first }, { kind: 'renewed' }, row.period_end)).toBeNull();
  });

  it('a row the clock has ended takes no change, whatever its stored state', () => {
    const row = pro('active', { period_end: NOW - RENEWAL_TOLERANCE_MS });
    for (const kind of ['cancel', 'payment_failed', 'period_ended', 'renewed'] as const) {
      expect(changed(row, { kind }, NOW)).toBeNull();
    }
    expect(changed(pro('cancelling', { period_end: NOW }), { kind: 'resume' }, NOW)).toBeNull();
    expect(
      changed(
        pastDue({ period_end: NOW - DAY, grace_end: NOW }),
        { kind: 'payment_recovered' },
        NOW,
      ),
    ).toBeNull();
  });

  it("seats change a live team's only, never below three or over a team's two hundred", () => {
    const team = rowOf('t:team_1', NOW);
    expect(changed(team, { kind: 'seats', seats: 12 }, NOW)).toEqual({
      seats: 12,
      seats_checked_at: NOW,
    });
    expect(changed(team, { kind: 'seats', seats: 1 }, NOW)).toEqual({
      seats: 3,
      seats_checked_at: NOW,
    });
    expect(changed(team, { kind: 'seats', seats: 200 }, NOW)).toMatchObject({ seats: 200 });
    expect(changed(pro('active'), { kind: 'seats', seats: 5 }, NOW)).toBeNull();
    expect(
      changed(rowOf('t:team_1', NOW, { state: 'ended' }), { kind: 'seats', seats: 5 }, NOW),
    ).toBeNull();
    for (const seats of [0, -1, 1.5, 201, 10_000, SEATS_MAX + 1, Number.NaN]) {
      expect(changed(team, { kind: 'seats', seats }, NOW)).toBeNull();
    }
    expect(seatsOf('5')).toBeNull();
    expect(SEATS_MAX).toBe(TEAM_SEATS_MAX);
    // The most people accounts lets a team have, read from its source (its types are not this Worker's to
    // compile): the two move together or this fails.
    const shared = readFileSync(
      fileURLToPath(new URL('../../../accounts/src/teams/shared.ts', import.meta.url).href),
      'utf8',
    );
    expect(Number(/MAX_MEMBERS_PER_TEAM = (\d+);/.exec(shared)?.[1])).toBe(SEATS_MAX);
  });
});

describe('the mock provider’s own renewal', () => {
  it('moves an active period that has ended on to the one now falls in, on its anchor day', () => {
    const row = pro('active', {
      period_start: Date.UTC(2026, 11, 31),
      period_end: Date.UTC(2027, 0, 31),
      anchor_day: 31,
    });
    expect(renewedTo(row, Date.UTC(2027, 0, 31))).toEqual({
      period_start: Date.UTC(2027, 0, 31),
      period_end: Date.UTC(2027, 1, 28),
    });
    // A sweep that did not run for months catches up in one go, and the 31st comes back.
    expect(renewedTo(row, Date.UTC(2027, 2, 15))).toEqual({
      period_start: Date.UTC(2027, 1, 28),
      period_end: Date.UTC(2027, 2, 31),
    });
  });

  it('leaves a period still running, and anything that is not active', () => {
    expect(renewedTo(pro('active'), NOW)).toBeNull();
    for (const state of ['cancelling', 'past_due', 'ended'] as const) {
      expect(renewedTo(pro(state, { period_end: NOW - DAY }), NOW)).toBeNull();
    }
  });
});

describe('a new subscription', () => {
  it('is active for one month from now, a person on one seat', () => {
    const row = subscribed(
      {
        owner: 'p:user_ada',
        tier: 'pro',
        seats: 9,
        currency: 'USD',
        unitAmount: 10,
        provider: 'mock',
        providerRef: 'ref',
        subscribedBy: 'user_ada',
      },
      NOW,
    );
    expect(row).toMatchObject({
      state: 'active',
      seats: 1,
      currency: 'USD',
      unit_amount: 10,
      period_start: NOW,
      period_end: addMonth(NOW),
      anchor_day: 20,
      grace_end: null,
      cancel_at_period_end: 0,
    });
  });

  it("holds a team's seats, never fewer than three", () => {
    const base = {
      owner: 't:team_1' as const,
      tier: 'team' as const,
      currency: 'GBP' as const,
      unitAmount: 6,
      provider: 'mock',
      providerRef: null,
      subscribedBy: 'user_ada',
    };
    expect(subscribed({ ...base, seats: 2 }, NOW).seats).toBe(3);
    expect(subscribed({ ...base, seats: 8 }, NOW).seats).toBe(8);
  });
});

describe('what a row is worth', () => {
  it('is Free without a row, and once the clock has ended it', () => {
    expect(tierAt('p:user_ada', null, NOW)).toBe('free');
    expect(tierAt('p:user_ada', pro('cancelling', { period_end: NOW }), NOW)).toBe('free');
    expect(
      tierAt('p:user_ada', pro('active', { period_end: NOW - RENEWAL_TOLERANCE_MS }), NOW),
    ).toBe('free');
    // An active one whose renewal is on its way is still paid.
    expect(tierAt('p:user_ada', pro('active', { period_end: NOW }), NOW)).toBe('pro');
    expect(entitlementAt('p:user_ada', null, NOW)).toMatchObject({ tier: 'free', seats: 1 });
  });

  it('is Pro for a person in every paid state', () => {
    for (const row of [pro('active'), pro('cancelling'), pastDue()]) {
      expect(entitlementAt('p:user_ada', row, NOW)).toMatchObject({
        tier: 'pro',
        seats: 1,
        limits: { aiCreditsPerMonth: 1000, ownAiKey: true },
      });
    }
  });

  it("pools a team's per-member limits by its seats and leaves the rest", () => {
    const entitlement = entitlementAt('t:team_1', rowOf('t:team_1', NOW, { seats: 5 }), NOW);
    expect(entitlement).toMatchObject({
      tier: 'team',
      seats: 5,
      limits: {
        aiCreditsPerMonth: 2500,
        callMinutesPerMonth: 12_500,
        automationRunsPerMonth: 25_000,
        publicRoadmaps: null,
      },
    });
  });

  it('summarises a paid owner with its price, period and grace', () => {
    const team = summaryAt('t:team_1', rowOf('t:team_1', NOW, { seats: 4 }), {}, NOW);
    expect(team).toMatchObject({
      tier: 'team',
      state: 'active',
      seats: 4,
      currency: 'GBP',
      amount: 24,
      graceEnds: null,
    });
    const late = summaryAt('p:user_ada', pastDue(), { aiCredits: { used: 3 } }, NOW);
    expect(late).toMatchObject({
      state: 'past_due',
      graceEnds: NOW + GRACE_MS,
      usage: { aiCredits: { used: 3 } },
    });
  });

  it('shows the day Pro really ends: never grace’s when the paid period outlasts it', () => {
    const early = pro('past_due', { period_end: NOW + 20 * DAY, grace_end: NOW + GRACE_MS });
    expect(summaryAt('p:user_ada', early, {}, NOW).graceEnds).toBe(NOW + 20 * DAY);
    // Cancelled while past due: the day shown is the day it ends.
    const cancelled = pro('cancelling', { period_end: NOW - DAY, grace_end: NOW + GRACE_MS });
    expect(summaryAt('p:user_ada', cancelled, {}, NOW)).toMatchObject({
      state: 'cancelling',
      periodEnd: NOW + GRACE_MS,
      graceEnds: null,
    });
    const plain = pro('cancelling');
    expect(summaryAt('p:user_ada', plain, {}, NOW).periodEnd).toBe(plain.period_end);
  });

  it('summarises a Free owner with no price, a team by the seats it would be billed', () => {
    expect(summaryAt('p:user_ada', pro('ended'), {}, NOW)).toMatchObject({
      tier: 'free',
      state: null,
      seats: 1,
      currency: null,
      amount: null,
      periodEnd: null,
    });
    expect(summaryAt('t:team_1', null, {}, NOW, 7).seats).toBe(7);
    expect(summaryAt('t:team_1', null, {}, NOW).seats).toBe(3);
  });
});
