import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRun } from '@liveplanner/items';
import type {
  AutomationStepAnswer,
  AutomationStepDoorCall,
  AutomationStepPush,
} from '@liveworkspace/index-client';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, USER, type AutomationWorld } from './test-automation-world';
import { cardDescription, openLinkingCard } from './cross-app-door';
import { withAccounts } from './automation-cross';

// Steps in other apps on a plan (docs/specs/026-plan/automations.md "Steps in other apps"), end to end through the
// real worker and room: a rule here sends its step to the index as its author, and a step from another app makes a
// card here as its author, in its chain. The index is a stand-in client (the real one is index-client's
// pushAutomationStep).
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let answer: AutomationStepAnswer = { ok: true, text: 'Wrote “Release” in “Docs”' };
const pushed: { itemId: string; push: AutomationStepPush }[] = [];
vi.mock('../../index-service', async (original) => {
  const real = await original<typeof import('../../index-service')>();
  return {
    ...real,
    indexAppClient: () => ({
      pushAutomationStep: async (itemId: string, push: AutomationStepPush) => {
        pushed.push({ itemId, push });
        return answer;
      },
    }),
  };
});

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  pushed.length = 0;
  answer = { ok: true, text: 'Wrote “Release” in “Docs”' };
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const room = () => w.plans.get('A')!.room;
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;
const kb = {
  kind: 'kb_page',
  target: { app: 'liveknowledge', item: 'kb1', title: 'Docs' },
  title: 'Release: {{card.title}}',
  body: '{{card.title}} shipped',
};
const move = (id: string, status: string) =>
  w.send('POST', `/api/projects/A/items/${id}/move`, { status });

describe('a plan rule’s step in another app', () => {
  it('goes to the index as its author, its texts filled, and settles its line', async () => {
    const rule = await w.rule({ name: 'Release Note', steps: [kb as never] });
    const card = await w.make('A', { title: 'Search' });
    await move(card.id, 'done');
    await room().alarm();
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'done' });
    expect(run!.steps.at(-1)).toMatchObject({ ok: true, text: 'Wrote “Release” in “Docs”' });
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      itemId: 'A',
      push: {
        author: USER,
        rule: { id: rule.id, name: 'Release Note' },
        step: { title: 'Release: Search', body: 'Search shipped' },
        chain: { hops: 0, rules: [] },
      },
    });
    expect(pushed[0]!.push.from.url).toContain(card.id);
  });

  it('pauses the rule at once when its author lost access', async () => {
    answer = { ok: false, code: 'no_access', reason: '' };
    const rule = await w.rule({ steps: [kb as never] });
    const card = await w.make('A', { title: 'Search' });
    await move(card.id, 'done');
    await room().alarm();
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'failed', reason: 'Stopped: no access to “Docs”' });
    const listed = await (
      await w.call('GET', '')
    ).json<{ rules: { id: string; enabled: boolean }[] }>();
    expect(listed.rules.find((r) => r.id === rule.id)).toMatchObject({ enabled: false });
  });

  it('skips a step that would loop and ends the run Skipped, and fails on any other refusal', async () => {
    answer = { ok: false, code: 'loop', reason: '' };
    await w.rule({ steps: [kb as never] });
    const card = await w.make('A', { title: 'Search' });
    await move(card.id, 'done');
    await room().alarm();
    expect((await runs())[0]).toMatchObject({
      result: 'skipped',
      reason: 'Skipped: would loop back to this rule',
    });
    answer = { ok: false, code: 'failed', reason: 'Too big' };
    await move(card.id, 'todo');
    await move(card.id, 'done');
    await room().alarm();
    expect((await runs())[0]).toMatchObject({ result: 'failed', reason: 'Too big' });
  });

  it('is refused inside an If or a branch, and past five a rule', async () => {
    const inIf = await w.call('POST', '', {
      name: 'x',
      trigger: { kind: 'card_moved', to: ['done'] },
      conditions: [],
      steps: [{ kind: 'if', conditions: [], then: [kb], else: [] }],
      chain: false,
      timeZone: 'Europe/London',
    });
    expect(inIf.status).toBe(400);
    const six = await w.call('POST', '', {
      name: 'y',
      trigger: { kind: 'card_moved', to: ['done'] },
      conditions: [],
      steps: Array.from({ length: 6 }, () => kb),
      chain: false,
      timeZone: 'Europe/London',
    });
    expect(await six.json()).toMatchObject({ message: 'a rule holds up to 5 steps in other apps' });
  });
});

describe('a step from another app on this plan', () => {
  const call = (over: Record<string, unknown> = {}): AutomationStepDoorCall => ({
    author: USER,
    rule: { id: 'r9', name: 'Review Due', app: 'liveknowledge', item: 'kb1' },
    from: { title: 'Handbook', url: 'https://liveknowledge.app/kb/kb1#t=p1' },
    chain: { id: 'c1', hops: 1, rules: ['liveknowledge:kb1:r9'] },
    step: {
      kind: 'plan_card',
      target: { app: 'liveplanner', item: 'A', title: 'Launch' },
      board: 'b1',
      column: 'in progress',
      title: 'Review Onboarding',
      description: 'Check it',
      dueDays: 7,
      linkBack: true,
      skipIfOpen: true,
      ...over,
    },
  });

  it('makes the card on the board’s column as the author, linked back, in the chain', async () => {
    // A rule here that hears the new card and would send a step on carries the chain.
    await w.rule({ name: 'Echo', trigger: { kind: 'card_created' }, steps: [kb as never] });
    const made = await room().automationStep('A', call());
    expect(made).toMatchObject({ ok: true, text: 'Created “Review Onboarding” in Kanban' });
    const card = (await w.items('A')).find((i) => i.fields['title'] === 'Review Onboarding')!;
    expect(card.fields['status']).toBe('doing');
    expect(card.fields['description']).toBe(
      'Check it\n\nFrom Handbook: https://liveknowledge.app/kb/kb1#t=p1',
    );
    expect(card.fields['due']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await room().alarm();
    expect(pushed[0]!.push.chain).toMatchObject({
      id: 'c1',
      hops: 1,
      rules: ['liveknowledge:kb1:r9'],
    });
    // An open card already links back: none more.
    expect(await room().automationStep('A', call())).toMatchObject({
      ok: true,
      text: 'Skipped: an open card already links back (“Review Onboarding”)',
    });
  });

  it('answers a board gone, a step it does not take, and offers its boards to the pickers', async () => {
    expect(await room().automationStep('A', call({ board: 'gone' }))).toMatchObject({
      code: 'target_gone',
    });
    expect(
      await room().automationStep('A', { ...call(), step: { kind: 'doc_tab' } } as never),
    ).toMatchObject({ code: 'invalid' });
    expect(await room().automationTarget('A')).toEqual({
      boards: [{ id: 'b1', name: 'Kanban', columns: expect.arrayContaining(['Done']) }],
      people: expect.any(Array),
    });
  });

  it('words the description and finds an open card that links back', () => {
    const step = call().step as never;
    expect(
      cardDescription({ ...(step as object), description: '', linkBack: false } as never, {
        title: '',
        url: 'u',
      }),
    ).toBe('');
    expect(
      cardDescription({ ...(step as object), description: '' } as never, { title: '', url: 'u' }),
    ).toBe('From Untitled: u');
    const items = [
      { id: 'a', fields: { description: 'see u', status: 'done' } },
      { id: 'b', fields: { description: 'see u', status: 'todo' } },
    ] as never;
    expect(openLinkingCard(items, 'u', (s) => s === 'done')).toMatchObject({ id: 'b' });
    expect(openLinkingCard(items, '', () => false)).toBeUndefined();
  });
});

describe('a Notify from a plan', () => {
  it('names each plan person by the account behind them, and leaves out one the plan lost', () => {
    const accounts = new Map([['p-ana', 'user_ana']]);
    expect(
      withAccounts(
        {
          kind: 'inbox_notice',
          to: [{ person: 'p-ana' }, { person: 'p-gone' }, { value: 'x' }],
          text: 'Hi',
        },
        accounts,
      ),
    ).toEqual({ kind: 'inbox_notice', to: [{ person: 'user_ana' }, { value: 'x' }], text: 'Hi' });
    expect(withAccounts(null, accounts)).toBeNull();
    const kb = {
      kind: 'kb_page',
      target: { app: 'liveknowledge', item: 'k', title: '' },
      title: 't',
      body: 'b',
    } as const;
    expect(withAccounts(kb, accounts)).toBe(kb);
  });
});
