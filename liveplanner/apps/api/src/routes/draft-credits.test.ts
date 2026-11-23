import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_CREDITS_USED } from '@liveplanner/items';
import type { FormDraftErrorBody, PlanDraftErrorBody } from '@liveplanner/api-schema';
import {
  giveBackPlanDraftIn,
  PLAN_DRAFT_COUNT_KEY,
  planDraftCountName,
  spendPlanDraftIn,
} from '../plan-draft-count';
import { fakeSubscription, proEnv, type FakeSubscription } from '../plan-room/tier/test-tier';
import type { AutomationsAi, Env } from '../types';
import { handleFormDrafts } from './form-drafts';
import { handlePlanDrafts } from './plan-drafts';
import { makeTestRouteContext } from './test-route-context';

// Describe a Plan's and Describe a Form's AI credit (docs/specs/026-plan/describe-a-plan.md "Limits and cost"): with
// Pro on, one of the signed-in PERSON's credits for the month a draft, spent before the model is asked; with Pro
// off, nothing. The subscription service and Workers AI are stand-ins.
vi.mock('../server-telemetry', () => ({ reportServerEvent: async () => {} }));

const PLAN = {
  outcome: 'plan',
  plan: {
    title: 'Hiring',
    columns: ['Applied', 'Offer'],
    cardTypes: [{ name: 'Candidate', glyph: 'person', builtInFields: [], fields: [] }],
  },
};
const FORM = {
  outcome: 'form',
  form: {
    heading: 'Summer Party RSVP',
    respondsTo: 'sheet',
    sections: [{ questions: [{ type: 'short', prompt: 'Your name', required: true }] }],
  },
};

let asked: number;
let reply: unknown;
let env: Env;
let fake: FakeSubscription;
// The drafts each account has counted today (the per-day safety cap's own store).
let counts: Map<string, Map<string, unknown>>;

function world(tiers?: Parameters<typeof fakeSubscription>[0]) {
  const run: AutomationsAi['run'] = () => {
    asked += 1;
    return Promise.resolve({ response: reply });
  };
  const ns = {
    idFromName: (name: string) => name,
    get: (name: string) => {
      const map = counts.get(name) ?? new Map<string, unknown>();
      counts.set(name, map);
      const storage = {
        get: async (k: string) => map.get(k),
        put: async (k: string, v: unknown) => void map.set(k, v),
      } as unknown as DurableObjectStorage;
      return {
        spendPlanDraft: (day: string, cap: number) => spendPlanDraftIn(storage, day, cap),
        giveBackPlanDraft: (day: string) => giveBackPlanDraftIn(storage, day),
      };
    },
  };
  env = { AI: { run }, PLAN_ROOM: ns } as unknown as Env;
  fake = fakeSubscription(tiers ?? {});
  if (tiers) proEnv(env, fake);
  else Object.assign(env, { SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
}

beforeEach(() => {
  asked = 0;
  counts = new Map();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const draft = (kind: 'plan' | 'form', body: Record<string, unknown> = {}, account = 'user_a') => {
  reply = kind === 'plan' ? PLAN : FORM;
  const ctx = makeTestRouteContext('POST', `/api/${kind}-drafts`, {
    owner: account,
    accountUserId: account,
    body: { prompt: 'A hiring pipeline with Applied and Offer', ...body },
    env,
    headers: { 'X-Tier': 'pro' },
  });
  return kind === 'plan' ? handlePlanDrafts(ctx) : handleFormDrafts(ctx);
};

describe.each(['plan', 'form'] as const)('Describe a %s', (kind) => {
  it('spends nothing with Pro off, and asks the subscription service nothing', async () => {
    world();
    expect((await draft(kind)).status).toBe(200);
    expect(fake.calls).toEqual([]);
  });

  it('spends one of the signed-in person’s credits a draft, before the model is asked', async () => {
    world({});
    expect((await draft(kind)).status).toBe(200);
    expect(fake.to('spend')).toEqual([{ owner: 'p:user_a', meter: 'aiCredits', amount: 1 }]);
    expect(asked).toBe(1);
  });

  it('is refused 429 at Free’s 50 with the limit, asking no model, whatever tier the request claims', async () => {
    world({});
    fake.spent.set('p:user_a:aiCredits', 49);
    expect((await draft(kind)).status).toBe(200);
    const over = await draft(kind, { tier: 'pro', limits: { aiCreditsPerMonth: 9999 } });
    expect(over.status).toBe(429);
    expect(await over.json<PlanDraftErrorBody | FormDraftErrorBody>()).toEqual({
      error: `${kind}_draft_credits_used`,
      message: AI_CREDITS_USED,
      limit: 'aiCreditsPerMonth',
      used: 50,
      max: 50,
    });
    expect(asked).toBe(1);
  });

  it('gives the day’s place back when the credit is refused, so used credits never cost the day’s drafts', async () => {
    world({});
    fake.spent.set('p:user_a:aiCredits', 50);
    for (let i = 0; i < 3; i += 1) expect((await draft(kind)).status).toBe(429);
    const count = counts.get(planDraftCountName('user_a'))?.get(PLAN_DRAFT_COUNT_KEY);
    expect(count).toMatchObject({ count: 0 });
    expect(asked).toBe(0);
  });

  it('allows more on Pro, each person on their own credits', async () => {
    world({ 'p:user_a': 'pro' });
    fake.spent.set('p:user_a:aiCredits', 50);
    fake.spent.set('p:user_b:aiCredits', 50);
    expect((await draft(kind)).status).toBe(200);
    expect((await draft(kind, {}, 'user_b')).status).toBe(429);
  });

  it('keeps the day’s cap in force on every tier, spending no credit past it', async () => {
    world({ 'p:user_a': 'pro' });
    for (let i = 0; i < 10; i += 1) expect((await draft(kind)).status).toBe(200);
    const capped = await draft(kind);
    expect(capped.status).toBe(429);
    expect((await capped.json<PlanDraftErrorBody>()).error).toBe(`${kind}_draft_capped`);
    expect(fake.to('spend')).toHaveLength(10);
  });
});
