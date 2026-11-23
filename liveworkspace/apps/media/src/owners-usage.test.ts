// What the subscription service reads of each owner (liveworkspace/docs/specs/006-media/media.md "What Subscription
// shows"): their pictures' bytes and how many walkthroughs they keep, counted live from the rows the caps are enforced
// on. Every way those rows change is one this answer follows with nothing reported: an upload, a delete, the
// retention sweep, a guest's merge, an account's deletion, the pending-walkthrough sweep.
import { MEDIA_APP_HEADER, WALKTHROUGH_PENDING_MS } from '@liveworkspace/media';
import {
  MEDIA_USAGE_CALLER,
  MEDIA_USAGE_CALLER_HEADER,
  MEDIA_USAGE_OWNERS_MAX,
  type MediaUsageResponse,
} from '@liveworkspace/subscription';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { testDb, type TestDb } from './test-sqlite-d1';
import { subscriptionStub } from './test-subscription';
import { sweepPendingWalkthroughs } from './walkthroughs';

const BASE = 'https://liveworkspace.app/api/media';
const NOW = Date.UTC(2026, 10, 20, 12);

let db: TestDb;
let env: Env;
beforeEach(() => {
  db = testDb();
  env = { ...db.env, ...subscriptionStub().env };
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

const ask = (
  owners: unknown,
  over: { key?: string; caller?: string; env?: Env; method?: string; path?: string } = {},
) =>
  worker.fetch(
    new Request(`${BASE}/app${over.path ?? '/usage/owners'}`, {
      method: over.method ?? 'POST',
      headers: {
        Authorization: `Bearer ${over.key ?? 'sub-key'}`,
        [MEDIA_USAGE_CALLER_HEADER]: over.caller ?? MEDIA_USAGE_CALLER,
        'Content-Type': 'application/json',
      },
      ...(over.method === 'GET' ? {} : { body: JSON.stringify({ owners }) }),
    }),
    over.env ?? env,
  );
const usage = async (...owners: string[]) =>
  ((await (await ask(owners)).json()) as MediaUsageResponse).usage;

// A 64 byte PNG: the signature, then filler.
const PNG_64 = new Uint8Array(64).fill(1);
PNG_64.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let serial = 0;
const image = (owner: string, bytes: number) =>
  db.env.MEDIA_DB.prepare(
    `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
     VALUES (?, ?, 'livediagram.app', 'image/png', ?, 1, 1, ?, ?)`,
  )
    .bind(`img-${++serial}`, owner, bytes, `sha-${serial}`, NOW)
    .run();
const walkthrough = (owner: string, ready = 1, createdAt = NOW) =>
  db.env.MEDIA_DB.prepare(
    `INSERT INTO walkthroughs (id, owner, app, item, title, duration_ms, media_type, media_bytes, events_bytes,
       camera, ready, created_at, screen)
     VALUES (?, ?, 'livediagram.app', 'doc-1', 'Tour', 4000, 'video/webm', 16, 2, 0, ?, ?, 1)`,
  )
    .bind(`walk-${++serial}`, owner, ready, createdAt)
    .run();
const asApp = (path: string, init: RequestInit = {}) =>
  worker.fetch(
    new Request(`${BASE}/app${path}`, {
      ...init,
      headers: {
        Authorization: 'Bearer ld-key',
        'X-Media-App': 'livediagram.app',
        'Content-Type': 'application/json',
      },
    }),
    env,
  );

describe('who may ask', () => {
  it('only the subscription service, with the key the two share, and only with Pro on', async () => {
    await image('user_ada', 10);
    expect((await ask(['p:user_ada'])).status).toBe(200);
    expect((await ask(['p:user_ada'], { key: 'wrong' })).status).toBe(401);
    expect((await ask(['p:user_ada'], { key: 'ld-key' })).status).toBe(401);
    // An app's own key under its own name reaches no such route.
    expect((await ask(['p:user_ada'], { key: 'ld-key', caller: 'livediagram.app' })).status).toBe(
      404,
    );
    expect((await ask(['p:user_ada'], { caller: 'export' })).status).toBe(401);
    for (const off of [
      { ...env, PRO_ENABLED: 'false' },
      { ...env, PRO_ENABLED: undefined },
      { ...env, SUBSCRIPTION_KEY: undefined },
      { ...env, SUBSCRIPTION_KEY: '  ' },
    ]) {
      expect((await ask(['p:user_ada'], { env: off })).status).toBe(401);
    }
    expect(MEDIA_USAGE_CALLER_HEADER).toBe(MEDIA_APP_HEADER);
  });

  it('answers that one route and nothing else of the service', async () => {
    expect((await ask(['p:user_ada'], { method: 'GET' })).status).toBe(404);
    expect(
      (await ask(['p:user_ada'], { path: '/images?owner=user_ada', method: 'GET' })).status,
    ).toBe(404);
    expect((await ask(['p:user_ada'], { path: '/owners/user_ada', method: 'DELETE' })).status).toBe(
      404,
    );
  });

  it('refuses owners it cannot read', async () => {
    const tooMany = Array.from({ length: MEDIA_USAGE_OWNERS_MAX + 1 }, (_, i) => `p:user_${i}`);
    for (const owners of [undefined, 'p:user_ada', [], ['user_ada'], ['p:user_ada', 7], tooMany]) {
      const refused = await ask(owners);
      expect(refused.status, JSON.stringify(owners)?.slice(0, 40)).toBe(400);
      expect(await refused.json()).toEqual({ error: 'invalid_owners' });
    }
    expect((await ask(tooMany.slice(1))).status).toBe(200);
  });
});

describe('what an owner holds', () => {
  it('is each one’s bytes and walkthroughs, a team’s gallery under its team, in one batch', async () => {
    await image('user_ada', 1000);
    await image('user_ada', 24);
    await image('team:team_garden', 500);
    await image('user_bo', 7);
    await walkthrough('user_ada');
    // One started and not yet uploaded is kept too: it is what Walkthroughs Stored counts.
    await walkthrough('user_ada', 0);
    await walkthrough('user_bo');
    const batch = vi.spyOn(db.env.MEDIA_DB, 'batch');
    expect(await usage('p:user_ada', 't:team_garden', 'p:user_nobody', 'p:user_ada')).toEqual({
      'p:user_ada': { imageStorageBytes: 1024, walkthroughsStored: 2 },
      't:team_garden': { imageStorageBytes: 500, walkthroughsStored: 0 },
    });
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it('reads each count through an index', () => {
    for (const query of [
      'SELECT owner, COALESCE(SUM(byte_size), 0) FROM images WHERE owner IN (?, ?) GROUP BY owner',
      'SELECT owner, COUNT(*) FROM walkthroughs WHERE owner IN (?, ?) GROUP BY owner',
    ]) {
      const plan = (
        db.sql.prepare(`EXPLAIN QUERY PLAN ${query}`).all('a', 'b') as { detail: string }[]
      ).map((row) => row.detail);
      expect(plan.join(' | ')).toMatch(/SEARCH .* USING (COVERING )?INDEX/);
    }
  });

  it('follows every way the rows change, with nothing reported: nothing here can drift', async () => {
    const stored = await worker.fetch(
      new Request(`${BASE}/app/images?owner=user_ada`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ld-key',
          'X-Media-App': 'livediagram.app',
          'Content-Type': 'image/png',
          'Content-Length': '64',
          'X-Image-Width': '4',
          'X-Image-Height': '3',
        },
        body: PNG_64,
      }),
      env,
    );
    const { image: uploaded } = (await stored.json()) as { image: { id: string } };
    expect((await usage('p:user_ada'))['p:user_ada']?.imageStorageBytes).toBe(64);
    // A delete.
    await asApp(`/images/${uploaded.id}?owner=user_ada`, { method: 'DELETE' });
    expect(await usage('p:user_ada')).toEqual({});
    // A guest signs up: what they held is the account's.
    await image('guest:0123abcd', 300);
    await walkthrough('guest:0123abcd');
    await asApp('/owners/merge', {
      method: 'POST',
      body: JSON.stringify({ from: 'guest:0123abcd', to: 'user_ada' }),
    });
    expect(await usage('p:user_ada')).toEqual({
      'p:user_ada': { imageStorageBytes: 300, walkthroughsStored: 1 },
    });
    // A walkthrough whose media never arrived is swept.
    await walkthrough('user_ada', 0, NOW - WALKTHROUGH_PENDING_MS - 1);
    expect((await usage('p:user_ada'))['p:user_ada']?.walkthroughsStored).toBe(2);
    await sweepPendingWalkthroughs(env, NOW);
    expect((await usage('p:user_ada'))['p:user_ada']?.walkthroughsStored).toBe(1);
    // The retention sweep, a release and a copy all write these same rows; a row gone by any of them is gone here.
    db.sql.prepare("DELETE FROM images WHERE owner = 'user_ada'").run();
    expect((await usage('p:user_ada'))['p:user_ada']).toEqual({
      imageStorageBytes: 0,
      walkthroughsStored: 1,
    });
    // The account is deleted.
    await asApp('/owners/user_ada', { method: 'DELETE' });
    expect(await usage('p:user_ada')).toEqual({});
  });
});
