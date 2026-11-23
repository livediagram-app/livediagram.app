// Public Knowledgebases (docs/specs/030-knowledgebase/publishing.md "Tiers"; blueprint publishing.md P28 to P32): with
// Pro on, the knowledgebases an OWNER has published at once, counted by the subscription service's gauge over all of
// theirs and limited by their tier; with Pro off, as many as they like.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishingState, PublishLimitBody } from '@liveknowledge/api-schema';
import { ItemTier, type Tier } from '@liveworkspace/subscription';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { fakeSubscription, proEnv, type FakeSubscription } from '../knowledge/tier-test-kit';
import { knowledgeKit, OWNER, type Kit } from '../routes/knowledge-test-kit';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDocuments } from '../routes/documents';
import { subscriptionOf } from '../subscription';
import { handlePublicSite } from './public-site';
import { leaveSiteGauge, moveSiteGauge, syncSiteGauge } from './published-gauge';

vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
let failWrite = false;
vi.mock('./published-snapshot', async (original) => {
  const real = await original<typeof import('./published-snapshot')>();
  return {
    ...real,
    writeSite: async (...args: Parameters<typeof real.writeSite>) => {
      if (failWrite) throw new Error('the write failed');
      return real.writeSite(...args);
    },
  };
});

const PUBLISHING = '/api/documents/kb/publishing';
const ME = `p:${OWNER}`;
const GAUGE = 'publicKnowledgebases';
let kit: Kit;
let fake: FakeSubscription;

const body = (over: object = {}) => ({
  address: 'handbook',
  root: null,
  noindex: false,
  showWriters: false,
  ...over,
});
const publish = (over: object = {}) => kit.call('editor', 'PUT', PUBLISHING, body(over));
const state = async (query = '') =>
  (await kit.call('editor', 'GET', `${PUBLISHING}${query}`)).json<PublishingState>();
const counted = (owner = ME) => [...(fake.gauges.get(`${owner}:${GAUGE}`) ?? [])].sort();
const hold = (...keys: string[]) => fake.gauges.set(`${ME}:${GAUGE}`, new Set(keys));
const front = async () =>
  (
    await handlePublicSite(
      new Request('https://www.liveknowledge.app/kb/handbook'),
      kit.db.env,
      () => {},
    )
  ).status;
const mark = () =>
  (
    kit.db.sql.prepare('SELECT counted FROM published_site WHERE id = 1').get() as
      { counted: number | null } | undefined
  )?.counted;
// As if the site was published before Pro: never counted.
const uncount = () => kit.db.sql.exec('UPDATE published_site SET counted = NULL');
const gaugeCalls = () => fake.to('gauge').length;

// A world with the kit's knowledgebase; `tiers` turns Pro on.
async function world(tiers?: Record<string, Tier>, env: object = {}) {
  fake = fakeSubscription(tiers ?? {});
  kit = await knowledgeKit(env);
  if (tiers) proEnv(kit.db.env, fake);
}

// The knowledgebase made someone else's (a guest's, or nobody's), published by an Editor through a link.
function ownedBy(owner: string) {
  kit.db.sql.exec(`UPDATE document SET owner_id = '${owner}'`);
  kit.db.sql.exec(
    "INSERT INTO test_share_links (code, document_id, role, tab_id, created_at) VALUES ('EDIT', 'kb', 'edit', NULL, 1)",
  );
  return (method: string, payload?: unknown) =>
    handleDocuments(
      makeTestRouteContext(method, PUBLISHING, {
        env: kit.db.env,
        owner: 'user_e',
        accountUserId: 'user_e',
        verifiedUserId: 'user_e',
        body: payload,
        headers: { 'X-Share-Code': 'EDIT' },
      }),
    );
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  failWrite = false;
  vi.restoreAllMocks();
});

describe('with Pro off', () => {
  it('publishes, says nothing of a limit and asks nothing', async () => {
    await world();
    expect((await publish()).status).toBe(200);
    const read = await state();
    expect(read.published).toBe(true);
    expect(read.usage).toBeUndefined();
    expect(read.owner).toBeUndefined();
    // A site from before is never in question with Pro off.
    kit.db.sql.exec('UPDATE published_site SET counted = 0');
    expect(await front()).toBe(200);
    expect((await kit.call('editor', 'DELETE', PUBLISHING)).status).toBe(200);
    expect((await kit.call('editor', 'DELETE', PUBLISHING)).status).toBe(200);
    expect(fake.calls).toEqual([]);
  });
});

describe('the owner’s public knowledgebases', () => {
  it('refuses a publish past Free’s 1 with the limit, and publishes nothing', async () => {
    await world({});
    hold('other-kb');
    const over = await publish();
    expect(over.status).toBe(409);
    expect(await over.json<PublishLimitBody>()).toEqual({
      error: 'publish_limit_reached',
      message: expect.any(String),
      limit: 'publicKnowledgebases',
      used: 1,
      max: 1,
    });
    expect(await state()).toMatchObject({ published: false, usage: { limit: 1 }, owner: ME });
    expect((await state('?root=deploys')).published).toBe(false);
    expect(mark()).toBeUndefined();
    expect(await front()).toBe(404);
    // Unpublishing what is not published gives back nothing it held.
    expect((await kit.call('editor', 'DELETE', PUBLISHING)).status).toBe(200);
    expect(counted()).toEqual(['other-kb']);
  });

  it('counts the first, never a change to it, and gives the place back on Unpublish', async () => {
    await world({});
    const first = await (await publish()).json<PublishingState>();
    expect(first).toMatchObject({ published: true, usage: { used: 1, limit: 1 }, owner: ME });
    expect(counted()).toEqual(['kb']);
    expect(mark()).toBe(1);
    const adds = gaugeCalls();
    expect((await publish({ noindex: true })).status).toBe(200);
    expect(gaugeCalls()).toBe(adds);
    // A preview of a section asks nothing; the dialog's first read counts again.
    expect((await state('?root=deploys')).usage).toEqual({ limit: 1 });
    expect(gaugeCalls()).toBe(adds);
    expect((await state()).usage).toEqual({ used: 1, limit: 1 });
    const down = await (await kit.call('editor', 'DELETE', PUBLISHING)).json<PublishingState>();
    expect(down).toMatchObject({ published: false, usage: { limit: 1 }, owner: ME });
    expect(counted()).toEqual([]);
  });

  it('publishes up to 10 on Pro and any number for a team on Pro for Teams', async () => {
    await world({ [ME]: 'pro', 't:team_1': 'team' });
    hold('a', 'b', 'c');
    expect(await (await publish()).json<PublishingState>()).toMatchObject({
      usage: { used: 4, limit: 10 },
    });
    kit.db.sql.exec("UPDATE document SET team_id = 'team_1'");
    expect(await state()).toMatchObject({ usage: { used: 1, limit: null }, owner: 't:team_1' });
  });

  it('keeps a site from before answering until its first count, then holds it to the limit', async () => {
    await world({});
    await publish();
    uncount();
    hold('other-kb');
    // Never counted: it answers.
    expect(await front()).toBe(200);
    // Its first count finds the owner full: it holds no place and comes down, its snapshot kept.
    expect(await state()).toMatchObject({
      published: false,
      site: null,
      defaultAddress: 'handbook',
    });
    expect(mark()).toBe(0);
    expect(await front()).toBe(404);
    expect((await state('?root=deploys')).published).toBe(false);
    // Publish asks for its place again, refused while the owner is full.
    expect((await publish()).status).toBe(409);
    // Room again: the next count takes it back, on the same address.
    hold();
    expect(await state()).toMatchObject({ published: true, usage: { used: 1, limit: 1 } });
    expect(mark()).toBe(1);
    expect(await front()).toBe(200);
  });

  it('takes a refused site back with Publish once the owner has room', async () => {
    await world({});
    await publish();
    kit.db.sql.exec('UPDATE published_site SET counted = 0');
    hold();
    expect(await (await publish()).json<PublishingState>()).toMatchObject({ published: true });
    expect(mark()).toBe(1);
    expect(counted()).toEqual(['kb']);
  });

  it('publishes uncounted while the service is out of reach, and counts it later', async () => {
    await world({}, { SUBSCRIPTION_URL: 'https://down.test' });
    const reach = fake.fetcher.fetch;
    fake.fetcher.fetch = async () => {
      throw new Error('down');
    };
    const res = await (await publish()).json<PublishingState>();
    expect(res).toMatchObject({ published: true, usage: { limit: 1 }, owner: ME });
    expect(res.usage!.used).toBeUndefined();
    expect(mark()).toBeNull();
    fake.fetcher.fetch = reach;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60_000);
    expect((await state()).usage).toEqual({ used: 1, limit: 1 });
    expect(mark()).toBe(1);
  });

  it('fails as the api’s own fault when the service refuses its request, and publishes nothing', async () => {
    await world({});
    const reach = fake.fetcher.fetch;
    fake.fetcher.fetch = async (input, init) =>
      new URL(input).pathname.endsWith('/gauge')
        ? new Response('no', { status: 401 })
        : reach(input, init);
    await expect(publish()).rejects.toThrow('refused the publish claim');
    expect(mark()).toBeUndefined();
    // The dialog's read leaves the mark alone.
    fake.fetcher.fetch = reach;
    await publish();
    uncount();
    fake.fetcher.fetch = async (input, init) =>
      new URL(input).pathname.endsWith('/gauge')
        ? new Response('no', { status: 401 })
        : reach(input, init);
    expect((await state()).published).toBe(true);
    expect(mark()).toBeNull();
  });

  it('gives the place back when the publish fails after it was claimed', async () => {
    await world({});
    failWrite = true;
    await expect(publish()).rejects.toThrow('the write failed');
    expect(counted()).toEqual([]);
    // With Pro off nothing was claimed, so nothing is given back.
    await world();
    await expect(publish()).rejects.toThrow('the write failed');
    expect(fake.calls).toEqual([]);
  });
});

describe('a knowledgebase with no account behind it', () => {
  it('holds a guest’s to Free’s 1 in itself, naming no owner and asking the service nothing', async () => {
    await world({});
    const as = ownedBy('guest_9');
    const res = await as('PUT', body());
    expect(await res.json()).toMatchObject({
      published: true,
      usage: { used: 1, limit: 1 },
      guest: true,
    });
    expect((await (await as('GET')).json<PublishingState>()).owner).toBeUndefined();
    expect(await (await as('DELETE')).json()).toMatchObject({ usage: { used: 0, limit: 1 } });
    expect(fake.to('gauge')).toEqual([]);
  });

  it('counts nothing for one that is nobody’s', async () => {
    await world({});
    const as = ownedBy('');
    const res = await (await as('PUT', body())).json<PublishingState>();
    expect(res.published).toBe(true);
    expect(res.usage).toBeUndefined();
    expect(fake.to('gauge')).toEqual([]);
  });
});

describe('the room’s own paths', () => {
  const roomTier = (head: { ownerId: string; teamId: string | null }) =>
    new ItemTier({
      client: () => subscriptionOf(kit.db.env),
      head: () => ({ ...head, name: 'Handbook' }),
      defer: () => {},
    });
  const sql = () => nodeItemSql(kit.db.sql);

  it('counts the site in the daily upkeep, gives it back on purge, and asks nothing with Pro off', async () => {
    await world({});
    await publish();
    uncount();
    fake.gauges.clear();
    const tier = roomTier({ ownerId: OWNER, teamId: null });
    await syncSiteGauge(kit.db.env, tier, 'kb');
    expect(counted()).toEqual(['kb']);
    expect(mark()).toBe(1);
    await leaveSiteGauge(tier, sql(), 'kb');
    expect(counted()).toEqual([]);

    const off = { on: false } as ItemTier;
    await syncSiteGauge(kit.db.env, off, 'kb');
    await leaveSiteGauge(off, sql(), 'kb');
    await moveSiteGauge(off, sql(), 'kb', ME);
    kit.db.sql.exec('DELETE FROM published_site');
    await leaveSiteGauge(tier, sql(), 'kb');
    await moveSiteGauge(tier, sql(), 'kb', ME);
    expect(counted()).toEqual([]);
  });

  it('moves the place to the new owner, holding none there past their limit', async () => {
    await world({});
    await publish();
    expect(counted()).toEqual(['kb']);
    // To a team with room: off the person's count, onto the team's.
    await moveSiteGauge(roomTier({ ownerId: OWNER, teamId: 'team_1' }), sql(), 'kb', ME);
    expect(counted()).toEqual([]);
    expect(counted('t:team_1')).toEqual(['kb']);
    // To a team that is full: it holds no place there.
    fake.gauges.set(`t:team_2:${GAUGE}`, new Set(['other']));
    await moveSiteGauge(roomTier({ ownerId: OWNER, teamId: 'team_2' }), sql(), 'kb', 't:team_1');
    expect(counted('t:team_1')).toEqual([]);
    expect(mark()).toBe(0);
    // One holding no place stays as it was on the next move; from a guest, nothing is given back.
    await moveSiteGauge(roomTier({ ownerId: OWNER, teamId: null }), sql(), 'kb', null);
    expect(counted()).toEqual([]);
    expect(mark()).toBe(0);
  });

  it('logs and carries on when the count fails', async () => {
    await world({});
    await publish();
    const broken = {
      on: true,
      fresh: () => false,
      refresh: async () => {
        throw new Error('no');
      },
    } as unknown as ItemTier;
    await syncSiteGauge(kit.db.env, broken, 'kb');
    await leaveSiteGauge(broken, sql(), 'kb');
    await moveSiteGauge(broken, sql(), 'kb', null);
    expect(console.warn).toHaveBeenCalledTimes(3);
  });
});
