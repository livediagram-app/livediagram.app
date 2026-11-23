// A canvas's snapshots with Pro on (liveworkspace/docs/specs/014-snapshots/snapshots.md "With Pro on"): the canvas's
// owner's tier, from the index's grant, sets what is kept; the caller's own tier never does; Pro off asks nothing.
import { describe, expect, it } from 'vitest';
import { limitsFor, type OwnerScope, type Tier } from '@liveworkspace/subscription';
import type { SnapshotListResponse } from '@liveworkspace/snapshots';
import { upsertTab } from '../db/tabs';
import type { ItemGrant } from '../index-service';
import { makeTestRouteContext } from '../routes/test-route-context';
import { sqliteD1, testDocument } from '../test-sqlite-d1';
import type { DocumentEnv } from '../types';
import { serveDocumentSnapshots } from './document-snapshots';

// Each test's own owners: the entitlement cache is the isolate's.
let serial = 0;
const account = () => `user_snapdoor${++serial}`;

async function arrange(pro: boolean, tiers: Record<string, Tier> = {}) {
  const db = sqliteD1({});
  const asked: string[] = [];
  const env = {
    ...db.env,
    PRO_ENABLED: pro ? 'true' : 'false',
    SUBSCRIPTION_KEY: 'k',
    SUBSCRIPTION: {
      fetch: async (_input: string, init?: RequestInit) => {
        const { owner } = JSON.parse(init?.body as string) as { owner: OwnerScope };
        asked.push(owner);
        const tier = tiers[owner] ?? 'free';
        return Response.json({ owner, tier, seats: 3, limits: limitsFor(tier, 3) });
      },
    },
  } as DocumentEnv;
  testDocument(db, 'A', 'user_ada', { name: 'Plan' });
  await upsertTab(env, 'A', { id: 't1', name: 'One', elements: [] }, 0);
  const list = async (grant: Partial<ItemGrant>, caller = 'user_ada') => {
    const ctx = makeTestRouteContext('GET', '/api/documents/A/snapshots', {
      owner: caller,
      accountUserId: caller,
      env,
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
    const res = await serveDocumentSnapshots(ctx, async () => new Response('handled'));
    return res.json<SnapshotListResponse>();
  };
  return { list, asked };
}

describe('canvas snapshots with Pro', () => {
  it('asks nothing with Pro off and answers the list as it always did', async () => {
    const { list, asked } = await arrange(false);
    expect(await list({ owner: account() })).toEqual({ snapshots: [], kept: 5 });
    expect(asked).toEqual([]);
  });

  it('keeps five for 7 days on a Free owner’s canvas, whoever asks', async () => {
    const owner = account();
    const editor = account();
    // The Editor asking is on Pro; the canvas is not theirs.
    const { list, asked } = await arrange(true, { [`p:${editor}`]: 'pro' });
    expect(await list({ owner }, editor)).toEqual({
      snapshots: [],
      kept: 5,
      retention: { days: 7, owner: `p:${owner}` },
    });
    expect(asked).toEqual([`p:${owner}`]);
  });

  it('keeps fifty with no age limit on a Pro for Teams team’s canvas', async () => {
    const team = `team_snapdoor${++serial}`;
    const { list } = await arrange(true, { [`t:${team}`]: 'team' });
    expect(await list({ owner: account(), team })).toEqual({
      snapshots: [],
      kept: 50,
      retention: { days: null, owner: `t:${team}` },
    });
  });

  it('names no tier, and drops nothing, for a grant that names no owner', async () => {
    const { list, asked } = await arrange(true);
    // Five, as on Free: not knowing the tier never gives a diagram more than Free keeps (it kept fifty).
    expect(await list({})).toEqual({ snapshots: [], kept: 5 });
    expect(asked).toEqual([]);
  });
});
