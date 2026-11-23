import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailIntakeResponse, EmailIntakesResponse } from '@liveplanner/api-schema';
import { defaultCatalogue } from '@liveplanner/items';
import { monthKey } from '@liveworkspace/subscription';
import {
  automationWorld,
  type AutomationWorld,
} from '../plan-room/automations/test-automation-world';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { EMAIL_METER, monthFull } from '../plan-room/tier/plan-meters';
import { fakeSubscription, setPlanOwner, type FakeSubscription } from '../plan-room/tier/test-tier';
import { endRepeatWorld, OWNER } from '../plan-room/test-repeat-world';
import type { PlanEnv } from '../types';
import { REJECTIONS, handleIntakeEmail, type IntakeMessage } from './email-handler';
import { INTAKE_SENDER_PER_HOUR, intakesOf } from './intake-store';

// Email to Board's month (docs/specs/026-plan/email-to-board.md "Tiers"): with Pro on, each email made into a card
// spends one of the plan's OWNER's tier's emails a UTC month, over every plan they own, the hourly rates beside it;
// with Pro off, nothing is counted.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);
vi.mock('./intake-members', () => ({
  planMemberAddresses: async () => new Set(['ada@example.com']),
}));

const DOMAIN = 'in.liveplanner.test';
const ME = `p:${OWNER}`;

let w: AutomationWorld;
let fake: FakeSubscription;
let address = '';
const planEnv = (): PlanEnv => w.plans.get('A')!.room.requireEnv();

// A world with a board address that takes anyone's mail; `tiers` turns Pro on.
const world = async (tiers?: Parameters<typeof fakeSubscription>[0]) => {
  fake = fakeSubscription(tiers ?? {});
  w = await automationWorld('A', tiers ? { pro: fake } : {});
  await setPlanItemTypes(planEnv(), 'A', defaultCatalogue());
  Reflect.set(w.env, 'EMAIL_INTAKE_DOMAIN', DOMAIN);
  Reflect.set(planEnv(), 'EMAIL_INTAKE_DOMAIN', DOMAIN);
  const res = await w.as('owner', 'PUT', '/email-intake/b1', { senders: 'anyone' });
  address = (await res.json<EmailIntakeResponse>()).intake.address;
};

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

// One message from `from`, delivered: what the receiving server answered, null when it was taken.
const mail = async (from = 'ada@example.com'): Promise<string | null> => {
  const bytes = new TextEncoder().encode(
    [
      'Authentication-Results: mx.cloudflare.net; dkim=pass; spf=pass; dmarc=pass',
      `From: ${from}`,
      'Subject: Printer is broken',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'It jams.',
    ].join('\r\n'),
  );
  const m: IntakeMessage & { rejected: string | null } = {
    from,
    to: address,
    rawSize: bytes.byteLength,
    raw: new Response(bytes).body!,
    rejected: null,
    setReject(reason: string) {
      m.rejected = reason;
    },
  };
  await handleIntakeEmail(m, w.env);
  return m.rejected;
};
// The owner has spent `n` of this month's emails, over every plan they own.
const spentThisMonth = (n: number, owner = ME) => fake.spent.set(`${owner}:emailToBoard`, n);
const spent = (owner = ME) => fake.spent.get(`${owner}:emailToBoard`) ?? 0;
const marked = (limit: number) =>
  monthFull(planEnv(), 'A', EMAIL_METER, monthKey(Date.now()), limit);
const list = async () => (await w.as('owner', 'GET', '/email-intake')).json<EmailIntakesResponse>();

describe('with Pro off', () => {
  it('counts nothing, takes every mail, and asks the subscription service nothing', async () => {
    await world();
    Object.assign(planEnv(), { SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
    expect(await mail()).toBeNull();
    const listed = await list();
    expect(listed.month).toBeUndefined();
    expect(listed.owner).toBeUndefined();
    expect(fake.calls).toEqual([]);
  });
});

describe('the owner’s month', () => {
  it('spends one email a card, and refuses the mail past Free’s 500 in plain words', async () => {
    await world({});
    spentThisMonth(499);
    expect(await mail()).toBeNull();
    expect(spent()).toBe(500);
    expect(await mail()).toBe(REJECTIONS.month_limit);
    expect(REJECTIONS.month_limit).toBe(
      'This board is not taking email right now. Try again next month.',
    );
    expect(REJECTIONS.month_limit).not.toMatch(/pro|upgrade|tier|free/i);
    expect(await w.items('A')).toHaveLength(1);
    expect((await intakesOf(planEnv(), 'A'))[0]).toMatchObject({ made: 1, refused: 0 });
    expect(await list()).toMatchObject({ month: { limit: 500, full: true }, owner: ME });
    // Found used, the next mail asks the service for no spend.
    const spends = fake.to('spend').length;
    expect(await mail()).toBe(REJECTIONS.month_limit);
    expect(fake.to('spend')).toHaveLength(spends);
  });

  it('starts again on a new month', async () => {
    await world({});
    spentThisMonth(500);
    expect(await mail()).toBe(REJECTIONS.month_limit);
    // Last month's mark is not this month's.
    await planEnv().PLAN_DB.prepare("UPDATE plan_meters SET period = '2000-01'").run();
    spentThisMonth(0);
    expect(await marked(500)).toBe(false);
    expect(await mail()).toBeNull();
  });

  it('is the team’s for a team’s plan, and the owner’s when a collaborator’s mail arrives', async () => {
    // A Pro person's plan in a three-member Pro for Teams library: the team's 5,000 a member, pooled.
    await world({ [ME]: 'pro', 'p:user_bo': 'pro', 't:team_1': 'team' });
    setPlanOwner(w.plans.get('A')!.db, 'A', OWNER, 'team_1');
    spentThisMonth(15_000, 't:team_1');
    expect(await mail('bo@example.com')).toBe(REJECTIONS.month_limit);
    expect(await list()).toMatchObject({ month: { limit: 15_000 }, owner: 't:team_1' });
  });

  it('keeps the hourly rates in force, spending nothing on the mail they refuse', async () => {
    await world({ [ME]: 'pro' });
    for (let i = 0; i < INTAKE_SENDER_PER_HOUR; i += 1) expect(await mail()).toBeNull();
    expect(await mail()).toBe(REJECTIONS.busy);
    expect(spent()).toBe(INTAKE_SENDER_PER_HOUR);
  });

  it('asks for the mail again later when the service cannot check it', async () => {
    await world({});
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const answer = fake.fetcher.fetch;
    fake.fetcher.fetch = async (input, init) =>
      String(input).endsWith('/spend') ? new Response(null, { status: 401 }) : answer(input, init);
    expect(await mail()).toBe(REJECTIONS.unavailable);
    expect(await w.items('A')).toHaveLength(0);
    expect(await marked(0)).toBe(false);
  });

  it('takes the next mail straight after an upgrade, asking for the limits once more before it refuses', async () => {
    await world({});
    spentThisMonth(500);
    expect(await mail()).toBe(REJECTIONS.month_limit);
    fake.tiers.set(ME, 'pro');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 6_000);
    expect(await mail()).toBeNull();
  });

  it('still refuses straight after a recheck that changed nothing', async () => {
    await world({});
    spentThisMonth(500);
    expect(await mail()).toBe(REJECTIONS.month_limit);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 6_000);
    // The owner's limits move, but not past what was met: a larger free figure would be an upgrade.
    expect(await mail()).toBe(REJECTIONS.month_limit);
  });

  it('never passes the limit when mail arrives at once', async () => {
    await world({});
    spentThisMonth(498);
    const senders = ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'];
    const answers = await Promise.all(senders.map((s) => mail(s)));
    expect(answers.filter((a) => a === null)).toHaveLength(2);
    expect(answers.filter((a) => a === REJECTIONS.month_limit)).toHaveLength(3);
    expect(spent()).toBe(500);
  });

  it('tells the service no item count', async () => {
    await world({});
    await mail();
    expect(fake.to('item-count')).toEqual([]);
  });
});
