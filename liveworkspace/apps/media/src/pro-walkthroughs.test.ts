// Walkthrough Length and Walkthroughs Stored with Pro on (liveworkspace/docs/specs/006-media/walkthroughs.md "With Pro
// on"): the tier's limits in place of the legacy caps, the length by the better of the recorder's and the item
// owner's and how many are kept by the recorder's own alone, and the limits read the recorder asks for.
import {
  createMediaClient,
  MEDIA_ITEM_OWNER_HEADER,
  WALKTHROUGH_MAX_MS,
  WALKTHROUGH_MEDIA_MAX_BYTES,
  WALKTHROUGHS_PER_ITEM_MAX,
  type WalkthroughEvents,
} from '@liveworkspace/media';
import { TIER_LIMITS } from '@liveworkspace/subscription';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { testDb, type TestDb } from './test-sqlite-d1';
import { person, subscriptionStub } from './test-subscription';

const FREE = TIER_LIMITS.free;
const PRO = TIER_LIMITS.pro;

let db: TestDb;
beforeEach(() => {
  db = testDb({ WALKTHROUGH_MAX_PER_OWNER: '3' });
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

const calls = (env: Env) =>
  createMediaClient({
    app: 'livediagram.app',
    key: 'ld-key',
    url: 'https://liveworkspace.app/api/media',
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) =>
      worker.fetch(new Request(input as string, init), env)) as typeof fetch,
  }).walkthroughs;

const events = (durationMs: number): WalkthroughEvents => ({
  v: 1,
  screen: true,
  durationMs,
  camera: false,
  corner: 'bottom-left',
  startTab: 'tab-1',
  hidden: [],
  fingerprints: {},
  events: [],
});

const start = (env: Env, owner: string, durationMs = 4000, item = 'doc-1', itemOwner?: string) =>
  calls(env).start(
    owner,
    {
      item,
      title: 'Tour',
      author: 'Ada',
      mediaType: 'video/webm',
      mediaBytes: WEBM.byteLength,
      events: events(durationMs),
    },
    itemOwner,
  );

describe('with Pro off', () => {
  it('keeps ten minutes and the cap from [vars], asks nothing and answers no limits', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env, PRO_ENABLED: '' };
    const owner = person('off');
    // Over Free's five minutes, at the legacy ten: started.
    expect((await start(env, owner, WALKTHROUGH_MAX_MS)).ok).toBe(true);
    const long = await start(env, owner, WALKTHROUGH_MAX_MS + 1);
    expect(long).toMatchObject({
      status: 413,
      body: { error: 'too_long', limitMs: WALKTHROUGH_MAX_MS },
    });
    expect(long.ok ? null : long.body).not.toHaveProperty('owner');
    await start(env, owner);
    await start(env, owner);
    expect(await start(env, owner)).toMatchObject({
      status: 403,
      body: { error: 'walkthroughs_full', reason: 'count', limit: 3, current: 3 },
    });
    const listed = await calls(env).list('doc-1', { owner });
    expect(listed.ok && listed.value).not.toHaveProperty('limits');
    expect(sub.asked).toEqual([]);
    expect(sub.gauges).toEqual([]);
  });
});

describe('Walkthrough Length', () => {
  it('starts one of exactly Free’s five minutes and refuses a millisecond more, saying the limit', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const owner = person('free');
    const kept = await start(env, owner, FREE.walkthroughMaxMs);
    expect(kept.ok && kept.value.walkthrough.durationMs).toBe(FREE.walkthroughMaxMs);
    expect(await start(env, owner, FREE.walkthroughMaxMs + 1)).toMatchObject({
      status: 413,
      body: {
        error: 'too_long',
        limitMs: FREE.walkthroughMaxMs,
        limit: FREE.walkthroughMaxMs,
        current: FREE.walkthroughMaxMs + 1,
        owner: `p:${owner}`,
      },
    });
  });

  it('weighs the length too: a recording that says five minutes and is heavier than five minutes can be is refused', async () => {
    const owner = person('free');
    const sub = subscriptionStub({ 'p:user_longer': 'pro' });
    const env = { ...db.env, ...sub.env };
    const half = WALKTHROUGH_MEDIA_MAX_BYTES / 2;
    const heavy = (who: string, mediaBytes: number) =>
      calls(env).start(who, {
        item: 'doc-1',
        title: 'Tour',
        author: 'Ada',
        mediaType: 'video/webm',
        mediaBytes,
        // What the browser says: within Free's five minutes.
        events: events(FREE.walkthroughMaxMs),
      });
    expect(await heavy(owner, half + 1)).toMatchObject({
      status: 413,
      body: { error: 'file_too_large', limitBytes: half },
    });
    expect((await heavy(owner, half)).ok).toBe(true);
    // Pro's thirty minutes are recorded to the whole cap.
    expect((await heavy('user_longer', WALKTHROUGH_MEDIA_MAX_BYTES)).ok).toBe(true);
  });

  it('records thirty minutes on Pro, and no longer', async () => {
    const owner = person('pro');
    const sub = subscriptionStub({ [`p:${owner}`]: 'pro' });
    const env = { ...db.env, ...sub.env };
    const kept = await start(env, owner, PRO.walkthroughMaxMs);
    // Stored at its full length: the events are sealed to the tier's limit, not the legacy ten minutes.
    expect(kept.ok && kept.value.walkthrough.durationMs).toBe(PRO.walkthroughMaxMs);
    expect((await start(env, owner, PRO.walkthroughMaxMs + 1)).ok).toBe(false);
  });
});

describe('Walkthroughs Stored', () => {
  it('keeps five on Free and refuses the sixth, saying the limit and whose it is', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const owner = person('free');
    // The [vars] cap of 3 no longer applies.
    for (let n = 0; n < 5; n += 1)
      expect((await start(env, owner, 4000, `doc-${n}`)).ok).toBe(true);
    expect(await start(env, owner, 4000, 'doc-6')).toMatchObject({
      status: 403,
      body: {
        error: 'walkthroughs_full',
        reason: 'count',
        limit: 5,
        current: 5,
        owner: `p:${owner}`,
      },
    });
  });

  it('keeps as many as you like on Pro, and still at most 50 on one item', async () => {
    const owner = person('pro');
    const sub = subscriptionStub({ [`p:${owner}`]: 'pro' });
    const env = { ...db.env, ...sub.env };
    for (let n = 0; n < WALKTHROUGHS_PER_ITEM_MAX; n += 1) {
      expect((await start(env, owner)).ok).toBe(true);
    }
    expect(await start(env, owner)).toMatchObject({ status: 403, body: { error: 'item_full' } });
    expect((await start(env, owner, 4000, 'doc-2')).ok).toBe(true);
  });
});

describe('who pays', () => {
  it('lends a Free recorder the Pro for Teams item’s length, for a recording there, and no more to keep', async () => {
    const owner = person('free');
    const sub = subscriptionStub({ 't:team_garden': 'team' });
    const env = { ...db.env, ...sub.env };
    // Thirty minutes on the team's item; on their own, Free's five.
    expect((await start(env, owner, PRO.walkthroughMaxMs, 'doc-1', 't:team_garden')).ok).toBe(true);
    expect(await start(env, owner, FREE.walkthroughMaxMs + 1, 'mine')).toMatchObject({
      body: { error: 'too_long', limit: FREE.walkthroughMaxMs, owner: `p:${owner}` },
    });
    for (let n = 0; n < 4; n += 1) {
      expect((await start(env, owner, 4000, `team-${n}`, 't:team_garden')).ok).toBe(true);
    }
    // How many they keep is their own tier's, in every app: the sixth is refused on the team's item too (it was
    // unlimited there), and the refusal names them, never the team.
    expect(await start(env, owner, 4000, 'team-5', 't:team_garden')).toMatchObject({
      status: 403,
      body: {
        error: 'walkthroughs_full',
        reason: 'count',
        limit: 5,
        current: 5,
        owner: `p:${owner}`,
      },
    });
  });

  it('lets a Pro recorder keep their own limits on a Free owner’s item', async () => {
    const owner = person('pro');
    const sub = subscriptionStub({ [`p:${owner}`]: 'pro' });
    const env = { ...db.env, ...sub.env };
    const kept = await start(env, owner, PRO.walkthroughMaxMs, 'doc-1', 'p:user_free_owner');
    expect(kept.ok).toBe(true);
  });

  it('ignores a tier claimed in a header or the body', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const owner = person('free');
    const res = await worker.fetch(
      new Request(`https://liveworkspace.app/api/media/app/walkthroughs?owner=${owner}`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ld-key',
          'X-Media-App': 'livediagram.app',
          'Content-Type': 'application/json',
          'X-Subscription-Tier': 'pro',
          [MEDIA_ITEM_OWNER_HEADER]: 'pro',
        },
        body: JSON.stringify({
          item: 'doc-1',
          title: 'Tour',
          author: null,
          mediaType: 'video/webm',
          mediaBytes: WEBM.byteLength,
          events: events(FREE.walkthroughMaxMs + 1),
          tier: 'pro',
          limits: { walkthroughMaxMs: PRO.walkthroughMaxMs },
        }),
      }),
      env,
    );
    expect(res.status).toBe(413);
    expect(sub.asked).toEqual([`p:${owner}`]);
  });
});

describe('what the recorder is told', () => {
  it('answers the caller’s limits for the item with the list: length, stored and the stored limit', async () => {
    const owner = person('free');
    const sub = subscriptionStub({ 't:team_garden': 'team' });
    const env = { ...db.env, ...sub.env };
    await start(env, owner);
    await start(env, owner, 4000, 'doc-2');
    const mine = await calls(env).list('doc-1', { owner });
    expect(mine.ok && mine.value.limits).toEqual({
      maxMs: FREE.walkthroughMaxMs,
      stored: 2,
      storedLimit: 5,
      owner: `p:${owner}`,
      storedOwner: `p:${owner}`,
    });
    const teams = await calls(env).list('doc-1', { owner, itemOwner: 't:team_garden' });
    // The length is the team's to lend; how many are kept stays the recorder's own, and says whose.
    expect(teams.ok && teams.value.limits).toEqual({
      maxMs: PRO.walkthroughMaxMs,
      stored: 2,
      storedLimit: 5,
      owner: 't:team_garden',
      storedOwner: `p:${owner}`,
    });
    // A list nobody records from carries none.
    const plain = await calls(env).list('doc-1');
    expect(plain.ok && plain.value).not.toHaveProperty('limits');
  });
});

describe('what the subscription service is told', () => {
  it('nothing: it asks, live, when a person reads their usage', async () => {
    const owner = person('free');
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const started = await start(env, owner);
    const id = started.ok ? started.value.walkthrough.id : '';
    await calls(env).upload(owner, id, {
      body: WEBM.slice().buffer,
      type: 'video/webm',
      length: WEBM.byteLength,
    });
    await calls(env).remove(id, { owner });
    await calls(env).purge('doc-1');
    expect(sub.gauges).toEqual([]);
  });
});

describe('the Explorer’s Walkthroughs', () => {
  it('answers what the person’s own tier keeps with their list, in every app', async () => {
    const owner = person('lib');
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    await start(env, owner);
    // On an item a Pro team owns: their own tier still says what they keep.
    await start(env, owner, 4000, 'doc-2', 't:team_rich');
    const listed = await calls(env).listOwned(owner);
    expect(listed.ok && listed.value.limits).toEqual({
      maxMs: FREE.walkthroughMaxMs,
      stored: 2,
      storedLimit: FREE.walkthroughsStored,
      owner: `p:${owner}`,
      storedOwner: `p:${owner}`,
    });
  });

  it('says any number and thirty minutes on Pro, and nothing with Pro off', async () => {
    const owner = person('libpro');
    const pro = subscriptionStub({ [`p:${owner}`]: 'pro' });
    const listed = await calls({ ...db.env, ...pro.env }).listOwned(owner);
    expect(listed.ok && listed.value.limits).toMatchObject({
      maxMs: PRO.walkthroughMaxMs,
      stored: 0,
      storedLimit: null,
    });
    const off = subscriptionStub();
    const plain = await calls({ ...db.env, ...off.env, PRO_ENABLED: '' }).listOwned(owner);
    expect(plain.ok && plain.value).not.toHaveProperty('limits');
    expect(off.asked).toEqual([]);
  });
});
