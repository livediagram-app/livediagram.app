import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAN_DRAFT_FAILED } from '@liveplanner/items';
import type { FormDraftErrorBody, PlanDraftErrorBody } from '@liveplanner/api-schema';
import { spendPlanDraftIn } from '../plan-draft-count';
import type { PlanGrant } from '../index-service';
import type { AutomationsAi, Env } from '../types';
import { handleFormDrafts } from './form-drafts';
import { handlePlanDrafts } from './plan-drafts';
import { makeTestRouteContext } from './test-route-context';

// Who pays for a draft (docs/specs/030-forms/describe-a-form.md "Limits and cost"; liveworkspace 019 "Who pays for an
// item"): Describe a Form on a tab of an existing plan spends the PLAN's owner's AI credit (its team's for a team's
// plan), as every other use of an item does, and only for an Editor of it; a draft that is nobody's plan yet spends
// the signed-in person's own. And when the subscription service refuses this Worker's request, nothing is drafted
// uncounted and nobody is told their credits are used. The index's grant, the service and Workers AI are stand-ins.
vi.mock('../server-telemetry', () => ({ reportServerEvent: async () => {} }));

const grants = new Map<string, PlanGrant | null | Response>();
vi.mock('./plan-grant', () => ({
  resolvePlanGrant: async (_ctx: unknown, planId: string) => grants.get(planId) ?? null,
}));

const FORM = {
  outcome: 'form',
  form: {
    heading: 'Summer Party RSVP',
    respondsTo: 'sheet',
    sections: [{ questions: [{ type: 'short', prompt: 'Your name', required: true }] }],
  },
};
const PLAN = {
  outcome: 'plan',
  plan: {
    title: 'Hiring',
    columns: ['Applied', 'Offer'],
    cardTypes: [{ name: 'Candidate', glyph: 'person', builtInFields: [], fields: [] }],
  },
};

let asked: number;
let env: Env;
// Every spend the service took, and the status it answers with (200 spends; anything else refuses).
let spends: { owner: string; meter: string; amount: number }[];
let status: number;
// The month is used: the service answers a spend at the limit.
let full: boolean;
let serial = 0;

beforeEach(() => {
  asked = 0;
  spends = [];
  status = 200;
  full = false;
  grants.clear();
  const counts = new Map<string, Map<string, unknown>>();
  const run: AutomationsAi['run'] = (_model, inputs) => {
    asked += 1;
    const system = JSON.stringify(inputs);
    return Promise.resolve({ response: system.includes('form') ? FORM : PLAN });
  };
  env = {
    AI: { run },
    PLAN_ROOM: {
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
        };
      },
    },
    PRO_ENABLED: 'true',
    SUBSCRIPTION_KEY: 'key',
    // Its own address, so one test's view of the service is never another's.
    SUBSCRIPTION_URL: `https://sub-${++serial}.test/api/subscription`,
    SUBSCRIPTION: {
      fetch: async (_input: string, init?: RequestInit) => {
        if (status !== 200) return Response.json({ error: 'unauthorised' }, { status });
        if (full) return Response.json({ ok: false, used: 50, limit: 50, tier: 'free' });
        const body = JSON.parse(init?.body as string) as (typeof spends)[number];
        spends.push({ owner: body.owner, meter: body.meter, amount: body.amount });
        return Response.json({ ok: true, used: spends.length, limit: 1000, tier: 'team' });
      },
    },
  } as unknown as Env;
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const grant = (over: Partial<PlanGrant>): PlanGrant =>
  ({
    item: 'plan-1',
    level: 'edit',
    tab: null,
    team: null,
    owner: 'user_owner',
    ...over,
  }) as PlanGrant;

const formDraft = (body: Record<string, unknown> = {}, account = 'user_a') =>
  handleFormDrafts(
    makeTestRouteContext('POST', '/api/form-drafts', {
      owner: account,
      accountUserId: account,
      body: { prompt: 'An RSVP form for the summer party', ...body },
      env,
    }),
  );

describe('Describe a Form on a tab of an existing plan', () => {
  it('tells the plan’s owner and its team their month’s figures, and anyone else only that it is used', async () => {
    full = true;
    const used = async (account: string, teams: string[] = []) => {
      const res = await handleFormDrafts(
        makeTestRouteContext('POST', '/api/form-drafts', {
          owner: account,
          accountUserId: account,
          teams: teams.map((id) => ({ id, role: 'member' })),
          body: { prompt: 'An RSVP form for the summer party', projectId: 'plan-1' },
          env,
        } as Parameters<typeof makeTestRouteContext>[2]),
      );
      expect(res.status).toBe(429);
      return res.json<FormDraftErrorBody>();
    };
    grants.set('plan-1', grant({ owner: 'user_owner' }));
    expect(await used('user_owner')).toMatchObject({
      limit: 'aiCreditsPerMonth',
      used: 50,
      max: 50,
    });
    const other = await used('user_a');
    expect(other).toMatchObject({ error: 'form_draft_credits_used', limit: 'aiCreditsPerMonth' });
    expect(other).not.toHaveProperty('used');
    expect(other).not.toHaveProperty('max');
    grants.set('plan-1', grant({ team: 'team_garden' }));
    expect(await used('user_a', ['team_garden'])).toMatchObject({ used: 50, max: 50 });
    expect(await used('user_b', ['team_other'])).not.toHaveProperty('used');
  });

  it('spends the team’s AI credit for a team’s plan, never the person’s who asked', async () => {
    grants.set('plan-1', grant({ team: 'team_garden' }));
    expect((await formDraft({ projectId: 'plan-1' })).status).toBe(200);
    expect(spends).toEqual([{ owner: 't:team_garden', meter: 'aiCredits', amount: 1 }]);
    expect(asked).toBe(1);
  });

  it('spends the plan’s owner’s for a person’s plan someone else edits', async () => {
    grants.set('plan-1', grant({ owner: 'user_owner' }));
    expect((await formDraft({ projectId: 'plan-1' })).status).toBe(200);
    expect(spends).toEqual([{ owner: 'p:user_owner', meter: 'aiCredits', amount: 1 }]);
  });

  it('spends the person’s own with no plan at all, and nobody’s for a guest’s plan (the day’s cap alone holds it)', async () => {
    grants.set('plan-1', grant({ owner: 'guest_1' }));
    expect((await formDraft({ projectId: 'plan-1' })).status).toBe(200);
    expect(spends).toEqual([]);
    expect((await formDraft()).status).toBe(200);
    expect(spends.map((spend) => spend.owner)).toEqual(['p:user_a']);
  });

  it('is only for an Editor of that plan: nobody spends another owner’s credits by naming their plan', async () => {
    for (const held of [
      null,
      grant({ team: 'team_garden', level: 'view' }),
      grant({ team: 'team_garden', level: 'participate' }),
      grant({ team: 'team_garden', trashed: true }),
    ]) {
      grants.set('plan-1', held);
      const refused = await formDraft({ projectId: 'plan-1' });
      expect(refused.status).toBe(403);
      expect((await refused.json<FormDraftErrorBody>()).path).toBe('projectId');
    }
    for (const projectId of ['', 7, 'x'.repeat(201)]) {
      expect((await formDraft({ projectId })).status).toBe(400);
    }
    // The index's own refusal is passed on as it is.
    grants.set('plan-1', new Response(null, { status: 401 }));
    expect((await formDraft({ projectId: 'plan-1' })).status).toBe(401);
    expect(spends).toEqual([]);
    expect(asked).toBe(0);
  });
});

describe('a draft when the subscription service refuses this Worker', () => {
  it('drafts nothing uncounted, and says it is unavailable, never that credits are used', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    status = 401;
    const form = await formDraft();
    expect(form.status).toBe(503);
    expect(await form.json<FormDraftErrorBody>()).toEqual({
      error: 'form_draft_unavailable',
      message: PLAN_DRAFT_FAILED,
    });
    const plan = await handlePlanDrafts(
      makeTestRouteContext('POST', '/api/plan-drafts', {
        owner: 'user_a',
        accountUserId: 'user_a',
        body: { prompt: 'A hiring pipeline with Applied and Offer' },
        env,
      }),
    );
    expect(plan.status).toBe(503);
    expect((await plan.json<PlanDraftErrorBody>()).error).toBe('plan_draft_unavailable');
    expect(asked).toBe(0);
  });
});
