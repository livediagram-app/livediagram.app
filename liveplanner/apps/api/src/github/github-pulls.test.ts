import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCatalogue, type Item, type PullRequestStatus } from '@liveplanner/items';
import type { ItemsResponse } from '@liveplanner/api-schema';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { pullRequestsFor } from '../routes/item-pull-requests';
import type { PlanRouteContext } from '../routes/context';
import type { ItemCaller } from '../routes/item-route-kit';
import { CHECK_SUITES_KEPT, PULL_REQUESTS_KEPT } from '@liveplanner/items';
import { upsertPull, upsertSuite } from '../plan-room/github/github-pulls-store';
import { readCheckSuite, readPullRequest } from './github-payloads';
import {
  connection,
  githubWorld,
  prPayload,
  suitePayload,
  type GithubWorld,
  type PrPayload,
} from './test-github-world';

// Pull request state on cards (docs/specs/026-plan/github-pull-requests.md "Pull request state on cards", "What a share
// link sees"; blueprint "Part 3"), through the real worker and the plan's room: each delivery's state kept unless the
// plan holds a newer one, a commit's check suites folded, every screen told, and `GET /items` answering the states the
// cards link.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: GithubWorld;
let broadcasts: unknown[];
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await githubWorld(['A']);
  await w.seed('A', connection(7, [{ id: 11 }]));
  // A task type with a Pull Request field and a Link field.
  const catalogue = structuredClone(defaultCatalogue()) as unknown as {
    types: { id: string; fields?: string[]; custom?: unknown[] }[];
  };
  const task = catalogue.types.find((t) => t.id === 'task')!;
  task.custom = [
    ...(task.custom ?? []),
    { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' },
    { id: 'f-link', label: 'Link', kind: 'link' },
  ];
  const put = await w.send('PUT', '/api/projects/A/item-types', { itemTypes: catalogue });
  if (put.status !== 200) throw new Error(`item types answered ${put.status}`);
  broadcasts = [];
  const room = w.plans.get('A')!.room;
  const real = room.broadcastOrderedSystemOp.bind(room);
  vi.spyOn(room, 'broadcastOrderedSystemOp').mockImplementation((op: unknown) => {
    broadcasts.push(op);
    real(op);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const pr = async (o: PrPayload = {}) => {
  const res = await w.deliver('pull_request', prPayload(o));
  expect(res.status).toBe(202);
  return res.json<{ delivered: number }>();
};
const suite = async (o: Parameters<typeof suitePayload>[0] = {}) =>
  (await w.deliver('check_suite', suitePayload(o))).json<{ delivered: number }>();
const listed = async (): Promise<ItemsResponse> =>
  (await w.send('GET', '/api/projects/A/items')).json<ItemsResponse>();
const stateOf = async (key = 'acme/repo-11#42') =>
  (await listed()).pullRequests?.find((s) => s.key === key);
const sent = () =>
  broadcasts.filter((op) => (op as { kind: string }).kind === 'pull-requests') as {
    upserts: PullRequestStatus[];
    removed: string[];
    reset?: true;
  }[];
const linked = (fields: Record<string, unknown> = {}) =>
  w.make('A', { title: 'Card', 'f-pr': 'https://github.com/acme/repo-11/pull/42', ...fields });

describe('a pull request’s state', () => {
  it('is kept from a delivery and answered with the cards that link it, by field', async () => {
    const card = await linked();
    expect(await pr({ title: 'Ship it' })).toEqual({ delivered: 1 });
    const state = await stateOf();
    expect(state).toMatchObject({
      key: 'acme/repo-11#42',
      url: 'https://github.com/acme/repo-11/pull/42',
      title: 'Ship it',
      state: 'open',
    });
    expect(state?.checks).toBeUndefined();
    expect(state?.cards).toBeUndefined();
    // Every screen heard it.
    expect(
      sent()
        .at(-1)!
        .upserts.map((s) => s.key),
    ).toEqual(['acme/repo-11#42']);
    expect(card.id).toBeTruthy();
  });

  it('links the cards its title or body names, in this plan, by number', async () => {
    const first = await w.make('A', { title: 'One' });
    const second = await w.make('A', { title: 'Two' });
    await pr({ title: `Fix A #${first.key}`, body: `Also (a ${second.key}) and A #999` });
    expect((await stateOf())?.cards).toEqual([first.id, second.id]);
  });

  it('is kept for a pull request no card links yet, and answered once a field holds it', async () => {
    await pr();
    const before = await listed();
    expect(before.pullRequests).toEqual([]);
    await w.make('A', { title: 'Later', 'f-link': 'www.github.com/ACME/repo-11/pull/42/files' });
    expect((await listed()).pullRequests!.map((s) => s.key)).toEqual(['acme/repo-11#42']);
  });

  it('reads draft, merged and closed', async () => {
    await linked();
    await pr({ draft: true, at: '2026-11-12T10:00:00Z' });
    expect((await stateOf())?.state).toBe('draft');
    await pr({ action: 'closed', state: 'closed', at: '2026-11-12T10:01:00Z' });
    expect((await stateOf())?.state).toBe('closed');
    await pr({ action: 'closed', state: 'closed', merged: true, at: '2026-11-12T10:02:00Z' });
    expect((await stateOf())?.state).toBe('merged');
  });

  it('never goes back for an older delivery', async () => {
    await linked();
    await pr({ action: 'closed', state: 'closed', merged: true, at: '2026-11-12T10:05:00Z' });
    const before = sent().length;
    await pr({ action: 'opened', at: '2026-11-12T10:00:00Z', title: 'Older' });
    expect(await stateOf()).toMatchObject({ state: 'merged', title: 'Private title' });
    expect(sent().length).toBe(before);
  });

  it('folds its newest commit’s check suites: failing over running over passing', async () => {
    await linked();
    await pr({ sha: 'aaaaaaa' });
    expect(await suite({ suiteId: 1, sha: 'aaaaaaa', conclusion: 'success' })).toEqual({
      delivered: 1,
    });
    expect((await stateOf())?.checks).toBe('passing');
    await suite({ suiteId: 2, sha: 'aaaaaaa', status: 'in_progress', conclusion: null });
    expect((await stateOf())?.checks).toBe('running');
    await suite({ suiteId: 3, sha: 'aaaaaaa', conclusion: 'failure' });
    expect((await stateOf())?.checks).toBe('failing');
    // Every screen heard each.
    expect(sent().filter((op) => op.upserts[0]?.checks).length).toBe(3);
  });

  it('starts a new commit with no checks, and ignores an older suite result', async () => {
    await linked();
    await pr({ sha: 'aaaaaaa', at: '2026-11-12T10:00:00Z' });
    await suite({ suiteId: 1, sha: 'aaaaaaa', conclusion: 'failure', at: '2026-11-12T10:02:00Z' });
    await suite({ suiteId: 1, sha: 'aaaaaaa', conclusion: 'success', at: '2026-11-12T10:01:00Z' });
    expect((await stateOf())?.checks).toBe('failing');
    await pr({ action: 'synchronize', sha: 'bbbbbbb', at: '2026-11-12T10:03:00Z' });
    expect((await stateOf())?.checks).toBeUndefined();
    // A suite for a commit no pull request stands at is kept, and sends nothing.
    const before = sent().length;
    await suite({ suiteId: 9, sha: 'ccccccc' });
    expect(sent().length).toBe(before);
  });

  it('keeps the plan’s most recent pull requests and commits’ suites', async () => {
    const db = w.planEnv('A').PLAN_DB;
    const one = readPullRequest(prPayload())!;
    for (let n = 1; n <= PULL_REQUESTS_KEPT + 2; n += 1)
      await upsertPull(db, { ...one, ref: { ...one.ref, number: n } }, [], n);
    const kept = await db.prepare('SELECT key FROM github_pull_requests').all<{ key: string }>();
    expect(kept.results.length).toBe(PULL_REQUESTS_KEPT);
    expect(kept.results.some((r) => r.key === 'acme/repo-11#1')).toBe(false);
    const s = readCheckSuite(suitePayload())!;
    for (let n = 1; n <= CHECK_SUITES_KEPT + 2; n += 1)
      await upsertSuite(db, { ...s, suiteId: n, updatedAt: n });
    const suites = await db
      .prepare('SELECT suite_id FROM github_check_suites')
      .all<{ suite_id: number }>();
    expect(suites.results.length).toBe(CHECK_SUITES_KEPT);
    expect(suites.results.some((r) => r.suite_id === 1)).toBe(false);
  }, 60_000);

  it('goes with the connection, and every screen drops them', async () => {
    await linked();
    await pr();
    const del = await w.as('owner', 'DELETE', '/github');
    expect(del.status).toBe(204);
    expect(sent().at(-1)).toMatchObject({ upserts: [], removed: [], reset: true });
    expect((await listed()).pullRequests).toBeUndefined();
  });

  it('goes with a repository no longer chosen, or removed from the installation', async () => {
    await w.seed('A', connection(7, [{ id: 11 }, { id: 12 }]));
    await linked();
    await pr();
    await pr({ repoId: 12, number: 5 });
    w.gh.installationRepositories = [
      { id: 11, full_name: 'acme/repo-11' },
      { id: 12, full_name: 'acme/repo-12' },
    ];
    expect((await w.as('owner', 'PUT', '/github/repositories', { ids: [11] })).status).toBe(200);
    expect(sent().at(-1)).toMatchObject({ removed: ['acme/repo-12#5'] });
    const res = await w.deliver('installation_repositories', {
      action: 'removed',
      installation: { id: 7 },
      repositories_removed: [{ id: 11 }],
    });
    expect(res.status).toBe(202);
    expect(sent().at(-1)).toMatchObject({ removed: ['acme/repo-11#42'] });
    expect(await stateOf()).toBeUndefined();
  });
});

describe('who reads the states', () => {
  const ctx = () => ({ env: w.planEnv('A') }) as unknown as PlanRouteContext;
  const caller = (c: Partial<ItemCaller> = {}): ItemCaller => ({
    projectId: 'A',
    owner: 'o',
    scope: null,
    ...c,
  });

  it('a reader of the cards, the states those cards link, naming only the cards they are answered', async () => {
    const mentioned = await w.make('A', { title: 'Named' });
    const other = await w.make('A', { title: 'Other' });
    await linked();
    await pr({ title: `A #${mentioned.key} and A #${other.key}` });
    await pr({ number: 7, title: 'Nobody' });
    const items = await w.items('A');
    const all = await pullRequestsFor(ctx(), caller(), items);
    expect(all!.map((s) => [s.key, s.cards])).toEqual([
      ['acme/repo-11#42', [mentioned.id, other.id]],
    ]);
    // A tab's caller: only its cards, and only they are named.
    const one = items.filter((i: Item) => i.id === mentioned.id);
    expect(
      (await pullRequestsFor(ctx(), caller({ scope: new Set([mentioned.id]) }), one))!,
    ).toEqual([expect.objectContaining({ key: 'acme/repo-11#42', cards: [mentioned.id] })]);
  });

  it('a Community visitor, none; nor anyone while the feature is off', async () => {
    await linked();
    await pr();
    const items = await w.items('A');
    expect(await pullRequestsFor(ctx(), caller({ community: true }), items)).toBeUndefined();
    const off = {
      env: { ...w.planEnv('A'), GITHUB_WEBHOOK_SECRET: '' },
    } as unknown as PlanRouteContext;
    expect(await pullRequestsFor(off, caller(), items)).toBeUndefined();
  });
});
