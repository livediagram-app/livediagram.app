import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoadmapErrorBody, RoadmapResponse, RoadmapsResponse } from '@liveplanner/api-schema';
import { presetSetup } from '@liveplanner/items';
import { identityOf } from '../plan-room/automations/test-automation-world';
import { endRepeatWorld, OWNER } from '../plan-room/test-repeat-world';
import { fakeSubscription, setPlanOwner, type FakeSubscription } from '../plan-room/tier/test-tier';
import { roadmapsOf } from '../roadmap/roadmap-store';
import { roadmapWorld, settingsOf, type RoadmapWorld } from './roadmap-test-world';

// Public roadmaps an owner may hold (docs/specs/026-plan/public-roadmap.md "Tiers"): with Pro on, the plan's OWNER's
// tier's, counted by the subscription service's gauge over all their plans; with Pro off, as many as they like.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

const ME = `p:${OWNER}`;
let w: RoadmapWorld;
let fake: FakeSubscription;

const board = (id: string) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 800,
  height: 500,
  planBoard: presetSetup('kanban'),
});
// Tab t1 holding these boards.
const boards = async (...ids: string[]) => {
  const put = await w.send('PUT', '/api/projects/A/tabs/t1', {
    id: 't1',
    name: 'Board',
    kind: 'board',
    elements: ids.map(board),
  });
  expect(put.status).toBeLessThan(300);
};
// A world whose tab holds two boards; `tiers` turns Pro on.
const world = async (tiers?: Parameters<typeof fakeSubscription>[0]) => {
  fake = fakeSubscription(tiers ?? {});
  w = await roadmapWorld(tiers ? { pro: fake } : {});
  if (!tiers) Object.assign(w.planEnv(), { SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
  await boards('b1', 'b2');
};
const publish = (boardId: string, body: Record<string, unknown> = settingsOf()) =>
  w.as('owner', 'PUT', `/roadmaps/${boardId}`, body);
const list = async () => (await w.as('owner', 'GET', '/roadmaps')).json<RoadmapsResponse>();
const counted = (owner = ME) => [...(fake.gauges.get(`${owner}:publicRoadmaps`) ?? [])].sort();
const plan = () => w.plans.get('A')!;
const read = (code: string) => w.raw(new Request(`https://api.test/api/roadmaps/A/${code}`));
// As if every roadmap was published before Pro: no row was ever counted.
const uncount = () => plan().db.prepare('UPDATE roadmaps SET counted = NULL').run();

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

describe('with Pro off', () => {
  it('publishes as many as there are boards, says nothing of a limit and asks nothing', async () => {
    await world();
    expect((await publish('b1')).status).toBe(201);
    expect((await publish('b2')).status).toBe(201);
    const listed = await list();
    expect(listed.roadmaps).toHaveLength(2);
    expect(listed.usage).toBeUndefined();
    expect(listed.owner).toBeUndefined();
    await w.as('owner', 'DELETE', '/roadmaps/b1');
    expect(fake.calls).toEqual([]);
  });
});

describe('the owner’s roadmaps', () => {
  it('refuses the publish past Free’s 1 with the limit, and never a settings change', async () => {
    await world({});
    expect((await publish('b1')).status).toBe(201);
    const over = await publish('b2');
    expect(over.status).toBe(409);
    expect(await over.json<RoadmapErrorBody>()).toEqual({
      error: 'roadmap_limit_reached',
      limit: 'publicRoadmaps',
      used: 1,
      max: 1,
    });
    expect(await roadmapsOf(w.planEnv(), 'A')).toHaveLength(1);
    // Changing the published one's settings counts nothing and is never refused.
    const adds = fake.to('gauge').length;
    expect((await publish('b1', settingsOf({ title: 'Renamed' }))).status).toBe(200);
    expect(fake.to('gauge')).toHaveLength(adds);
    expect(await list()).toMatchObject({ usage: { used: 1, limit: 1 }, owner: ME });
  });

  it('gives the place back on Unpublish', async () => {
    await world({});
    await publish('b1');
    expect(counted()).toEqual(['A:b1']);
    await w.as('owner', 'DELETE', '/roadmaps/b1');
    expect(counted()).toEqual([]);
    expect((await publish('b2')).status).toBe(201);
    expect((await list()).usage).toEqual({ used: 1, limit: 1 });
  });

  it('allows more on Pro, and none are limited for a team on Pro for Teams', async () => {
    await world({ [ME]: 'pro', 't:team_1': 'team' });
    expect((await publish('b1')).status).toBe(201);
    expect((await publish('b2')).status).toBe(201);
    expect((await list()).usage).toEqual({ used: 2, limit: 10 });
    setPlanOwner(plan().db, 'A', OWNER, 'team_1');
    expect(await list()).toMatchObject({ usage: { limit: null }, owner: 't:team_1' });
  });

  it('holds a Free team’s plan to Free though its owner and the person publishing have Pro', async () => {
    await world({ [ME]: 'pro', 'p:user_2abcdefghijklmnopqrstuvwxyz1': 'pro' });
    setPlanOwner(plan().db, 'A', OWNER, 'team_1');
    expect((await w.as('team', 'PUT', '/roadmaps/b1', settingsOf())).status).toBe(201);
    const over = await w.as('team', 'PUT', '/roadmaps/b2', settingsOf());
    expect(over.status).toBe(409);
    expect(counted('t:team_1')).toEqual(['A:b1']);
    expect(counted()).toEqual([]);
  });

  it('ignores a tier a request claims in its body or headers', async () => {
    await world({});
    await publish('b1');
    const claimed = await publish('b2', {
      ...settingsOf(),
      tier: 'pro',
      limit: 99,
      owner: 'p:user_ada',
    });
    expect(claimed.status).toBe(409);
    const headed = await plan().room.route(
      'A',
      new Request('https://api.test/api/projects/A/roadmaps/b2', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tier': 'team',
          'X-Owner-Scope': 'p:user_ada',
        },
        body: JSON.stringify(settingsOf()),
      }),
      identityOf('A', 'owner'),
    );
    expect(headed.status).toBe(409);
  });

  it('counts the roadmaps a plan had before, oldest first: within the limit none comes down, past it the oldest stay', async () => {
    await world({ [ME]: 'pro' });
    const first = (await (await publish('b1')).json<RoadmapResponse>()).roadmap.code;
    const second = (await (await publish('b2')).json<RoadmapResponse>()).roadmap.code;
    // As if published before Pro: never counted, the service holds none of them, and the owner is Free.
    uncount();
    fake.gauges.clear();
    fake.set(ME, 'free');
    plan().restart();
    // Until the first count, both answer as they always did.
    expect((await read(first)).status).toBe(200);
    expect((await read(second)).status).toBe(200);
    const listed = await list();
    // The oldest keeps the one place; the other holds none, so it is not published as anyone sees it.
    expect(listed.roadmaps.map((r) => r.boardId)).toEqual(['b1']);
    expect(counted()).toEqual(['A:b1']);
    expect(listed.usage).toEqual({ used: 1, limit: 1 });
    expect((await read(first)).status).toBe(200);
    expect((await read(second)).status).toBe(404);
    // Its row and its link are kept: nothing is deleted, and it answers again once it holds a place.
    expect(await roadmapsOf(w.planEnv(), 'A')).toHaveLength(2);
    fake.set(ME, 'pro');
    expect((await list()).roadmaps.map((r) => r.boardId).sort()).toEqual(['b1', 'b2']);
    expect((await read(second)).status).toBe(200);
    fake.set(ME, 'free');
    // Over the limit, another is still refused.
    await boards('b1', 'b2', 'b3');
    expect((await publish('b3')).status).toBe(409);
  });

  it('tells the service of each roadmap once a minute at most, however often the list is read', async () => {
    await world({ [ME]: 'pro' });
    await publish('b1');
    const told = fake.to('gauge').length;
    for (let i = 0; i < 5; i += 1) await list();
    expect(fake.to('gauge')).toHaveLength(told);
  });

  it('gives back the place of a board that has gone, and of a deleted tab’s', async () => {
    await world({ [ME]: 'pro' });
    await publish('b1');
    await publish('b2');
    await boards('b2');
    await list();
    expect(counted()).toEqual(['A:b2']);
    expect((await w.send('DELETE', '/api/projects/A/tabs/t1')).status).toBe(204);
    expect(counted()).toEqual([]);
  });

  it('syncs on the plan’s daily upkeep, so a board deleted from the canvas gives its place back', async () => {
    await world({ [ME]: 'pro' });
    await publish('b1');
    await boards('b2');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 61_000);
    const { maintain } = await import('../plan-room/plan-room-content');
    await maintain(plan().room, Date.now());
    expect(counted()).toEqual([]);
  });

  it('gives every place back when the plan is purged', async () => {
    await world({ [ME]: 'pro' });
    await publish('b1');
    await publish('b2');
    await plan().room.purge('A');
    expect(counted()).toEqual([]);
  });

  it('moves the places to the new owner when the plan moves: the oldest take what the new owner has', async () => {
    await world({ [ME]: 'pro' });
    const first = (await (await publish('b1')).json<RoadmapResponse>()).roadmap.code;
    const second = (await (await publish('b2')).json<RoadmapResponse>()).roadmap.code;
    // The new owner is Free: one holds a place and answers; the other holds none, its row and link kept.
    await plan().room.takeHead({ owner: 'user_ada', team: null });
    await vi.waitFor(() => expect(counted('p:user_ada')).toEqual(['A:b1']));
    expect(counted()).toEqual([]);
    expect(await roadmapsOf(w.planEnv(), 'A')).toHaveLength(2);
    await vi.waitFor(async () => expect((await read(second)).status).toBe(404));
    expect((await read(first)).status).toBe(200);
  });

  it('never serves two on a limit of one by deleting a board, publishing another and undoing the delete', async () => {
    await world({});
    const first = (await (await publish('b1')).json<RoadmapResponse>()).roadmap.code;
    // Board b1 is deleted from the canvas; b2 is published in its place.
    await boards('b2');
    const res = await publish('b2');
    expect(res.status).toBe(201);
    const second = (await res.json<RoadmapResponse>()).roadmap.code;
    // The delete is undone: b1's row is still there, but it holds no counted place.
    await boards('b1', 'b2');
    expect((await read(second)).status).toBe(200);
    expect((await read(first)).status).toBe(404);
    // The editor reads b1 as not published, with every place used; publishing it is refused at the limit.
    const listed = await list();
    expect(listed.roadmaps.map((r) => r.boardId)).toEqual(['b2']);
    expect(listed.usage).toEqual({ used: 1, limit: 1 });
    expect((await publish('b1')).status).toBe(409);
    expect((await read(first)).status).toBe(404);
    expect(counted()).toEqual(['A:b2']);
    // Once b2 comes down, b1 claims its place again with the same link.
    await w.as('owner', 'DELETE', '/roadmaps/b2');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 61_000);
    expect((await list()).roadmaps.map((r) => r.boardId)).toEqual(['b1']);
    expect((await read(first)).status).toBe(200);
  });

  it('claims a board that came back when it fits, with no press', async () => {
    await world({ [ME]: 'pro' });
    const first = (await (await publish('b1')).json<RoadmapResponse>()).roadmap.code;
    await boards('b2');
    await list();
    expect(counted()).toEqual([]);
    await boards('b1', 'b2');
    expect((await read(first)).status).toBe(404);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 61_000);
    expect((await list()).roadmaps.map((r) => r.boardId)).toEqual(['b1']);
    expect(counted()).toEqual(['A:b1']);
    expect((await read(first)).status).toBe(200);
  });

  it('publishes again straight after an upgrade, and lists the place once it is held', async () => {
    await world({});
    await publish('b1');
    expect((await publish('b2')).status).toBe(409);
    // The owner pays. Nothing forgets what it remembered of them (the room's minute, the client's): the publish is
    // the service's to count, and its answer says the tier moved, so the list reads the limits again.
    fake.tiers.set(ME, 'pro');
    expect((await publish('b2')).status).toBe(201);
    expect((await list()).usage).toEqual({ used: 2, limit: 10 });
  });

  it('asks about a roadmap over the limit once a minute at most, however often the list is read', async () => {
    await world({ [ME]: 'pro' });
    await publish('b1');
    await publish('b2');
    uncount();
    fake.gauges.clear();
    fake.set(ME, 'free');
    plan().restart();
    await list();
    const told = fake.to('gauge').length;
    for (let i = 0; i < 5; i += 1) await list();
    expect(fake.to('gauge')).toHaveLength(told);
  });

  it('counts a guest’s plan in the plan alone, against Free, and never asks the service', async () => {
    await world({});
    setPlanOwner(plan().db, 'A', 'guest_abc');
    const first = (await (await publish('b1')).json<RoadmapResponse>()).roadmap.code;
    const over = await publish('b2');
    expect(over.status).toBe(409);
    expect(await over.json<RoadmapErrorBody>()).toEqual({
      error: 'roadmap_limit_reached',
      limit: 'publicRoadmaps',
      used: 1,
      max: 1,
      guest: true,
    });
    const listed = await list();
    expect(listed).toMatchObject({ usage: { used: 1, limit: 1 }, guest: true });
    expect(listed.owner).toBeUndefined();
    expect((await read(first)).status).toBe(200);
    expect(fake.calls).toEqual([]);
  });
});
