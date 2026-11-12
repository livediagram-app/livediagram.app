import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GITHUB_PERSON,
  defaultCatalogue,
  itemStatus,
  presetSetup,
  type Item,
  type ItemHistoryEntry,
} from '@liveplanner/items';
import type { GithubConnectionResponse } from '@liveplanner/api-schema';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { ruleFor } from '../plan-room/github/github-pulls';
import {
  connection,
  githubWorld,
  prPayload,
  type GithubWorld,
  type PrPayload,
} from './test-github-world';

// The board's GitHub rules (docs/specs/026-plan/github-pull-requests.md "GitHub rules"; blueprint "Part 3"): set by an
// Editor on the plan's connection, off until then; a linked pull request opening or merging moves its cards to the
// rule's column, keeping every rule a manual move keeps, and each move is GitHub's in the card's history.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: GithubWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await githubWorld(['A']);
  await w.seed('A', connection(7, [{ id: 11 }]));
  const catalogue = structuredClone(defaultCatalogue()) as unknown as {
    types: { id: string; custom?: unknown[]; excludedStatuses?: string[] }[];
  };
  const task = catalogue.types.find((t) => t.id === 'task')!;
  task.custom = [
    ...(task.custom ?? []),
    { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' },
  ];
  // Notes never sit in Review.
  const note = catalogue.types.find((t) => t.id === 'note')!;
  note.custom = [
    ...(note.custom ?? []),
    { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' },
  ];
  note.excludedStatuses = ['review'];
  const put = await w.send('PUT', '/api/projects/A/item-types', { itemTypes: catalogue });
  if (put.status !== 200) throw new Error(`item types answered ${put.status}`);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const URL42 = 'https://github.com/acme/repo-11/pull/42';
const rules = (body: unknown) => w.as('owner', 'PUT', '/github/rules', body);
const pr = (o: PrPayload = {}) => w.deliver('pull_request', prPayload(o));
const card = async (id: string): Promise<Item> => (await w.items('A')).find((i) => i.id === id)!;
const history = async (id: string) =>
  (
    await (
      await w.send('GET', `/api/projects/A/items/${id}/history`)
    ).json<{
      entries: ItemHistoryEntry[];
    }>()
  ).entries;
const linked = (status = 'todo', type = 'task') =>
  w
    .send('POST', '/api/projects/A/items', {
      type,
      fields: { title: 'Card', 'f-pr': URL42 },
      place: { status },
    })
    .then(async (r) => (await r.json<{ item: Item }>()).item);

describe('setting the rules', () => {
  it('starts off, takes a column of the plan’s boards (or null), and answers them on the connection', async () => {
    const before = await (await w.as('owner', 'GET', '/github')).json<GithubConnectionResponse>();
    expect(before.connection!.rules).toEqual({ opened: null, merged: null });
    const res = await rules({ opened: 'review', merged: 'done' });
    expect(res.status).toBe(200);
    expect((await res.json<GithubConnectionResponse>()).connection!.rules).toEqual({
      opened: 'review',
      merged: 'done',
    });
    expect((await rules({ opened: null, merged: 'done' })).status).toBe(200);
  });

  it('refuses a column no board names, a wrong shape, and a plan with no connection', async () => {
    for (const body of [
      { opened: 'nowhere', merged: null },
      { opened: '', merged: null },
      { opened: 'x'.repeat(65), merged: null },
      { opened: 3, merged: null },
      { merged: 'done' },
    ]) {
      const res = await rules(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ error: 'github_invalid' });
    }
    expect((await w.as('owner', 'DELETE', '/github')).status).toBe(204);
    const res = await rules({ opened: null, merged: null });
    expect(res.status).toBe(409);
  });

  it('survive a connect again, and go with a disconnect', async () => {
    await rules({ opened: 'review', merged: 'done' });
    await w.seed('A', connection(7, [{ id: 11 }]));
    const again = await (await w.as('owner', 'GET', '/github')).json<GithubConnectionResponse>();
    expect(again.connection!.rules).toEqual({ opened: 'review', merged: 'done' });
  });
});

describe('the rules at work', () => {
  beforeEach(async () => {
    expect((await rules({ opened: 'review', merged: 'done' })).status).toBe(200);
  });

  it('a linked pull request opening moves its cards, by field and by mention, by GitHub', async () => {
    const byField = await linked();
    const named = await w.make('A', { title: 'Named' });
    expect((await pr({ title: `A #${named.key}` })).status).toBe(202);
    for (const id of [byField.id, named.id]) {
      const c = await card(id);
      expect(itemStatus(c)).toBe('review');
      expect(c.updatedBy).toEqual(GITHUB_PERSON);
    }
    const [entry] = await history(byField.id);
    expect(entry).toMatchObject({
      by: { name: 'GitHub', color: GITHUB_PERSON.color },
      tag: 'github',
      changes: [{ kind: 'moved', from: 'todo', to: 'review' }],
    });
  });

  it('a draft opening moves nothing; marked ready for review, or reopened, it does', async () => {
    const c = await linked();
    await pr({ draft: true, at: '2026-11-12T10:00:00Z' });
    expect(itemStatus(await card(c.id))).toBe('todo');
    await pr({ action: 'ready_for_review', at: '2026-11-12T10:01:00Z' });
    expect(itemStatus(await card(c.id))).toBe('review');
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'doing' });
    await pr({ action: 'reopened', at: '2026-11-12T10:02:00Z' });
    expect(itemStatus(await card(c.id))).toBe('review');
  });

  it('merging moves to the merged rule’s column; closing unmerged moves nothing', async () => {
    const c = await linked('doing');
    await pr({ action: 'closed', state: 'closed', at: '2026-11-12T10:00:00Z' });
    expect(itemStatus(await card(c.id))).toBe('doing');
    await pr({ action: 'closed', state: 'closed', merged: true, at: '2026-11-12T10:01:00Z' });
    expect(itemStatus(await card(c.id))).toBe('done');
  });

  it('never moves a card back for an older delivery', async () => {
    const c = await linked();
    await pr({ action: 'closed', state: 'closed', merged: true, at: '2026-11-12T10:05:00Z' });
    expect(itemStatus(await card(c.id))).toBe('done');
    await pr({ action: 'opened', at: '2026-11-12T10:00:00Z' });
    expect(itemStatus(await card(c.id))).toBe('done');
  });

  it('leaves a card whose type leaves the column out, one in the Trash, one archived and one already there', async () => {
    const note = await linked('todo', 'note');
    const trashed = await linked();
    await w.send('POST', `/api/projects/A/items/${trashed.id}/move`, { status: 'trash' });
    const archived = await linked();
    await w.send('POST', `/api/projects/A/items/${archived.id}`, { set: { archived: true } });
    const there = await linked('review');
    await pr();
    expect(itemStatus(await card(note.id))).toBe('todo');
    expect(itemStatus(await card(trashed.id))).toBe('trash');
    expect(itemStatus(await card(archived.id))).toBe('todo');
    const still = await card(there.id);
    expect(itemStatus(still)).toBe('review');
    expect(still.updatedBy).not.toEqual(GITHUB_PERSON);
  });

  it('moves nothing while its rule is off, or when its column is no board’s any longer', async () => {
    await rules({ opened: null, merged: 'done' });
    const c = await linked();
    await pr();
    expect(itemStatus(await card(c.id))).toBe('todo');
    await rules({ opened: 'review', merged: 'done' });
    // The board loses its Review column.
    const setup = presetSetup('kanban');
    const put = await w.send('PUT', '/api/projects/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      kind: 'board',
      elements: [
        {
          id: 'b1',
          type: 'shape',
          shape: 'plan-board',
          x: 0,
          y: 0,
          width: 800,
          height: 500,
          planBoard: { ...setup, columns: setup.columns.filter((col) => col.id !== 'review') },
        },
      ],
    });
    expect(put.status).toBeLessThan(300);
    await pr({ action: 'reopened', at: '2026-11-12T11:00:00Z' });
    expect(itemStatus(await card(c.id))).toBe('todo');
  });

  it('ruleFor reads each action', () => {
    const r = { opened: 'o', merged: 'm' };
    expect(ruleFor(r, 'opened', 'open')).toBe('o');
    expect(ruleFor(r, 'opened', 'draft')).toBeNull();
    expect(ruleFor(r, 'ready_for_review', 'open')).toBe('o');
    expect(ruleFor(r, 'reopened', 'open')).toBe('o');
    expect(ruleFor(r, 'closed', 'merged')).toBe('m');
    expect(ruleFor(r, 'closed', 'closed')).toBeNull();
    expect(ruleFor(r, 'edited', 'open')).toBeNull();
  });
});
