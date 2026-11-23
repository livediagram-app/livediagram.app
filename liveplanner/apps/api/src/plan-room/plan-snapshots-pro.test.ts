// A plan's snapshots with Pro on (liveworkspace/docs/specs/014-snapshots/snapshots.md "With Pro on";
// docs/specs/013-workspace/snapshots.md): the plan's owner's tier, from the index's grant, sets what is kept; the
// caller's own tier never does; an owner or a tier that is not known prunes nothing; Pro off asks nothing.
import { describe, expect, it } from 'vitest';
import { limitsFor, type OwnerScope, type Tier } from '@liveworkspace/subscription';
import type { SnapshotListResponse } from '@liveworkspace/snapshots';
import { upsertTab } from '../db/tabs';
import type { PlanGrant } from '../index-service';
import { makeTestRouteContext } from '../routes/test-route-context';
import { sqliteD1 } from '../test-sqlite-d1';
import type { PlanEnv } from '../types';
import { servePlanSnapshots } from './plan-snapshots';

// Each test's own owners: the entitlement cache is the isolate's.
let serial = 0;
const account = () => `user_plansnap${++serial}`;

async function arrange(pro: boolean, tiers: Record<string, Tier> = {}, down = false) {
  const db = sqliteD1({});
  const asked: string[] = [];
  const env = {
    ...db.env,
    PRO_ENABLED: pro ? 'true' : 'false',
    SUBSCRIPTION_KEY: 'k',
    // Its own address when out of reach: the client leaves a service that failed alone for a moment, by address.
    ...(down ? { SUBSCRIPTION_URL: 'https://subscription-down.test/api' } : {}),
    SUBSCRIPTION: {
      fetch: async (_input: string, init?: RequestInit) => {
        const { owner } = JSON.parse(init?.body as string) as { owner: OwnerScope };
        asked.push(owner);
        if (down) return new Response('down', { status: 503 });
        const tier = tiers[owner] ?? 'free';
        return Response.json({ owner, tier, seats: 3, limits: limitsFor(tier, 3) });
      },
    },
  } as PlanEnv;
  db.sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('A', 'user_ada', 'Roadmap', 0, 1, 1)`,
  );
  await upsertTab(env, 'A', { id: 't1', name: 'One', elements: [] }, 0);
  const send = (
    method: string,
    path: string,
    grant: Partial<PlanGrant>,
    caller = 'user_ada',
    body?: unknown,
  ) => {
    const ctx = makeTestRouteContext(method, `/api/projects/A/snapshots${path}`, {
      owner: caller,
      accountUserId: caller,
      env,
      body,
      grant: {
        item: 'A',
        level: 'edit',
        tab: null,
        sub: caller,
        team: null,
        exp: 9_999_999_999,
        shareCode: null,
        token: 'signed',
        ...grant,
      },
      token: null,
    });
    return servePlanSnapshots(ctx, async () => new Response('handled'));
  };
  const list = async (grant: Partial<PlanGrant>, caller?: string) =>
    (await send('GET', '', grant, caller)).json<SnapshotListResponse>();
  return { send, list, asked };
}

describe('plan snapshots with Pro', () => {
  it('asks nothing with Pro off and answers the list as it always did', async () => {
    const { list, asked } = await arrange(false);
    expect(await list({ owner: account() })).toEqual({ snapshots: [], kept: 5 });
    expect(asked).toEqual([]);
  });

  it('keeps five for 7 days on a Free owner’s plan, whoever asks', async () => {
    const owner = account();
    const editor = account();
    // The Editor asking is on Pro; the plan is not theirs.
    const { list, asked } = await arrange(true, { [`p:${editor}`]: 'pro' });
    expect(await list({ owner }, editor)).toEqual({
      snapshots: [],
      kept: 5,
      retention: { days: 7, owner: `p:${owner}` },
    });
    expect(asked).toEqual([`p:${owner}`]);
  });

  it('keeps fifty with no age limit on a Pro owner’s plan', async () => {
    const owner = account();
    const { list } = await arrange(true, { [`p:${owner}`]: 'pro' });
    expect(await list({ owner })).toEqual({
      snapshots: [],
      kept: 50,
      retention: { days: null, owner: `p:${owner}` },
    });
  });

  it('keeps fifty on a Pro for Teams team’s plan, whoever asks: the team’s tier, not the member’s', async () => {
    const team = `team_plansnap${++serial}`;
    const member = account();
    const { list, asked } = await arrange(true, { [`t:${team}`]: 'team' });
    expect(await list({ owner: account(), team }, member)).toEqual({
      snapshots: [],
      kept: 50,
      retention: { days: null, owner: `t:${team}` },
    });
    expect(asked).toEqual([`t:${team}`]);
  });

  it('never reads a tier the request claims', async () => {
    const owner = account();
    const { send, asked } = await arrange(true);
    const ctx = await send('GET', '?tier=pro', { owner });
    expect(await ctx.json()).toMatchObject({ kept: 5, retention: { days: 7 } });
    expect(asked).toEqual([`p:${owner}`]);
  });

  it('names no tier, and drops nothing, for a grant that names no owner or a service out of reach', async () => {
    const unnamed = await arrange(true);
    // Five, as on Free: not knowing the tier never gives a plan more than Free keeps (it kept fifty).
    expect(await unnamed.list({})).toEqual({ snapshots: [], kept: 5 });
    expect(unnamed.asked).toEqual([]);
    const out = await arrange(true, {}, true);
    expect(await out.list({ owner: account() })).toEqual({ snapshots: [], kept: 5 });
  });

  it('drops the sixth on Free and keeps it on Pro', async () => {
    for (const [tier, kept] of [
      ['free', 5],
      ['pro', 6],
    ] as const) {
      const owner = account();
      const { send, list } = await arrange(true, { [`p:${owner}`]: tier });
      for (let n = 0; n < 6; n += 1) {
        const taken = await send('POST', '', { owner }, 'user_ada', { name: `n${n}` });
        expect(taken.status).toBeLessThan(300);
      }
      expect((await list({ owner })).snapshots).toHaveLength(kept);
    }
  });
});
