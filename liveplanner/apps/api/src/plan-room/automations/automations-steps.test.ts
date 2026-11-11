import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultCatalogue,
  type AutomationRule,
  type AutomationRun,
  type ItemPerson,
  type ItemTypeDef,
} from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld, type Caller } from './test-automation-world';
import {
  SEND_EMPTY,
  SENDS_UNREACHABLE,
  type AutomationSend,
  type AutomationSendResult,
  type AutomationSendsClient,
} from './automation-sends';

// The Phase 2 steps on a plan's own alarm (docs/specs/026-plan/automations.md "For Related Cards", "Assign in turn",
// "Outgoing actions", "Who may do what"), end to end through the real worker and room. The index's automation sends
// are a stand-in client (the real one is @liveworkspace/index-client's pushAutomationSends).
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let client: AutomationSendsClient | null = null;
vi.mock('./automation-sends', async (original) => ({
  ...(await original<typeof import('./automation-sends')>()),
  sendsClient: () => client,
}));

const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'assignee', 'labels', 'due', 'f-parent'],
  custom: [{ id: 'f-parent', label: 'Parent', kind: 'card', linkType: 'task' }],
};
// A type that leaves out Doing: a related card of it refuses a move there.
const NOTE: ItemTypeDef = {
  id: 'note',
  label: 'Note',
  newTitle: 'New note',
  glyph: 'task',
  color: '#64748b',
  fields: ['title', 'status', 'f-parent'],
  custom: [{ id: 'f-parent', label: 'Parent', kind: 'card', linkType: 'task' }],
  statuses: ['todo', 'done'],
};
const ANA: ItemPerson = { id: 'p-ana', name: 'Ana', color: '#123456' };
const BEN: ItemPerson = { id: 'p-ben', name: 'Ben', color: '#654321' };

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  client = null;
  w = await automationWorld();
  const put = await w.send('PUT', '/api/projects/A/item-types', {
    itemTypes: { version: defaultCatalogue().version, types: [TASK, NOTE] },
  });
  expect(put.status).toBeLessThan(300);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const card = async (id: string) => (await w.items('A')).find((i) => i.id === id)!;
const move = (id: string, status: string) =>
  w.send('POST', `/api/projects/A/items/${id}/move`, { status });
const runs = async (query = '') =>
  (await (await w.call('GET', `/runs${query}`)).json<{ runs: AutomationRun[] }>()).runs;
const listed = async () =>
  (
    await (
      await w.call('GET', '')
    ).json<{
      rules: (AutomationRule & { stats: { failuresInARow: number } })[];
    }>()
  ).rules;

describe('For Related Cards', () => {
  it('writes each related card once, by Automation, and fails a card that refuses alone', async () => {
    const epic = await w.make('A', { title: 'Epic' });
    const one = await w.make('A', { title: 'One', 'f-parent': epic.id });
    const two = await w.make('A', { title: 'Two', 'f-parent': epic.id });
    const note = await w.send('POST', '/api/projects/A/items', {
      type: 'note',
      fields: { title: 'Aside', 'f-parent': epic.id },
      place: { status: 'todo' },
    });
    const noteId = (await note.json<{ item: { id: string; key: number } }>()).item;
    await w.rule({
      steps: [
        {
          kind: 'for',
          related: { kind: 'children' },
          conditions: [],
          then: [
            { kind: 'move', status: 'doing' },
            { kind: 'comment', text: '{{trigger.title}} is done: {{card.title}} can start' },
          ],
        },
      ],
    });
    await move(epic.id, 'done');
    await room().alarm();
    expect((await card(one.id)).fields['status']).toBe('doing');
    expect((await card(two.id)).fields['status']).toBe('doing');
    expect((await card(one.id)).updatedBy).toMatchObject({ id: 'automation' });
    expect((await card(noteId.id)).fields['status']).toBe('todo');
    const threads = plan().db.prepare('SELECT comments FROM card_threads').all();
    expect(threads).toHaveLength(2);
    expect(String(threads[0]!['comments'])).toContain('Epic is done:');
    const [run] = await runs();
    expect(run).toMatchObject({
      result: 'failed',
      reason: `Failed on #${noteId.key}: A Note card can't go in In Progress`,
    });
    expect(run!.steps.find((s) => s.kind === 'branch')).toMatchObject({ ok: false, cards: 3 });
  });
});

describe('Assign in Turn', () => {
  const inTurn = async (extra: Partial<AutomationRule> = {}) => {
    // Ana and Ben are the plan's people through the cards that hold them.
    await w.make('A', { title: 'Ana’s', assignee: ANA });
    await w.make('A', { title: 'Ben’s', assignee: BEN });
    return w.rule({
      name: 'Triage',
      trigger: { kind: 'card_created' },
      steps: [{ kind: 'assign', to: { rotate: [ANA.id, BEN.id] } }],
      ...extra,
    });
  };
  const assignee = async (id: string) =>
    ((await card(id)).fields['assignee'] as ItemPerson | undefined)?.name;

  it('assigns the next person each run, round and round', async () => {
    await inTurn();
    const made = [];
    for (const title of ['A', 'B', 'C']) {
      made.push(await w.make('A', { title }));
      await room().alarm();
    }
    expect(await Promise.all(made.map((c) => assignee(c.id)))).toEqual(['Ana', 'Ben', 'Ana']);
  });

  it('keeps its turn on a failed or unmatched run and on a test', async () => {
    const rule = await inTurn({
      conditions: [{ kind: 'field', field: 'title', op: 'is_not', value: 'skip' }],
      steps: [
        { kind: 'assign', to: { rotate: [ANA.id, BEN.id] } },
        { kind: 'move', status: 'gone-column' },
      ],
    });
    await w.make('A', { title: 'fails' });
    await room().alarm();
    await w.make('A', { title: 'skip' });
    await room().alarm();
    const turn = () =>
      plan().db.prepare('SELECT turn FROM automation_rules WHERE id = ?').get(rule.id)?.['turn'];
    expect(turn()).toBe(0);
    const c = await w.make('A', { title: 'Tried' });
    const test = await w.call('POST', '/test', {
      rule: { ...rule, steps: [rule.steps[0]] },
      item: c.id,
      ruleId: rule.id,
    });
    const { run } = await test.json<{ run: AutomationRun }>();
    expect(run.steps.map((s) => s.text)).toContain('Assign Ana (in turn)');
    expect(turn()).toBe(0);
  });
});

describe('outgoing actions', () => {
  const sent: AutomationSend[][] = [];
  const answering = (answer: (s: AutomationSend) => AutomationSendResult) => {
    sent.length = 0;
    client = {
      pushAutomationSends: (_item, sends) => {
        sent.push([...sends]);
        return Promise.resolve({ results: sends.map(answer) });
      },
    };
  };
  const notifyRule = (text = 'Shipped {{card.title}}') =>
    w.rule({
      name: 'Tell',
      steps: [
        { kind: 'flag' },
        { kind: 'notify', via: 'slack', webhook: 'wh1', name: 'Launch Channel', text },
      ],
    });
  const shipped = async (title = 'Pricing') => {
    const c = await w.make('A', { title });
    await move(c.id, 'done');
    await room().alarm();
    return c;
  };

  it('posts after the card writes, keyed by the run and step, and says it is queued', async () => {
    answering((s) => ({ key: s.key, queued: true }));
    await notifyRule();
    const c = await shipped();
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'done' });
    expect(run!.steps.map((s) => s.text)).toContain('Queued for Launch Channel');
    expect(sent[0]).toEqual([
      {
        key: `${run!.id}:1`,
        webhookId: 'wh1',
        rule: 'Tell',
        card: {
          key: c.key,
          title: 'Pricing',
          url: expect.stringContaining(`/project/A#item=${c.id}`),
        },
        text: 'Shipped Pricing',
        at: expect.any(Number),
      },
    ]);
    expect((await card(c.id)).fields['flagged']).toBe(true);
  });

  it.each([
    ['paused', 'webhook_paused', 'This webhook is paused: the address said it’s gone'],
    ['gone', 'webhook_not_found', 'This webhook is gone'],
    ['full', 'webhook_full', 'Too many messages waiting for this webhook'],
  ] as const)(
    'fails the step when the webhook is %s, with the index’s reason',
    async (_n, code, reason) => {
      answering((s) => ({ key: s.key, queued: false, code, reason }));
      await notifyRule();
      await shipped();
      const [run] = await runs();
      expect(run).toMatchObject({ result: 'failed', reason });
      expect(run!.steps.find((s) => s.text === reason)).toMatchObject({ ok: false });
    },
  );

  it('fails when the index can’t be reached, or with no index at all', async () => {
    client = { pushAutomationSends: () => Promise.reject(new Error('down')) };
    await notifyRule();
    await shipped();
    expect((await runs())[0]).toMatchObject({ result: 'failed', reason: SENDS_UNREACHABLE });
    client = null;
    await shipped('Again');
    expect((await runs())[0]).toMatchObject({ result: 'failed', reason: SENDS_UNREACHABLE });
  });

  it('never sends a message whose values came out empty', async () => {
    answering((s) => ({ key: s.key, queued: true }));
    await notifyRule('{{card.assignee}}');
    await shipped();
    expect(sent).toEqual([]);
    expect((await runs())[0]).toMatchObject({ result: 'failed', reason: SEND_EMPTY });
  });

  it('pauses the rule after ten failures, naming the webhook for Fix Webhook', async () => {
    answering((s) => ({
      key: s.key,
      queued: false,
      code: 'webhook_paused',
      reason: 'This webhook is paused',
    }));
    await notifyRule();
    for (let i = 0; i < 10; i += 1) await shipped(`C${i}`);
    const [rule] = await listed();
    expect(rule).toMatchObject({
      enabled: false,
      paused: { reason: 'This webhook is paused', webhook: 'wh1' },
    });
  });

  it('a test sends nothing and says what it would post', async () => {
    answering((s) => ({ key: s.key, queued: true }));
    const rule = await notifyRule();
    const c = await w.make('A', { title: 'Pricing' });
    const res = await w.call('POST', '/test', { rule, item: c.id });
    const { run } = await res.json<{ run: AutomationRun }>();
    expect(run.steps.map((s) => s.text)).toContain('Would post to Launch Channel: Shipped Pricing');
    expect(sent).toEqual([]);
  });

  // Share roles (docs/instructions/gate-a-feature-by-share-role.md): a rule with an outgoing action is an Editor's
  // of the whole plan, signed in, in person, like every rule.
  it.each([
    ['owner', 201],
    ['team', 201],
    ['editor_link', 201],
    ['tab_editor_link', 403],
    ['participant', 403],
    ['viewer', 403],
    ['token', 403],
    ['guest', 403],
  ] as [Caller, number][])('saving one as %s answers %i', async (who, status) => {
    const res = await w.call(
      'POST',
      '',
      {
        name: `Tell ${who}`,
        trigger: { kind: 'card_moved', to: ['done'] },
        conditions: [],
        steps: [{ kind: 'notify', via: 'teams', webhook: 'wh1', text: 'Hi' }],
        chain: false,
        timeZone: 'UTC',
      },
      who,
    );
    expect(res.status).toBe(status);
  });
});

describe('an agent’s write', () => {
  it('triggers a rule, and Who Did It is an agent holds', async () => {
    await w.rule({
      name: 'Agents',
      conditions: [{ kind: 'who', who: [{ role: 'agent' }] }],
      steps: [{ kind: 'add_label', label: 'by-agent' }],
    });
    const c = await w.make('A', { title: 'Mine' });
    const res = await w.as('token', 'POST', `/items/${c.id}/move`, { status: 'done' });
    expect(res.status).toBe(200);
    const history = plan()
      .db.prepare('SELECT tag FROM item_history ORDER BY rowid DESC LIMIT 1')
      .get();
    expect(history).toEqual({ tag: 'ai' });
    await room().alarm();
    expect((await card(c.id)).fields['labels']).toEqual(['by-agent']);
    const [run] = await runs();
    expect(run!.steps.find((s) => s.kind === 'condition')).toMatchObject({ ok: true });
    // A person's move is not an agent's.
    const d = await w.make('A', { title: 'Theirs' });
    await move(d.id, 'done');
    await room().alarm();
    expect((await card(d.id)).fields['labels']).toBeUndefined();
  });
});
