// A calendar feed's link (docs/specs/026-plan/calendar-feed.md "How it answers"): `GET /api/calendar/:plan/lpf_….ics`
// through the worker's dispatch, before identity, with the person's access asked fresh of accounts and the index on
// every fetch. A reset or revoked token, a removed member, someone who only ever had a share link and a deleted plan
// all answer the same 404; a short cache, an ETag and a 304 keep calendar apps' polling cheap.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../index-service', async (original) => {
  const { testIndexFor, testRequestGrant } = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    indexFor: testIndexFor,
    requestGrant: testRequestGrant,
  };
});

import { DAY_MS, defaultCatalogue, type Item } from '@liveplanner/items';
import worker from '../index';
import { issueCalendarFeed, revokeCalendarFeed } from '../calendar/feed-store';
import { insertItems } from '../db/items';
import { planRoom } from '../plan-client';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { ACCOUNTS_ON, INDEX_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { handleCalendarFeed, matchesEtag } from './calendar-feed-route';

const OWNER = 'user_ada';
const MEMBER = 'user_bea';
const OUTSIDER = 'user_cat';
const ALL = { typeIds: null, boardId: null, mine: false, includeDone: false };
const today = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS).toISOString().slice(0, 10);

const card = (id: string, key: number, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key,
  rank: `a${key}`,
  fields,
  rev: 1,
  createdAt: 10,
  updatedAt: 20,
  createdBy: { id: 'p', name: 'Ada', color: '#123456' },
  updatedBy: { id: 'p', name: 'Ada', color: '#123456' },
});

let db: SqliteD1;
let accounts: FakeAccounts;

beforeEach(async () => {
  accounts = stubAccounts();
  db = sqliteD1({ ...ACCOUNTS_ON, ...INDEX_ON, APP_BASE_URL: 'https://plan.test' });
  db.sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, team_id, shareable, saved_at, created_at)
     VALUES ('P', '${OWNER}', 'Relaunch', 'team_1', 0, 1, 1)`,
  );
  accounts.teams.set('team_1', [
    { id: 'm1', userId: MEMBER, email: 'b@x', name: 'Bea', role: 'member', status: 'joined' },
  ]);
  await setPlanItemTypes(db.env, 'P', defaultCatalogue());
  await insertItems(db.env, 'P', [card('c1', 1, { title: 'Launch', due: today })]);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const issue = (person: string, plan = 'P') => issueCalendarFeed(db.env, plan, person, ALL, 1);

const fetchFeed = (path: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://api.test${path}`, init), db.env, {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext);

const feedPath = (token: string, plan = 'P') => `/api/calendar/${plan}/${token}.ics`;

describe('GET /api/calendar/:projectId/:token.ics', () => {
  it("serves the owner's feed as iCalendar, with a short private cache and an ETag", async () => {
    const res = await fetchFeed(feedPath(await issue(OWNER)));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('ETag')).toMatch(/^"[0-9a-f]{32}"$/);
    const body = await res.text();
    expect(body).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(body).toContain('X-WR-CALNAME:Relaunch · liveplanner\r\n');
    expect(body).toContain('SUMMARY:#1 Launch\r\n');
    expect(body).toContain('URL:https://plan.test/project/P#item=c1\r\n');
  });

  it("serves a team member's feed", async () => {
    expect((await fetchFeed(feedPath(await issue(MEMBER)))).status).toBe(200);
  });

  it('answers the same bytes and ETag while nothing changes, and 304 for a fetch naming it', async () => {
    const path = feedPath(await issue(OWNER));
    const first = await fetchFeed(path);
    const etag = first.headers.get('ETag')!;
    const again = await fetchFeed(path);
    expect(again.headers.get('ETag')).toBe(etag);
    expect(await again.text()).toBe(await first.text());
    const cached = await fetchFeed(path, { headers: { 'If-None-Match': `W/${etag}` } });
    expect(cached.status).toBe(304);
    expect(cached.headers.get('ETag')).toBe(etag);
    expect(cached.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(await cached.text()).toBe('');
    // A card changed: a new ETag, so the old one no longer matches.
    await insertItems(db.env, 'P', [card('c2', 2, { title: 'Party', due: today })]);
    const changed = await fetchFeed(path, { headers: { 'If-None-Match': etag } });
    expect(changed.status).toBe(200);
    expect(changed.headers.get('ETag')).not.toBe(etag);
  });

  it('answers HEAD with the headers and no body', async () => {
    const res = await fetchFeed(feedPath(await issue(OWNER)), { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toMatch(/^"/);
    expect(await res.text()).toBe('');
  });

  it('a reset token stops the old link at once', async () => {
    const old = await issue(OWNER);
    const fresh = await issue(OWNER);
    expect((await fetchFeed(feedPath(old))).status).toBe(404);
    expect((await fetchFeed(feedPath(fresh))).status).toBe(200);
  });

  it('a feed turned off answers 404', async () => {
    const token = await issue(OWNER);
    await revokeCalendarFeed(db.env, 'P', OWNER);
    const res = await fetchFeed(feedPath(token));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'feed_not_found' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('a member removed from the team is refused on the next fetch', async () => {
    const path = feedPath(await issue(MEMBER));
    expect((await fetchFeed(path)).status).toBe(200);
    accounts.teams.set('team_1', []);
    expect((await fetchFeed(path)).status).toBe(404);
  });

  it('someone with only a share link gets nothing, whatever its role', async () => {
    testShareLink(db, 'P', 'code1', 'edit');
    const res = await fetchFeed(feedPath(await issue(OUTSIDER)));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'feed_not_found' });
  });

  it('a deleted plan answers 404', async () => {
    const token = await issue(OWNER);
    await planRoom(db.env, 'P').purge();
    expect((await fetchFeed(feedPath(token))).status).toBe(404);
  });

  it('an unknown token, a plan nothing has written and a malformed link answer the same 404', async () => {
    const token = await issue(OWNER);
    const unknown = `lpf_${'A'.repeat(43)}`;
    for (const path of [
      feedPath(unknown),
      feedPath(token, 'other'),
      `/api/calendar/P/${token}`,
      `/api/calendar/P/lwt_${'a'.repeat(43)}.ics`,
      `/api/calendar/P/${token}.ics/extra`,
      '/api/calendar',
    ]) {
      const res = await fetchFeed(path);
      expect(res.status, path).toBe(404);
    }
  });

  it('serves only GET and HEAD', async () => {
    const res = await fetchFeed(feedPath(await issue(OWNER)), { method: 'POST' });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('limits each feed by its own token, never by network', async () => {
    const keys: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: false };
      },
    };
    const env = { ...db.env, WRITE_RATE_LIMITER: limiter } as unknown as Env;
    const token = await issue(OWNER);
    const res = await handleCalendarFeed(new Request(`https://api.test${feedPath(token)}`), env);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^feed:[0-9a-f]{32}$/);
    expect(keys[0]).not.toContain(token);
    // On the test env itself, which carries the index's test tables (a spread would drop them).
    const within = Object.assign(db.env, {
      WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    });
    const served = await handleCalendarFeed(
      new Request(`https://api.test${feedPath(token)}`),
      within,
    );
    expect(served.status).toBe(200);
  });

  it('answers 503 when access cannot be checked, never the feed', async () => {
    const token = await issue(OWNER);
    accounts.failWith = 500;
    const res = await fetchFeed(feedPath(token));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('300');
  });
});

describe('matchesEtag', () => {
  it('reads a list, weak forms and *', () => {
    expect(matchesEtag(null, '"a"')).toBe(false);
    expect(matchesEtag('"b", W/"a"', '"a"')).toBe(true);
    expect(matchesEtag('*', '"a"')).toBe(true);
    expect(matchesEtag('"b"', '"a"')).toBe(false);
  });
});
