import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WATCH_CHANGES_PER_MINUTE,
  WATCHES_PER_KNOWLEDGEBASE_MAX,
  type PageWatchResponse,
} from '@liveknowledge/api-schema';
import type { Env } from '../types';
import { handleDocuments } from './documents';
import { knowledgeKit, page, type Kit, type Who } from './knowledge-test-kit';
import { parseWatchChange } from './knowledge-watch-routes';
import { makeTestRouteContext } from './test-route-context';

// docs/specs/030-knowledgebase/watching.md: who watches a page or a section, what the count says, the bounds, and
// which changes are noted for watchers (and which never are).
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
vi.mock('../room-client', async (original) => ({
  ...(await original<typeof import('../room-client')>()),
  relayPages: vi.fn(async () => 1),
}));
vi.mock('../knowledge/approval-email', () => ({ sendPageRejected: vi.fn(async () => {}) }));
const NAMES: Record<string, string> = { user_o: 'Olu', user_p: 'Priya', user_v: 'Vic' };
vi.mock('../person/profiles', async (original) => ({
  ...(await original<typeof import('../person/profiles')>()),
  getParticipant: async (_env: unknown, id: string) =>
    NAMES[id] ? { id, name: NAMES[id], color: '#123456' } : null,
}));

let clock = Date.UTC(2026, 10, 22);
beforeEach(() => {
  clock += 120_000;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const path = (tab = 'deploys') => `/api/documents/kb/pages/${tab}/watch`;
const watch = (kit: Kit, who: Who, scope: unknown, tab = 'deploys') =>
  kit.call(who, 'PUT', path(tab), { scope });
const read = async (kit: Kit, who: Who, tab = 'deploys') =>
  (await kit.call(who, 'GET', path(tab))).json<PageWatchResponse>();
const errorOf = async (res: Response) => (await res.json<{ error: string }>()).error;

type UpdateRow = { tab: string; kinds: string; actors: string; actor_ids: string; count: number };
const updates = (kit: Kit): UpdateRow[] =>
  kit.db.sql
    .prepare(
      'SELECT tab, kinds, actors, actor_ids, count FROM watch_updates ORDER BY first_at, tab',
    )
    .all() as UpdateRow[];
const kindsOf = (kit: Kit, tab: string) =>
  updates(kit)
    .filter((u) => u.tab === tab)
    .map((u) => JSON.parse(u.kinds) as string[]);

async function kitWithOwed() {
  const owed = vi.fn();
  const kit = await knowledgeKit({ WATCH_OWED: owed } as unknown as Partial<Env>);
  return { kit, owed };
}

describe('pages/:tab/watch', () => {
  it.each(['editor', 'participant', 'viewer'] as const)(
    'lets %s watch and unwatch a page, and counts them',
    async (who) => {
      const { kit, owed } = await kitWithOwed();
      expect(await read(kit, who)).toEqual({
        watching: null,
        through: null,
        watchers: 0,
        section: true,
      });
      const on = await watch(kit, who, 'page');
      expect(on.status).toBe(200);
      expect(await on.json<PageWatchResponse>()).toMatchObject({ watching: 'page', watchers: 1 });
      // The push and the daily check are owed, never run in the request.
      expect(owed).toHaveBeenCalledWith('inbox', clock + 60_000);
      expect(owed).toHaveBeenCalledWith('daily', clock + 86_400_000);
      // Someone else reads the count, never who.
      expect(await read(kit, 'link')).toMatchObject({ watching: null, watchers: 1 });
      // The same again changes nothing and owes nothing.
      owed.mockClear();
      expect((await watch(kit, who, 'page')).status).toBe(200);
      expect(owed).not.toHaveBeenCalled();
      const off = await watch(kit, who, null);
      expect(await off.json<PageWatchResponse>()).toMatchObject({ watching: null, watchers: 0 });
      expect(owed).toHaveBeenCalledWith('inbox', expect.any(Number));
      expect(owed).not.toHaveBeenCalledWith('daily', expect.any(Number));
    },
  );

  it.each(['link', 'edit-link', 'page-link', 'agent', 'agent-stored', 'viewer-agent'] as const)(
    'refuses %s a watch, and still lets them read the count',
    async (who) => {
      const kit = await knowledgeKit();
      await watch(kit, 'viewer', 'page', 'holidays');
      const res = await watch(kit, who, 'page', 'holidays');
      expect(res.status).toBe(403);
      expect(await errorOf(res)).toBe('watch_needs_account');
      expect(await read(kit, who, 'holidays')).toMatchObject({ watching: null, watchers: 1 });
    },
  );

  it('refuses a stranger who cannot read the knowledgebase', async () => {
    const kit = await knowledgeKit();
    expect((await watch(kit, 'stranger', 'page')).status).toBe(403);
  });

  it('watches a section: its subpages read as watched through it, and count it', async () => {
    const kit = await knowledgeKit();
    const res = await watch(kit, 'viewer', 'section');
    expect(await res.json<PageWatchResponse>()).toMatchObject({ watching: 'section' });
    expect(await read(kit, 'viewer', 'rollbacks')).toEqual({
      watching: null,
      through: { tab: 'deploys', name: 'Deploys' },
      watchers: 1,
      section: false,
    });
    // A page watch under it keeps both, counted once.
    await watch(kit, 'viewer', 'page', 'rollbacks');
    expect(await read(kit, 'viewer', 'rollbacks')).toMatchObject({
      watching: 'page',
      through: null,
      watchers: 1,
    });
    await watch(kit, 'participant', 'page', 'rollbacks');
    expect((await read(kit, 'editor', 'rollbacks')).watchers).toBe(2);
    // A page alone is no section.
    const lone = await watch(kit, 'viewer', 'section', 'holidays');
    expect([lone.status, await errorOf(lone)]).toEqual([400, 'not_a_section']);
  });

  it('keeps a link confined to one page to that page', async () => {
    const kit = await knowledgeKit();
    await watch(kit, 'editor', 'section');
    const call = (method: string, body?: unknown) =>
      handleDocuments(
        makeTestRouteContext(method, path('rollbacks'), {
          env: kit.db.env,
          owner: 'user_v',
          accountUserId: 'user_v',
          body,
          headers: { 'X-Share-Code': 'PAGEP' },
        }),
      );
    // The section above is not its to see: no count from it, no "through".
    expect(await (await call('GET')).json<PageWatchResponse>()).toEqual({
      watching: null,
      through: null,
      watchers: 0,
      section: false,
    });
    const page = await call('PUT', { scope: 'page' });
    expect(page.status).toBe(200);
    const section = await call('PUT', { scope: 'section' });
    expect([section.status, await errorOf(section)]).toEqual([403, 'section_out_of_reach']);
  });

  it('refuses a body that is no change, and a method it does not take', async () => {
    const kit = await knowledgeKit();
    for (const body of [null, {}, { scope: 'everything' }, { scope: 1 }])
      expect(await errorOf(await kit.call('viewer', 'PUT', path(), body))).toBe('invalid_change');
    expect((await kit.call('viewer', 'POST', path(), { scope: 'page' })).status).toBe(405);
    expect(parseWatchChange({ scope: null })).toEqual({ scope: null });
    expect(parseWatchChange('page')).toBeNull();
  });

  it('holds the knowledgebase to its bound, and a person to their rate', async () => {
    const kit = await knowledgeKit();
    const insert = kit.db.sql.prepare(
      "INSERT INTO page_watchers (tab, person, scope, at) VALUES ('holidays', ?, 'page', 1)",
    );
    for (let i = 0; i < WATCHES_PER_KNOWLEDGEBASE_MAX; i++) insert.run(`user_n${i}`);
    const full = await watch(kit, 'viewer', 'page');
    expect([full.status, await errorOf(full)]).toEqual([409, 'watchers_full']);
    kit.db.sql.exec("DELETE FROM page_watchers WHERE person = 'user_n0'");
    expect((await watch(kit, 'viewer', 'page')).status).toBe(200);
    // A held row changes its scope past the bound.
    kit.db.sql.exec(
      "INSERT INTO page_watchers (tab, person, scope, at) VALUES ('rollbacks', 'user_n0', 'page', 1)",
    );
    expect((await watch(kit, 'viewer', 'section')).status).toBe(200);
    // The rate: a minute's worth, then refused.
    for (let i = 2; i < WATCH_CHANGES_PER_MINUTE; i++)
      await watch(kit, 'viewer', i % 2 === 0 ? null : 'page');
    const fast = await watch(kit, 'viewer', 'page');
    expect([fast.status, await errorOf(fast)]).toEqual([429, 'watching_too_fast']);
  });

  it('is no edit: nothing but the watch moves', async () => {
    const kit = await knowledgeKit();
    const before = kit.db.sql.prepare('SELECT COUNT(*) AS n FROM outbox').get() as { n: number };
    await watch(kit, 'viewer', 'page');
    expect(kit.db.sql.prepare('SELECT COUNT(*) AS n FROM outbox').get()).toEqual(before);
    expect(updates(kit)).toEqual([]);
  });
});

describe('what watchers hear of', () => {
  const save = (kit: Kit, who: Who, tab: string, text: string, extra: object = {}) =>
    kit.call(who, 'PUT', `/api/documents/kb/tabs/${tab}`, {
      ...page(tab, tab === 'holidays' ? 'Holidays' : tab, [
        { id: 'b1', type: 'paragraph', runs: [{ text }] },
      ]),
      ...extra,
    });

  it('notes nothing, and asks nobody, while nobody watches', async () => {
    const kit = await knowledgeKit();
    expect((await save(kit, 'editor', 'holidays', 'Changed.')).status).toBeLessThan(300);
    expect(updates(kit)).toEqual([]);
  });

  it('folds an hour of saves into one update, naming who, newest first', async () => {
    const { kit, owed } = await kitWithOwed();
    await watch(kit, 'viewer', 'page', 'holidays');
    owed.mockClear();
    await save(kit, 'editor', 'holidays', 'First change.');
    await save(kit, 'participant', 'holidays', 'Second change.');
    // A save that changes nothing a reader reads is no save.
    await save(kit, 'participant', 'holidays', 'Second change.');
    const [row] = updates(kit);
    expect(updates(kit)).toHaveLength(1);
    expect(JSON.parse(row!.kinds)).toEqual(['saved']);
    expect(JSON.parse(row!.actors)).toEqual([
      { id: 'user_p', name: 'Priya' },
      { id: 'user_o', name: 'Olu' },
    ]);
    expect(row!.count).toBe(2);
    expect(owed).toHaveBeenCalledWith('inbox', expect.any(Number));
    // An hour on, the next change opens another.
    vi.setSystemTime(clock + 61 * 60_000);
    await save(kit, 'editor', 'holidays', 'Third change.');
    expect(updates(kit)).toHaveLength(2);
  });

  it('hears approvals decided, moves and deletes, and never a reaction, a thread or a Verify', async () => {
    const kit = await knowledgeKit();
    await watch(kit, 'viewer', 'section');
    await watch(kit, 'viewer', 'page', 'holidays');
    // Asking and Verify are no news.
    await kit.call('participant', 'POST', path().replace('watch', 'approval'), {
      action: 'request',
    });
    await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/verify');
    await kit.call('viewer', 'POST', '/api/documents/kb/pages/holidays/reactions', {
      emoji: '👏',
      on: true,
    });
    await kit.call('viewer', 'POST', '/api/documents/kb/pages/holidays/threads', { text: 'Hi' });
    expect(kindsOf(kit, 'holidays')).toEqual([]);
    expect(kindsOf(kit, 'deploys')).toEqual([]);
    await kit.call('editor', 'POST', path().replace('watch', 'approval'), { action: 'approve' });
    expect(kindsOf(kit, 'deploys')).toEqual([['approved']]);
    await kit.call('editor', 'POST', path().replace('watch', 'approval'), { action: 'request' });
    await kit.call('participant', 'POST', path().replace('watch', 'approval'), {
      action: 'reject',
      note: 'Needs a date.',
    });
    expect(kindsOf(kit, 'deploys')).toEqual([['approved', 'rejected']]);
    // A move under the watched section, by an agent's route.
    const moved = await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/move', {
      parent: 'deploys',
    });
    expect(moved.status).toBe(200);
    expect(kindsOf(kit, 'holidays')).toEqual([['moved']]);
    // Moving it to where it is, is no move.
    await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/move', {
      parent: 'deploys',
    });
    expect(updates(kit).find((u) => u.tab === 'holidays')?.count).toBe(1);
    // Deleted: to the Trash.
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/rollbacks')).status).toBe(
      204,
    );
    expect(kindsOf(kit, 'rollbacks')).toEqual([['deleted']]);
    const deleted = updates(kit).find((u) => u.tab === 'rollbacks');
    expect(JSON.parse(deleted!.actors)).toEqual([{ id: 'user_o', name: 'Olu' }]);
  });

  it('hears a move made by a save of the page or of the tab list', async () => {
    const kit = await knowledgeKit();
    await watch(kit, 'viewer', 'page', 'holidays');
    // The writing as it was: a move, and no edit.
    await save(kit, 'editor', 'holidays', 'Everyone takes the last week of December off.', {
      parent: 'deploys',
    });
    expect(kindsOf(kit, 'holidays')).toEqual([['moved']]);
    const put = await kit.call('editor', 'PUT', '/api/documents/kb', {
      name: 'Handbook',
      tabs: [
        { id: 'deploys' },
        { id: 'rollbacks', parent: 'deploys' },
        { id: 'holidays', parent: null },
      ],
    });
    expect(put.status).toBeLessThan(300);
    expect(updates(kit).find((u) => u.tab === 'holidays')?.count).toBe(2);
  });
});
