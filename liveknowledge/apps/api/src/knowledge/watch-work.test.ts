import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, UPDATE_PEOPLE_MAX, type UpdatePush } from '@liveworkspace/index-client';
import type { Env } from '../types';
import { knowledgeKit, type Kit } from '../routes/knowledge-test-kit';
import type { WatchRow } from './page-watch';
import { foldChange, noteWatched } from './watch-notes';
import { noteReviewsLapsed } from './watch-review';
import {
  DAY_MS,
  peopleOf,
  pruneWatchUpdates,
  pushWatchUpdates,
  runWatchDaily,
  runWatchWork,
  updatePushes,
  WATCH_RETRY_MS,
  type WatchUpdate,
} from './watch-work';

// docs/specs/030-knowledgebase/watching.md: whom each update is for, the push to the Inbox and its retry, the daily
// check (who left, the digests), a review that came due, and the prune.
const pushed = vi.hoisted(() => ({ fn: vi.fn(async (_id: string, _u: UpdatePush[]) => {}) }));
const client = vi.hoisted(() => ({ on: true }));
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
    indexAppClient: () => (client.on ? { pushUpdates: pushed.fn } : null),
  };
});
const reach = vi.hoisted(() => ({ left: new Set<string>() }));
vi.mock('./knowledge-emails', async (original) => ({
  ...(await original<typeof import('./knowledge-emails')>()),
  ownersWhoReach: async (_env: unknown, _doc: unknown, people: readonly string[]) =>
    people.filter((p) => !reach.left.has(p)),
}));
const digests = vi.hoisted(() => ({
  fn: vi.fn(async (_env: unknown, emails: ReadonlyMap<string, unknown>) => [...emails.keys()]),
}));
vi.mock('../email/notifications', async (original) => ({
  ...(await original<typeof import('../email/notifications')>()),
  notifyWatchDigests: digests.fn,
}));
vi.mock('../person/profiles', async (original) => ({
  ...(await original<typeof import('../person/profiles')>()),
  getParticipant: async (_env: unknown, id: string) => ({ id, name: id, color: '#123456' }),
}));

const NOW = Date.UTC(2026, 10, 22, 9);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  client.on = true;
  reach.left = new Set();
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const row = (tab: string, person: string, scope: 'page' | 'section', at = 0): WatchRow => ({
  tab,
  person,
  scope,
  at,
});
const PARENTS = new Map<string, string | undefined>([
  ['deploys', undefined],
  ['rollbacks', 'deploys'],
  ['holidays', undefined],
]);
const update = (over: Partial<WatchUpdate> = {}): WatchUpdate => ({
  id: 'rollbacks:1',
  tabId: 'rollbacks',
  tabName: 'Rollbacks',
  kinds: ['saved'],
  actors: [{ id: 'user_o', name: 'Olu' }],
  actorCount: 1,
  count: 1,
  firstAt: 10,
  latestAt: 10,
  actorIds: ['user_o'],
  ...over,
});

describe('peopleOf', () => {
  it('is everyone covering the page, by the earliest watch, but never the only one who changed it', () => {
    const watches = [
      row('rollbacks', 'user_b', 'page', 5),
      row('deploys', 'user_a', 'section', 1),
      // A page watch of the parent covers the parent alone.
      row('deploys', 'user_c', 'page', 1),
      row('rollbacks', 'user_o', 'page', 1),
      // Started watching after the change: not theirs.
      row('rollbacks', 'user_late', 'page', 11),
      // A guest is never told.
      row('rollbacks', 'guest_1', 'page', 1),
    ];
    expect(peopleOf(update(), watches, PARENTS)).toEqual(['user_a', 'user_b']);
    // With someone else's change in it too, the actor hears of it.
    expect(peopleOf(update({ actorIds: ['user_o', 'user_p'] }), watches, PARENTS)).toEqual([
      'user_a',
      'user_o',
      'user_b',
    ]);
    // A review nobody did is for everyone.
    expect(peopleOf(update({ actorIds: [] }), watches, PARENTS)).toContain('user_o');
  });

  it('caps an update at the people who watched first, and leaves out an update for nobody', () => {
    const many = Array.from({ length: UPDATE_PEOPLE_MAX + 5 }, (_, i) =>
      row('rollbacks', `user_${String(i).padStart(3, '0')}`, 'page', i),
    );
    const people = peopleOf(update({ latestAt: 1e9 }), many, PARENTS);
    expect(people).toHaveLength(UPDATE_PEOPLE_MAX);
    expect(people[0]).toBe('user_000');
    expect(updatePushes([update()], [row('rollbacks', 'user_o', 'page')], PARENTS)).toEqual([]);
    const [push] = updatePushes([update()], [row('deploys', 'user_a', 'section')], PARENTS);
    expect(push).toMatchObject({ id: 'rollbacks:1', people: ['user_a'] });
    expect(push).not.toHaveProperty('actorIds');
  });
});

describe('foldChange', () => {
  it('keeps kinds in the order they came, the newest actor first, and nobody for a review', () => {
    const one = foldChange({ kinds: [], actors: [], actorIds: [] }, 'saved', {
      id: 'a',
      name: '  ',
    });
    expect(one).toEqual({
      kinds: ['saved'],
      actors: [{ id: 'a', name: 'Someone' }],
      actorIds: ['a'],
    });
    const two = foldChange(one, 'moved', { id: 'b', name: 'Bo' });
    const three = foldChange(two, 'saved', { id: 'a', name: 'Ada' });
    expect(three).toEqual({
      kinds: ['saved', 'moved'],
      actors: [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Bo' },
      ],
      actorIds: ['a', 'b'],
    });
    expect(foldChange(three, 'review_due', null).actors).toHaveLength(2);
  });
});

async function watchedKit(): Promise<{ kit: Kit; owed: ReturnType<typeof vi.fn> }> {
  const owed = vi.fn();
  const kit = await knowledgeKit({ WATCH_OWED: owed } as unknown as Partial<Env>);
  kit.db.sql.exec(`INSERT INTO page_watchers (tab, person, scope, at) VALUES
    ('deploys', 'user_v', 'section', 0), ('holidays', 'user_p', 'page', 0)`);
  return { kit, owed };
}
const env = (kit: Kit, owed?: ReturnType<typeof vi.fn>) =>
  ({ ...kit.db.env, WATCH_OWED: owed }) as unknown as Parameters<typeof pushWatchUpdates>[0];

describe('the push', () => {
  it('sends the recent updates with their people, and nothing is sent without an index', async () => {
    const { kit } = await watchedKit();
    await noteWatched(env(kit), {
      tabs: ['rollbacks', 'holidays'],
      kind: 'saved',
      actor: () => ({ id: 'user_o', name: 'Olu' }),
    });
    // The participant's own change to the page they watch is not theirs to hear of.
    await noteWatched(env(kit), {
      tabs: ['holidays'],
      kind: 'saved',
      actor: () => ({ id: 'user_p', name: 'Priya' }),
      now: NOW + 1,
    });
    expect(
      await runWatchWork(
        env(kit),
        'kb',
        { kind: 'watch', key: 'inbox', dueAt: 0, payload: '' },
        NOW,
      ),
    ).toBeNull();
    const sent = pushed.fn.mock.calls[0]!;
    expect(sent[0]).toBe('kb');
    expect(sent[1].map((u) => [u.tabId, u.people, u.kinds, u.count])).toEqual([
      ['holidays', ['user_p'], ['saved'], 2],
      ['rollbacks', ['user_v'], ['saved'], 1],
    ]);
    client.on = false;
    expect(await pushWatchUpdates(env(kit), 'kb', NOW)).toBeNull();
  });

  it('tries again later when the index is away, and gives up on an item it does not hold', async () => {
    const { kit } = await watchedKit();
    pushed.fn.mockRejectedValueOnce(new Error('network'));
    expect(await pushWatchUpdates(env(kit), 'kb', NOW)).toBe(NOW + WATCH_RETRY_MS);
    pushed.fn.mockRejectedValueOnce(new IndexError(404, 'not_found'));
    expect(await pushWatchUpdates(env(kit), 'kb', NOW)).toBeNull();
  });

  it('still reaches the section’s watchers of a page in the Trash', async () => {
    const { kit } = await watchedKit();
    await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/rollbacks');
    await pushWatchUpdates(env(kit), 'kb', NOW);
    const sent = pushed.fn.mock.calls.at(-1)![1];
    expect(sent.map((u) => [u.tabId, u.kinds, u.people])).toEqual([
      ['rollbacks', ['deleted'], ['user_v']],
    ]);
  });
});

describe('the daily check', () => {
  it('removes a watcher who left, then emails each digest once a day', async () => {
    const { kit, owed } = await watchedKit();
    kit.db.sql.exec(
      "INSERT INTO page_watchers (tab, person, scope, at) VALUES ('holidays', 'user_x', 'page', 0)",
    );
    reach.left = new Set(['user_x']);
    await noteWatched(env(kit), {
      tabs: ['rollbacks', 'holidays'],
      kind: 'saved',
      actor: () => ({ id: 'user_o', name: 'Olu' }),
    });
    expect(await runWatchDaily(env(kit, owed), 'kb', NOW)).toBe(NOW + DAY_MS);
    expect(
      kit.db.sql.prepare("SELECT COUNT(*) AS n FROM page_watchers WHERE person = 'user_x'").get(),
    ).toEqual({ n: 0 });
    expect(owed).toHaveBeenCalledWith('inbox', expect.any(Number));
    const emails = digests.fn.mock.calls[0]![1] as ReadonlyMap<
      string,
      { kind: string; html: string }
    >;
    expect([...emails.keys()].sort()).toEqual(['user_p', 'user_v']);
    expect(emails.get('user_v')!.html).toContain('Rollbacks');
    expect(emails.get('user_v')!.kind).toBe('WatchDigest');
    // The next day, nothing new: no email.
    digests.fn.mockClear();
    expect(await runWatchDaily(env(kit, owed), 'kb', NOW + DAY_MS)).toBe(NOW + 2 * DAY_MS);
    expect(digests.fn).not.toHaveBeenCalled();
    // With no watch left, the check stops.
    kit.db.sql.exec('DELETE FROM page_watchers');
    expect(
      await runWatchWork(
        env(kit),
        'kb',
        { kind: 'watch', key: 'daily', dueAt: 0, payload: '' },
        NOW,
      ),
    ).toBeNull();
  });

  it('stops for a knowledgebase that is gone', async () => {
    const { kit } = await watchedKit();
    expect(await runWatchDaily(env(kit), 'missing', NOW)).toBeNull();
  });
});

describe('a review that came due', () => {
  const due = [{ tab: 'holidays', state: 'review-due', verifiedAt: 5 }];
  it('marks the backlog first, then notes each new lapse once a verification', async () => {
    const { kit } = await watchedKit();
    const later = { tab: 'deploys', state: 'verified', reviewAt: NOW + 100 };
    expect(await noteReviewsLapsed(env(kit), [...due, later], NOW)).toBe(NOW + 100);
    expect(kit.db.sql.prepare('SELECT COUNT(*) AS n FROM watch_updates').get()).toEqual({ n: 0 });
    const again = [{ tab: 'holidays', state: 'review-due', verifiedAt: 9 }];
    expect(await noteReviewsLapsed(env(kit), again, NOW)).toBeNull();
    expect(await noteReviewsLapsed(env(kit), again, NOW)).toBeNull();
    const rows = kit.db.sql.prepare('SELECT kinds, actors, count FROM watch_updates').all();
    expect(rows).toEqual([{ kinds: '["review_due"]', actors: '[]', count: 1 }]);
  });

  it('asks nothing while nobody watches', async () => {
    const kit = await knowledgeKit();
    expect(await noteReviewsLapsed(kit.db.env as never, due, NOW)).toBeNull();
  });
});

describe('the prune', () => {
  it('drops updates past 14 days', async () => {
    const { kit } = await watchedKit();
    await noteWatched(env(kit), { tabs: ['holidays'], kind: 'saved', actor: () => null, now: 1 });
    await noteWatched(env(kit), { tabs: ['deploys'], kind: 'saved', actor: () => null });
    for (const s of pruneWatchUpdates(NOW)) kit.db.sql.prepare(s.sql).run(...s.params);
    expect(kit.db.sql.prepare('SELECT tab FROM watch_updates').all()).toEqual([{ tab: 'deploys' }]);
  });
});

describe('noteWatched', () => {
  it('logs a failure and never throws', async () => {
    const { kit } = await watchedKit();
    const broken = {
      ...kit.db.env,
      KNOWLEDGE_DB: {
        prepare: () => ({ first: async () => ({ one: 1 }) }),
        batch: async () => {
          throw new Error('boom');
        },
      },
    } as never;
    expect(
      await noteWatched(broken, { tabs: ['holidays'], kind: 'saved', actor: () => null }),
    ).toBe(false);
    expect(await noteWatched(env(kit), { tabs: [], kind: 'saved', actor: () => null })).toBe(false);
  });
});
