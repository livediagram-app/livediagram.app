// What a tier keeps of an item's snapshots (snapshots.md "With Pro on"): the routes with a retention, and the
// retention read from the item's owner's entitlement.
import { limitsFor, type OwnerScope, type Tier } from '@liveworkspace/subscription';
import { describe, expect, it } from 'vitest';
import { SNAPSHOTS_KEPT, SNAPSHOTS_KEPT_PAID } from './limits';
import {
  keptWhileUnknown,
  RETENTION_UNKNOWN,
  retentionOf,
  snapshotRetention,
  type SnapshotRetention,
} from './retention';
import { serveSnapshots, type SnapshotDoor } from './routes';
import { listSnapshots, takeSnapshot, type SnapshotDb } from './store';
import { testDb } from './test/db';
import type { SnapshotListResponse, SnapshotTakeResponse } from './wire';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 20);
const FREE = retentionOf(7, 'p:user_a');
const PRO = retentionOf(null, 'p:user_a');

const door: SnapshotDoor = {
  exportFile: async () => 'now',
  replaceContent: async () => 'ok',
};

function serve(
  db: SnapshotDb,
  method: string,
  rest: string[],
  retention?: SnapshotRetention | null,
  now: number | null = NOW,
) {
  let asked = 0;
  const response = serveSnapshots({
    db,
    itemId: 'p1',
    request: new Request('https://x.test/api/projects/p1/' + rest.join('/'), {
      method,
      ...(method === 'POST' ? { body: '{}' } : {}),
    }),
    rest,
    caller: async () => ({ token: false, mayUse: true, person: null }),
    door: () => door,
    handle: async () => new Response('handled'),
    ...(retention === undefined
      ? {}
      : {
          retention: async () => {
            asked += 1;
            return retention;
          },
        }),
    ...(now === null ? {} : { now: () => now }),
  });
  return { response, asked: () => asked };
}

const seed = (db: SnapshotDb, ages: number[], itemId = 'p1') =>
  Promise.all(
    ages.map((days, n) =>
      takeSnapshot(db, {
        itemId,
        text: `v${n}`,
        name: `${days} days old`,
        kind: 'manual',
        author: null,
        now: NOW - days * DAY,
        keep: null,
      }),
    ),
  );

const names = async (db: SnapshotDb, itemId = 'p1') =>
  (await listSnapshots(db, itemId)).map((s) => s.name);

describe('retentionOf', () => {
  it('keeps five for the tier’s days, and fifty where history has no age limit', () => {
    expect(FREE).toEqual({
      keep: SNAPSHOTS_KEPT,
      maxAgeMs: 7 * DAY,
      days: 7,
      owner: 'p:user_a',
      known: true,
    });
    expect(PRO).toMatchObject({ keep: SNAPSHOTS_KEPT_PAID, maxAgeMs: null, days: null });
    expect(SNAPSHOTS_KEPT_PAID).toBe(50);
  });
});

describe('with Pro off', () => {
  it('keeps the latest five whatever their age, and answers the list as it always did', async () => {
    const { db } = testDb();
    await seed(db, [400, 300, 200, 100, 30]);
    for (const retention of [undefined, null]) {
      const listed = (await serve(db, 'GET', ['snapshots'], retention).response.then((r) =>
        r.json(),
      )) as SnapshotListResponse;
      expect(listed.kept).toBe(SNAPSHOTS_KEPT);
      expect(listed).not.toHaveProperty('retention');
      expect(listed.snapshots).toHaveLength(5);
      expect(listed.snapshots[0]).not.toHaveProperty('expiresAt');
    }
    expect((await serve(db, 'POST', ['snapshots'], null).response).status).toBe(201);
    // A sixth pushes the oldest out; nothing goes for its age.
    expect(await names(db)).toEqual([
      null,
      '30 days old',
      '100 days old',
      '200 days old',
      '300 days old',
    ]);
  });
});

describe('on Free', () => {
  it('drops a snapshot past its 7 days when the list is read, and says when each of the rest goes', async () => {
    const { db } = testDb();
    await seed(db, [8, 7, 6, 1]);
    // Another item's save points in the same store are not this item's to drop.
    await seed(db, [90], 'p1:tab-1');
    const listed = (await serve(db, 'GET', ['snapshots'], FREE).response.then((r) =>
      r.json(),
    )) as SnapshotListResponse;
    // Exactly 7 days old is still kept; a moment older is not.
    expect(listed.snapshots.map((s) => s.name)).toEqual(['1 days old', '6 days old', '7 days old']);
    expect(listed.snapshots[0]!.expiresAt).toBe(NOW - DAY + 7 * DAY);
    expect(listed.kept).toBe(5);
    expect(listed.retention).toEqual({ days: 7, owner: 'p:user_a' });
    expect(await names(db, 'p1:tab-1')).toEqual(['90 days old']);
  });

  it('drops the expired when one is taken, keeps the latest five, and answers the new one’s expiry', async () => {
    const { db } = testDb();
    await seed(db, [30, 5, 4, 3, 2, 1]);
    const taken = (await serve(db, 'POST', ['snapshots'], FREE).response.then((r) =>
      r.json(),
    )) as SnapshotTakeResponse;
    expect(taken.snapshot.expiresAt).toBe(NOW + 7 * DAY);
    expect(await names(db)).toEqual([null, '1 days old', '2 days old', '3 days old', '4 days old']);
  });

  it('never drops for age under a revert, and never asks the tier for a delete', async () => {
    const { db } = testDb();
    const [old] = await seed(db, [30, 1]);
    const id = old?.ok ? old.snapshot.id : '';
    const reverted = serve(db, 'POST', ['snapshots', id, 'revert'], FREE);
    expect((await reverted.response).status).toBe(200);
    expect(await names(db)).toContain('30 days old');
    const deleted = serve(db, 'DELETE', ['snapshots', id], FREE);
    expect((await deleted.response).status).toBe(204);
    expect(deleted.asked()).toBe(0);
  });
});

describe('the clock', () => {
  it('is the real one unless the app hands in its own', async () => {
    const { db } = testDb();
    await takeSnapshot(db, {
      itemId: 'p1',
      text: 'v',
      name: 'long ago',
      kind: 'manual',
      author: null,
      now: 1,
    });
    const listed = (await serve(db, 'GET', ['snapshots'], FREE, null).response.then((r) =>
      r.json(),
    )) as SnapshotListResponse;
    expect(listed.snapshots).toEqual([]);
    expect((await serve(db, 'POST', ['snapshots'], FREE, null).response).status).toBe(201);
  });
});

describe('on Pro and Pro for Teams', () => {
  it('keeps the latest 50 with no age limit, a revert’s safety snapshot included', async () => {
    const { db } = testDb();
    const [oldest] = await seed(db, [400, ...Array.from({ length: 49 }, (_, n) => 300 - n)]);
    const listed = (await serve(db, 'GET', ['snapshots'], PRO).response.then((r) =>
      r.json(),
    )) as SnapshotListResponse;
    expect(listed.snapshots).toHaveLength(50);
    expect(listed.kept).toBe(50);
    expect(listed.retention).toEqual({ days: null, owner: 'p:user_a' });
    expect(listed.snapshots[0]).not.toHaveProperty('expiresAt');
    const taken = (await serve(db, 'POST', ['snapshots'], PRO).response.then((r) =>
      r.json(),
    )) as SnapshotTakeResponse;
    expect(taken.snapshot).not.toHaveProperty('expiresAt');
    // The fifty-first pushed the oldest out, and nothing else.
    expect(await names(db)).toHaveLength(50);
    expect(await names(db)).not.toContain('400 days old');
    expect(oldest!.ok).toBe(true);
    const newest = (await listSnapshots(db, 'p1'))[1]!;
    await serve(db, 'POST', ['snapshots', newest.id, 'revert'], PRO).response;
    expect(await names(db)).toHaveLength(50);
  });
});

describe('snapshotRetention', () => {
  // Each test's own owners: the entitlement cache is the isolate's.
  let serial = 0;
  const owner = (): OwnerScope => `p:user_snap${++serial}`;
  const env = (tiers: Record<string, Tier>, asked: string[] = []) => ({
    PRO_ENABLED: 'true',
    SUBSCRIPTION_KEY: 'k',
    SUBSCRIPTION: {
      fetch: async (_input: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { owner: OwnerScope };
        asked.push(body.owner);
        const tier = tiers[body.owner] ?? 'free';
        return Response.json({ owner: body.owner, tier, seats: 3, limits: limitsFor(tier, 3) });
      },
    },
  });

  it('is nothing with Pro off, and asks nothing', async () => {
    const asked: string[] = [];
    expect(
      await snapshotRetention(
        { ...env({}, asked), PRO_ENABLED: 'false' },
        'livediagram.app',
        owner(),
      ),
    ).toBeNull();
    expect(asked).toEqual([]);
  });

  it('is the item’s owner’s tier: Free keeps five for 7 days, a team on Pro for Teams keeps fifty', async () => {
    const mine = owner();
    expect(await snapshotRetention(env({}), 'livediagram.app', mine)).toEqual(retentionOf(7, mine));
    const team: OwnerScope = `t:team_snap${++serial}`;
    expect(await snapshotRetention(env({ [team]: 'team' }), 'livediagram.app', team)).toEqual(
      retentionOf(null, team),
    );
    const pro = owner();
    expect((await snapshotRetention(env({ [pro]: 'pro' }), 'livediagram.app', pro))?.keep).toBe(50);
  });

  it('drops nothing on a guess: an owner the grant does not name, or a service that cannot say', async () => {
    const asked: string[] = [];
    expect(await snapshotRetention(env({}, asked), 'livediagram.app', undefined)).toBe(
      RETENTION_UNKNOWN,
    );
    expect(asked).toEqual([]);
    const down = {
      PRO_ENABLED: 'true',
      SUBSCRIPTION_KEY: 'k',
      // A service that is down is left alone for a moment, per address: this outage has its own.
      SUBSCRIPTION_URL: 'https://down.test/api/subscription',
      SUBSCRIPTION: { fetch: async () => new Response('down', { status: 503 }) },
    };
    expect(await snapshotRetention(down, 'livehuddle.app', owner())).toBe(RETENTION_UNKNOWN);
    // And the routes then drop nothing for its age, name no tier and say five are kept.
    const { db } = testDb();
    await seed(db, [400, 30, 1]);
    const listed = (await serve(db, 'GET', ['snapshots'], RETENTION_UNKNOWN).response.then((r) =>
      r.json(),
    )) as SnapshotListResponse;
    expect(listed.snapshots).toHaveLength(3);
    expect(listed.kept).toBe(SNAPSHOTS_KEPT);
    expect(listed).not.toHaveProperty('retention');
  });

  it('keeps five while the tier is unknown: not knowing never gives an item more than Free keeps', async () => {
    expect(RETENTION_UNKNOWN).toMatchObject({ keep: SNAPSHOTS_KEPT, maxAgeMs: null, known: false });
    const { db } = testDb();
    // It kept fifty: an item whose owner the grant did not name could gather fifty on Free.
    await seed(db, [400, 300, 200, 100, 1]);
    for (let take = 0; take < 4; take += 1) {
      const taken = await serve(db, 'POST', ['snapshots'], RETENTION_UNKNOWN).response;
      expect(taken.status).toBe(201);
    }
    const kept = await listSnapshots(db, 'p1');
    expect(kept).toHaveLength(SNAPSHOTS_KEPT);
    // The oldest made way, as on Free; none went for its age (the 400-day-old one outlived the first take).
    expect(kept.map((s) => s.name)).toContain('1 days old');
  });

  it('drops nothing a tier that keeps fifty left, while the tier is unknown', async () => {
    expect(keptWhileUnknown(0)).toBe(SNAPSHOTS_KEPT);
    expect(keptWhileUnknown(SNAPSHOTS_KEPT)).toBe(SNAPSHOTS_KEPT);
    expect(keptWhileUnknown(SNAPSHOTS_KEPT + 1)).toBe(SNAPSHOTS_KEPT_PAID);
    const { db } = testDb();
    // Thirty snapshots can only be a paying owner's: a guess never deletes twenty-five of them.
    await seed(
      db,
      Array.from({ length: 30 }, (_, n) => 400 - n),
    );
    const listed = (await serve(db, 'GET', ['snapshots'], RETENTION_UNKNOWN).response.then((r) =>
      r.json(),
    )) as SnapshotListResponse;
    expect(listed.kept).toBe(SNAPSHOTS_KEPT_PAID);
    expect((await serve(db, 'POST', ['snapshots'], RETENTION_UNKNOWN).response).status).toBe(201);
    expect(await listSnapshots(db, 'p1')).toHaveLength(31);
  });

  it('holds a guest’s item to Free without asking', async () => {
    const asked: string[] = [];
    expect(await snapshotRetention(env({}, asked), 'livediagram.app', null)).toEqual(
      retentionOf(7, null),
    );
    expect(asked).toEqual([]);
  });
});
