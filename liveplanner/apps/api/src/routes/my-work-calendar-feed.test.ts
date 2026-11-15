// The My Work feed (docs/specs/026-plan/calendar-feed.md "The My Work feed"): its signed-in routes, the person's own
// feed only, in person (never an API token, a workbench session or a guest), and its link, `GET
// /api/calendar/my-work/lpf_….ics` through the worker's dispatch, with the token's person and their cards asked fresh
// of the index (and their teams of accounts) on every fetch. The index is a stand-in here: its own tests pin the store
// and the cards read (liveworkspace/apps/index/src/calendar-feeds.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Feed = { personId: string; tokenHash: string; createdAt: number };
const store = vi.hoisted(() => ({
  feeds: new Map<string, Feed>(),
  cards: [] as unknown[],
  // How the stand-in index answers: 'ok', 'refuse' (a 403) or 'down' (a throw).
  mode: 'ok' as 'ok' | 'refuse' | 'down' | 'cardsDown',
  asked: [] as { personId: string; teams: readonly string[] }[],
  noClient: false,
  noAppClient: false,
}));

vi.mock('../index-service', async (original) => {
  const { IndexError } = await import('@liveworkspace/index-client');
  const guard = () => {
    if (store.mode === 'down') throw new Error('index down');
    if (store.mode === 'refuse') throw new IndexError(403, 'calendar_feed_app_only');
  };
  return {
    ...(await original<typeof import('../index-service')>()),
    indexFor: (
      _env: unknown,
      caller: { kind: string; personId: string; teams: readonly string[] },
    ) => {
      if (store.noClient) return null;
      store.asked.push({ personId: caller.personId, teams: caller.teams });
      const personId = caller.personId;
      return {
        calendarFeed: async () => {
          guard();
          const row = store.feeds.get(personId);
          return { feed: row ? { createdAt: row.createdAt } : null };
        },
        putCalendarFeed: async (tokenHash: string) => {
          guard();
          store.feeds.set(personId, { personId, tokenHash, createdAt: 42 });
          return { feed: { createdAt: 42 } };
        },
        deleteCalendarFeed: async () => {
          guard();
          store.feeds.delete(personId);
        },
        calendarCards: async () => {
          guard();
          if (store.mode === 'cardsDown') throw new Error('index down');
          return store.cards;
        },
      };
    },
    indexAppClient: () =>
      store.noAppClient
        ? null
        : {
            calendarFeedByToken: async (hash: string) => {
              if (store.mode === 'down') throw new Error('index down');
              return [...store.feeds.values()].find((f) => f.tokenHash === hash)?.personId ?? null;
            },
          },
  };
});

import type {
  MyWorkCalendarFeedIssueResponse,
  MyWorkCalendarFeedResponse,
} from '@liveplanner/api-schema';
import { DAY_MS } from '@liveplanner/items';
import type { CalendarCard } from '@liveworkspace/index-client';
import worker from '../index';
import { feedTokenHash } from '../calendar/feed-token';
import { ACCOUNTS_ON, INDEX_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import type { RouteContext } from './context';
import { handleMyWorkCalendarFeedRoutes } from './my-work-calendar-feed-routes';
import { handleMyWorkFeed } from './my-work-feed-route';

const ADA = 'user_ada';
const today = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
const env = { ...ACCOUNTS_ON, ...INDEX_ON, APP_BASE_URL: 'https://plan.test' } as Env;

let accounts: FakeAccounts;
beforeEach(() => {
  store.feeds.clear();
  store.cards = [];
  store.mode = 'ok';
  store.asked = [];
  store.noClient = false;
  store.noAppClient = false;
  accounts = stubAccounts();
  accounts.teams.set('team_1', [
    { id: 'm1', userId: ADA, email: 'a@x', name: 'Ada', role: 'member', status: 'joined' },
  ]);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Who = 'account' | 'token' | 'workbench' | 'guest' | 'nobody';

function ctxAs(who: Who, method: string, path = '/api/my-work/calendar-feed'): RouteContext {
  const owner = who === 'nobody' ? null : who === 'guest' ? 'guest_1' : ADA;
  return {
    request: new Request(`https://api.test${path}`, { method }),
    env,
    segments: path.split('/').filter(Boolean),
    accountUserId: who === 'account' || who === 'token' ? ADA : null,
    token: who === 'token' ? { id: 'tok_1' } : null,
    workbench: who === 'workbench' ? ({ ownerId: ADA } as RouteContext['workbench']) : null,
    resolveOwner: () => owner,
  } as unknown as RouteContext;
}

const manage = (who: Who, method: string, path?: string) =>
  handleMyWorkCalendarFeedRoutes(ctxAs(who, method, path));

const fetchFeed = (path: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://api.test${path}`, init), env, {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext);

const tokenOf = (path: string) => /\/(lpf_[A-Za-z0-9_-]{43})\.ics$/.exec(path)![1]!;

async function make(): Promise<string> {
  const res = await manage('account', 'POST');
  return (await res.json<MyWorkCalendarFeedIssueResponse>()).path;
}

const dated = (patch: Partial<CalendarCard> = {}): CalendarCard => ({
  itemId: 'P',
  itemTitle: 'Relaunch',
  cardId: 'c1',
  card: {
    key: 1,
    type: 'task',
    typeLabel: 'Task',
    title: 'Launch',
    board: { tabId: 't', elementId: 'b', title: 'Kanban', tabName: 'Board' },
    due: today,
  },
  updatedAt: 20,
  ...patch,
});

describe('/api/my-work/calendar-feed', () => {
  it('reads, makes, resets and turns off the person’s own feed, keeping only its hash at the index', async () => {
    const first = await manage('account', 'GET');
    expect(first.status).toBe(200);
    expect(first.headers.get('Cache-Control')).toBe('no-store');
    expect(await first.json<MyWorkCalendarFeedResponse>()).toEqual({ feed: null });

    const made = await manage('account', 'POST');
    expect(made.status).toBe(201);
    const issued = await made.json<MyWorkCalendarFeedIssueResponse>();
    expect(issued.feed).toEqual({ createdAt: 42 });
    expect(issued.path).toMatch(/^\/api\/calendar\/my-work\/lpf_[A-Za-z0-9_-]{43}\.ics$/);
    const token = tokenOf(issued.path);
    expect(store.feeds.get(ADA)!.tokenHash).toBe(await feedTokenHash(token));
    expect(JSON.stringify([...store.feeds.values()])).not.toContain(token);
    expect(await (await manage('account', 'GET')).json()).toEqual({ feed: { createdAt: 42 } });

    // Reset Link: a new token, the old hash gone.
    const reset = await (await manage('account', 'POST')).json<MyWorkCalendarFeedIssueResponse>();
    expect(tokenOf(reset.path)).not.toBe(token);
    expect(store.feeds.get(ADA)!.tokenHash).toBe(await feedTokenHash(tokenOf(reset.path)));

    expect((await manage('account', 'DELETE')).status).toBe(204);
    expect(store.feeds.size).toBe(0);
    expect(store.asked.every((a) => a.personId === ADA && a.teams.length === 0)).toBe(true);
  });

  it.each(['token', 'workbench', 'guest'] as const)(
    'refuses %s, and nothing changes',
    async (who) => {
      for (const method of ['GET', 'POST', 'DELETE']) {
        const res = await manage(who, method);
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'calendar_feed_needs_account' });
      }
      expect(store.feeds.size).toBe(0);
      expect(store.asked).toEqual([]);
    },
  );

  it('asks for sign-in with no identity, refuses other methods and paths, and says when the index is away', async () => {
    expect((await manage('nobody', 'GET')).status).toBe(400);
    expect((await manage('account', 'PUT')).status).toBe(405);
    expect((await manage('account', 'GET', '/api/my-work/other')).status).toBe(404);
    store.mode = 'down';
    const down = await manage('account', 'POST');
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: 'calendar_feed_unavailable' });
    store.mode = 'ok';
    store.noClient = true;
    expect((await manage('account', 'GET')).status).toBe(503);
  });

  it('is dispatched by the worker', async () => {
    // No identity: the sign-in answer, never the feed.
    expect((await fetchFeed('/api/my-work/calendar-feed')).status).toBe(400);
  });
});

describe('GET /api/calendar/my-work/:token.ics', () => {
  it('serves the person’s cards as iCalendar, asking accounts for their teams and the index as them', async () => {
    store.cards = [dated(), dated()];
    const path = await make();
    store.asked = [];
    const res = await fetchFeed(path);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="my-work.ics"');
    const body = await res.text();
    expect(body).toContain('X-WR-CALNAME:My Work · liveplanner\r\n');
    expect(body).toContain('SUMMARY:#1 Launch\r\n');
    expect(body).toContain('URL:https://plan.test/project/P#item=c1\r\n');
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(store.asked).toEqual([{ personId: ADA, teams: ['team_1'] }]);

    const etag = res.headers.get('ETag')!;
    const cached = await fetchFeed(path, { headers: { 'If-None-Match': etag } });
    expect(cached.status).toBe(304);
    const head = await fetchFeed(path, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('answers the same 404 for an unknown token, a turned-off feed and a refusal from the index', async () => {
    const unknown = await fetchFeed(`/api/calendar/my-work/lpf_${'x'.repeat(43)}.ics`);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'feed_not_found' });
    const path = await make();
    store.mode = 'refuse';
    expect((await fetchFeed(path)).status).toBe(404);
    store.mode = 'ok';
    await manage('account', 'DELETE');
    expect((await fetchFeed(path)).status).toBe(404);
  });

  it('refuses a feed whose person is no account', async () => {
    const path = await make();
    store.feeds.get(ADA)!.personId = 'guest_1';
    expect((await fetchFeed(path)).status).toBe(404);
  });

  it('answers 503 when the index or accounts cannot say, never a feed nobody checked', async () => {
    const path = await make();
    store.mode = 'down';
    expect((await fetchFeed(path)).status).toBe(503);
    store.mode = 'cardsDown';
    expect((await fetchFeed(path)).status).toBe(503);
    store.mode = 'ok';
    vi.stubGlobal('fetch', async () => new Response('down', { status: 500 }));
    expect((await fetchFeed(path)).status).toBe(503);
    vi.unstubAllGlobals();
    accounts = stubAccounts();
    store.noClient = true;
    expect((await fetchFeed(path)).status).toBe(503);
    store.noClient = false;
    store.noAppClient = true;
    expect((await fetchFeed(path)).status).toBe(503);
    store.noAppClient = false;
    // A deployment without accounts' settings can check nobody.
    const token = tokenOf(path);
    const bare = { ...INDEX_ON } as Env;
    expect(
      (await handleMyWorkFeed(new Request(`https://api.test${path}`), bare, token)).status,
    ).toBe(503);
  });

  it('refuses other methods and a malformed link', async () => {
    const path = await make();
    expect((await fetchFeed(path, { method: 'POST' })).status).toBe(405);
    expect((await fetchFeed('/api/calendar/my-work/nope.ics')).status).toBe(404);
  });
});
