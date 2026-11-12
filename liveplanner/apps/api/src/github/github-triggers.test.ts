import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultCatalogue,
  itemStatus,
  type AutomationRun,
  type AutomationTrigger,
  type Item,
  type ItemHistoryEntry,
} from '@liveplanner/items';
import type { GithubConnectionResponse } from '@liveplanner/api-schema';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { queueGithubRuns } from '../plan-room/github/github-runs';
import {
  connection,
  githubWorld,
  prPayload,
  suitePayload,
  type GithubWorld,
  type PrPayload,
} from './test-github-world';

// The GitHub triggers (docs/specs/026-plan/github-pull-requests.md "GitHub triggers"; blueprint "Part 4"): a linked
// pull request's delivery queues the plan's GitHub-triggered rules on each card it links, by field and by mention, once
// per delivery and never for an older one; the rule's writes are GitHub's in the card's history.
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
    types: { id: string; custom?: unknown[] }[];
  };
  const task = catalogue.types.find((t) => t.id === 'task')!;
  task.custom = [
    ...(task.custom ?? []),
    { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' },
  ];
  const put = await w.send('PUT', '/api/projects/A/item-types', { itemTypes: catalogue });
  if (put.status !== 200) throw new Error(`item types answered ${put.status}`);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const URL42 = 'https://github.com/acme/repo-11/pull/42';
const room = () => w.plans.get('A')!.room;
const pr = (o: PrPayload = {}, id?: string) =>
  w.deliver('pull_request', prPayload(o), id ? { id } : {});
const card = async (id: string): Promise<Item> => (await w.items('A')).find((i) => i.id === id)!;
const history = async (id: string) =>
  (
    await (
      await w.send('GET', `/api/projects/A/items/${id}/history`)
    ).json<{ entries: ItemHistoryEntry[] }>()
  ).entries;
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;
const linked = (status = 'todo') =>
  w
    .send('POST', '/api/projects/A/items', {
      type: 'task',
      fields: { title: 'Card', 'f-pr': URL42 },
      place: { status },
    })
    .then(async (r) => (await r.json<{ item: Item }>()).item);
const moveOn = (trigger: AutomationTrigger, status: string, name = 'Move on GitHub') =>
  w.rule({ name, trigger, steps: [{ kind: 'move', status }] });

describe('a rule on a GitHub trigger', () => {
  it('moves each linked card, by field and by mention, as GitHub, with the run in the Audit Trail', async () => {
    await moveOn({ kind: 'pull_request_opened' }, 'review', 'Review on Open');
    const byField = await linked();
    const named = await w.make('A', { title: 'Named' });
    expect((await pr({ title: `A #${named.key}` })).status).toBe(202);
    await room().alarm();
    for (const id of [byField.id, named.id]) expect(itemStatus(await card(id))).toBe('review');
    const [entry] = await history(byField.id);
    expect(entry).toMatchObject({
      by: { name: 'Review on Open' },
      tag: 'automation_github',
      changes: [{ kind: 'moved', from: 'todo', to: 'review' }],
    });
    const all = await runs();
    expect(all).toHaveLength(2);
    expect(all[0]!.steps[0]).toMatchObject({
      kind: 'trigger',
      text: 'GitHub: acme/repo-11#42 opened',
      by: { name: 'GitHub' },
    });
  });

  it('finds a card by a long repository address, as Durable Object SQLite allows', async () => {
    // Production refuses a LIKE pattern over 50 bytes; this address is 54 with its wildcards (2026-11-12).
    await moveOn({ kind: 'pull_request_opened' }, 'review');
    const res = await w.send('POST', '/api/projects/A/items', {
      type: 'task',
      fields: {
        title: 'Card',
        'f-pr': 'https://github.com/livediagram-app/livediagram.app/pull/1668',
      },
      place: { status: 'todo' },
    });
    const c = (await res.json<{ item: Item }>()).item;
    const delivered = await pr({ fullName: 'livediagram-app/livediagram.app', number: 1668 });
    expect(delivered.status).toBe(202);
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('review');
  });

  it('hears a draft only once it is ready, and a reopen', async () => {
    await moveOn({ kind: 'pull_request_opened' }, 'review');
    const c = await linked();
    await pr({ draft: true, at: '2026-11-12T10:00:00Z' });
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('todo');
    await pr({ action: 'ready_for_review', at: '2026-11-12T10:01:00Z' });
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('review');
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'doing' });
    await pr({ action: 'reopened', at: '2026-11-12T10:02:00Z' });
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('review');
  });

  it('tells merged from closed without merging', async () => {
    await moveOn({ kind: 'pull_request_merged' }, 'done', 'Done on Merge');
    await moveOn({ kind: 'pull_request_closed' }, 'todo', 'Back on Close');
    const c = await linked('doing');
    await pr({ action: 'closed', state: 'closed', at: '2026-11-12T10:00:00Z' });
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('todo');
    await pr({ action: 'closed', state: 'closed', merged: true, at: '2026-11-12T10:01:00Z' });
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('done');
  });

  it('never runs for an older delivery, and a redelivery runs nothing twice', async () => {
    await moveOn({ kind: 'pull_request_opened' }, 'review');
    await moveOn({ kind: 'pull_request_merged' }, 'done', 'Done on Merge');
    const c = await linked();
    await pr({ action: 'closed', state: 'closed', merged: true, at: '2026-11-12T10:05:00Z' }, 'd1');
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('done');
    await pr({ action: 'opened', at: '2026-11-12T10:00:00Z' });
    await pr({ action: 'closed', state: 'closed', merged: true, at: '2026-11-12T10:05:00Z' }, 'd1');
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('done');
    expect(await runs()).toHaveLength(1);
    // Even queued twice (a delivery that slipped past the seen ids), one run.
    const env = w.planEnv('A');
    await queueGithubRuns(env, 'merged', 'acme/repo-11#42', [c.id], 'd1', Date.now());
    await room().alarm();
    expect(await runs()).toHaveLength(1);
  });

  it('hears checks changing into failing, or passing, once each', async () => {
    await w.rule({
      name: 'Flag Failing',
      trigger: { kind: 'pull_request_checks', result: 'failing' },
      steps: [{ kind: 'flag' }],
    });
    await w.rule({
      name: 'Label Green',
      trigger: { kind: 'pull_request_checks', result: 'passing' },
      steps: [{ kind: 'add_label', label: 'green' }],
    });
    const c = await linked();
    await pr();
    const suite = (o: Parameters<typeof suitePayload>[0]) =>
      w.deliver('check_suite', suitePayload(o));
    await suite({ suiteId: 1, status: 'in_progress', at: '2026-11-12T10:01:00Z' });
    await suite({ suiteId: 1, conclusion: 'failure', at: '2026-11-12T10:02:00Z' });
    // A second failing suite says nothing new.
    await suite({ suiteId: 2, conclusion: 'failure', at: '2026-11-12T10:03:00Z' });
    await room().alarm();
    let now = await card(c.id);
    expect(now.fields['flagged']).toBe(true);
    expect(now.fields['labels'] ?? []).toEqual([]);
    expect((await runs()).filter((r) => r.ruleName === 'Flag Failing')).toHaveLength(1);
    // Both rerun green: passing.
    await suite({ suiteId: 1, conclusion: 'success', at: '2026-11-12T10:04:00Z' });
    await suite({ suiteId: 2, conclusion: 'success', at: '2026-11-12T10:05:00Z' });
    // An older suite delivery changes nothing.
    await suite({ suiteId: 2, conclusion: 'failure', at: '2026-11-12T10:00:00Z' });
    await room().alarm();
    now = await card(c.id);
    expect(now.fields['labels']).toEqual(['green']);
    expect((await runs()).filter((r) => r.ruleName === 'Label Green')).toHaveLength(1);
  });

  it('queues nothing with no GitHub rule, or for a rule that is off', async () => {
    const c = await linked();
    await pr();
    expect(room().automations.schedule.at).toBeNull();
    const rule = await moveOn({ kind: 'pull_request_opened' }, 'review');
    expect((await w.call('POST', `/${rule.id}/toggle`, { enabled: false })).status).toBe(200);
    await pr({ action: 'reopened', at: '2026-11-12T11:00:00Z' });
    await room().alarm();
    expect(itemStatus(await card(c.id))).toBe('todo');
  });

  it('runs on Test on a Card as if the card’s pull request had done it', async () => {
    const c = await linked();
    const res = await w.call('POST', '/test', {
      rule: {
        name: 'Try',
        trigger: { kind: 'pull_request_merged' },
        conditions: [],
        steps: [{ kind: 'move', status: 'done' }],
        chain: false,
        timeZone: 'Europe/London',
      },
      item: c.id,
    });
    expect(res.status).toBe(200);
    const { run } = await res.json<{ run: AutomationRun }>();
    expect(run.result).toBe('done');
    expect(run.steps[0]).toMatchObject({ text: 'GitHub: a pull request merged' });
    expect(itemStatus(await card(c.id))).toBe('todo');
  });

  it('refuses Who Did It on a GitHub rule, as on a time rule', async () => {
    const res = await w.call('POST', '', {
      name: 'Who',
      trigger: { kind: 'pull_request_opened' },
      conditions: [{ kind: 'who', who: [{ role: 'editor' }] }],
      steps: [{ kind: 'flag' }],
      chain: false,
      timeZone: 'Europe/London',
    });
    expect(res.status).toBe(400);
  });

  it('the connection answers no rules, and the rules route is gone', async () => {
    const view = await (await w.as('owner', 'GET', '/github')).json<GithubConnectionResponse>();
    expect(view.connection).not.toHaveProperty('rules');
    const res = await w.as('owner', 'PUT', '/github/rules', { opened: 'review', merged: null });
    expect(res.status).toBe(404);
  });
});
