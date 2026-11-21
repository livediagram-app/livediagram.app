// The item kit's logic, with no screen (blueprint item-ui.md "Tests"): what a rule reads, the pickers' groups,
// Insert a Value's groups, the words, the read-once store, the routes and the outline's builder.
import { describe, expect, it, vi } from 'vitest';
import { defineItemKinds } from '@liveworkspace/automations/item';
import { WEBHOOK_VALUE_GROUP } from '../value-groups';
import {
  ITEM_AUTOMATION_ERRORS,
  createItemAutomationsClient,
  defineItemPlumbing,
  itemAutomationsWords,
} from './plumbing';
import { tabSubject } from './client';
import { lastStepOf, templateShape } from './define-kit';
import { onceStore } from './once-store';
import { buildOutline, listsNamed, snapshotLabel } from './outline';
import {
  actionGroupsOf,
  actionKeysOf,
  groupId,
  itemValueGroups,
  ruleWantsTab as wantsTab,
  summarisedBefore,
  triggerGroupsOf,
} from './rule-reads';
import { firstTab } from './TabAskDialog';
import { ITEM, KINDS, SCOPE, SNAPSHOTS, TEMPLATES } from './test/item-fixtures';
import { incomingExample, wholeWithin } from './panels/trigger-panels';
import { toKey, toOf } from './panels/action-panels';
import { whoKey, whoOf, withNot } from './panels/condition-panels';
import { withTab } from './panels/panel-bits';
import { runOffered } from './ItemRunRule';
import {
  goneLabel,
  needWord,
  needWords,
  pickWords,
  runRefusalWords,
  runToast,
  sharedActionLines,
  sharedTriggerLines,
  startsWhen,
  tileLine,
} from './words';

const names = (groups: readonly { name: string }[]) => groups.map((g) => g.name);

describe('what a rule reads', () => {
  const snapshot = { kind: 'take_snapshot', name: 'x' };
  const ai = { kind: 'ai', task: 'summarise' };
  const inner = { kind: 'email' };
  const branch = { kind: 'if', conditions: [], then: [inner], else: [] };

  it('knows whether a Summarise step stands before a step', () => {
    const body = { steps: [snapshot, ai, branch] };
    expect(summarisedBefore(body, snapshot)).toBe(false);
    expect(summarisedBefore(body, ai)).toBe(false);
    // An action inside an If / Else counts from the If.
    expect(summarisedBefore(body, inner)).toBe(true);
    expect(summarisedBefore(body, branch)).toBe(true);
    expect(summarisedBefore({ steps: [branch, ai] }, inner)).toBe(false);
    // A branch with no Else list, a step the rule lacks, no rule, no step.
    const bare = { kind: 'for', conditions: [], then: [inner] };
    expect(summarisedBefore({ steps: [ai, bare] }, inner)).toBe(true);
    expect(summarisedBefore(body, { kind: 'wait' })).toBe(false);
    expect(summarisedBefore(null, snapshot)).toBe(false);
    expect(summarisedBefore(body, undefined)).toBe(false);
  });

  it('knows whether a rule reads the run’s tab', () => {
    const ruleWantsTab = wantsTab as (rule: { conditions: unknown[]; steps: unknown[] }) => boolean;
    expect(ruleWantsTab({ conditions: [], steps: [snapshot] })).toBe(false);
    expect(ruleWantsTab({ conditions: [{ kind: 'tab', tabs: ['t1'] }], steps: [] })).toBe(true);
    expect(ruleWantsTab({ conditions: [], steps: [{ kind: 'ai', tab: 'run' }] })).toBe(true);
    expect(ruleWantsTab({ conditions: [], steps: [{ kind: 'ai', tab: 't1' }] })).toBe(false);
    expect(
      ruleWantsTab({ conditions: [], steps: [{ kind: 'email', body: 'On {{tab.name}}' }] }),
    ).toBe(true);
    // Inside an If / Else too; a tab named by a trigger's own field is not the run's.
    expect(
      ruleWantsTab({
        conditions: [],
        steps: [{ kind: 'if', conditions: [{ kind: 'tab', tabs: ['t1'] }], then: [], else: [] }],
      }),
    ).toBe(true);
    expect(ruleWantsTab({ conditions: [{ kind: 'weekday', days: [1] }], steps: [null] })).toBe(
      false,
    );
  });
});

describe('the pickers’ groups', () => {
  it('orders Pick a Trigger: the shared groups, the app’s own, then Time and Other', () => {
    const groups = triggerGroupsOf(KINDS);
    expect(names(groups)).toEqual(['Changes', 'Comments', 'People', 'Polls', 'Time', 'Other']);
    expect(groups.find((g) => g.id === 'changes')!.kinds).toEqual([
      'tab_added',
      'tab_removed',
      'edited',
      'snapshot_taken',
    ]);
    expect(groups.find((g) => g.id === 'other')!.kinds).toEqual(['manual', 'incoming_webhook']);
    expect(groups.find((g) => g.id === 'polls')!.kinds).toEqual(['poll_ended']);
  });

  it('orders Add an Action, a message step as three tiles and AI with its allowance', () => {
    const groups = actionGroupsOf(KINDS);
    expect(names(groups)).toEqual([
      'Snapshots',
      'Tabs',
      'Suggestions',
      'Messages',
      'Timing',
      'Other Tools',
      'AI',
    ]);
    expect(groups.find((g) => g.name === 'Other Tools')!.kinds).toEqual([
      'notify_webhook',
      'notify_slack',
      'notify_teams',
    ]);
    expect(groups.find((g) => g.name === 'AI')).toMatchObject({
      kinds: ['ai_summarise'],
      note: '100 a day per document',
    });
    // If / Else is no tile; an app with no tab templates has no Tabs group.
    expect(actionKeysOf(KINDS)).not.toContain('if');
    const plain = defineItemKinds({ itemWord: 'Space', collab: false, tabTemplates: false });
    expect(names(actionGroupsOf(plain))).not.toContain('Tabs');
    expect(names(triggerGroupsOf(plain))).toEqual(['Changes', 'People', 'Time', 'Other']);
    expect(groupId(' Other Tools! ')).toBe('other-tools');
  });
});

describe('Insert a Value', () => {
  const labels = (trigger: string, afterAi = false) =>
    itemValueGroups(KINDS, { trigger: { kind: trigger }, afterAi }).map(
      (g) => `${g.label}: ${g.options.map((o) => o.label).join(', ')}`,
    );

  it('groups the item, the tab, the trigger’s own, who and when', () => {
    expect(labels('comment_added')).toEqual([
      'Document: Document Name, Document Link',
      'Tab: Tab Name, Tab Link',
      'This Trigger: Comment',
      'Who and When: Who Did It, Today, Rule Name, Now',
    ]);
    expect(labels('poll_ended')[2]).toBe('This Trigger: Poll Question');
  });

  it('offers the summary only after a Summarise step, and nobody under a personless trigger', () => {
    expect(labels('scheduled')).toEqual([
      'Document: Document Name, Document Link',
      'Tab: Tab Name, Tab Link',
      'Who and When: Today, Rule Name, Now',
    ]);
    expect(labels('scheduled', true).at(-1)).toBe('AI: AI Summary');
  });

  it('ends an Incoming Webhook rule’s with Webhook Field', () => {
    const groups = itemValueGroups(KINDS, {
      trigger: { kind: 'incoming_webhook' },
      afterAi: false,
    });
    expect(groups.at(-1)).toBe(WEBHOOK_VALUE_GROUP);
  });
});

describe('the words', () => {
  it('says the tool by the item’s word', () => {
    const words = itemAutomationsWords('design', ' Snapshot it every Friday. ');
    expect(words).toMatchObject({
      item: 'design',
      subject: 'tab',
      toolLine: 'Rules this design runs on its own.',
      test: 'Test Rule',
    });
    expect(words.subtitle).toMatch(/^Rules this design runs on its own/);
    expect(words.empty).toBe(
      'A rule watches this design and does the routine steps for you. Snapshot it every Friday. Start from one below or build your own.',
    );
    const track = vi.fn();
    const client = {} as never;
    expect(defineItemPlumbing({ itemWord: 'Space', examples: 'x', client, track })).toMatchObject({
      client,
      track,
      words: { item: 'Space' },
    });
  });

  it('writes a line for every shared kind', () => {
    for (const t of KINDS.triggers.filter((k) => k.kind !== 'poll_ended'))
      expect(sharedTriggerLines('document')[t.kind], t.kind).toMatch(/\.$/);
    for (const key of actionKeysOf(KINDS).filter((k) => k !== 'clear_box'))
      expect(sharedActionLines('document')[key], key).toMatch(/\.$/);
    expect(sharedTriggerLines('Space')['tab_added']).toBe('A tab is added to this Space.');
    expect(tileLine('empties the box')).toBe('Empties the box.');
    expect(tileLine('Done already!')).toBe('Done already!');
    expect(startsWhen('a tab is added.')).toBe('Starts when a tab is added.');
  });

  it('says what a rule needs without an id, each need once', () => {
    expect(needWord({ kind: 'tab', id: 't9' })).toBe('A tab is gone');
    expect(needWord({ kind: 'person', id: 'p9' })).toBe('Someone is gone');
    expect(needWord({ kind: 'snapshot', id: '' })).toBe('Pick a snapshot');
    expect(
      needWords([
        { kind: 'tab', id: 't8' },
        { kind: 'tab', id: 't9' },
        { kind: 'connection', id: '' },
      ]),
    ).toBe('A tab is gone · Pick a connection');
    expect(pickWords('template')).toBe('Pick a template');
    expect(pickWords('column')).toBe('Pick column');
    expect(goneLabel('snapshot', 'Clean board')).toBe('Clean board (No Longer Here)');
    expect(goneLabel('person')).toBe('Someone (No Longer Here)');
  });

  it('says a run from the list, and a refused one', () => {
    expect(runToast('Reset', { result: 'done' })).toEqual({ tone: 'success', text: 'Ran “Reset”' });
    expect(runToast('Reset', { result: 'failed', reason: 'The snapshot is gone' })).toEqual({
      tone: 'error',
      text: 'The snapshot is gone',
    });
    expect(runToast('Reset', { result: 'failed' }).text).toBe('“Reset” didn’t run.');
    expect(runToast('Reset', { result: 'waiting' }).text).toBe('Ran “Reset” up to its Wait.');
    expect(runToast('Reset', { result: 'waiting' }, 'Mon 9:00').text).toBe(
      'Ran “Reset” up to its Wait. It goes on Mon 9:00.',
    );
    expect(runToast('Reset', { result: 'skipped', reason: 'Not today' })).toEqual({
      tone: 'info',
      text: 'Not today',
    });
    expect(runToast('Reset', { result: 'no_match' }).text).toBe('“Reset” found nothing to do.');
    expect(runRefusalWords('automation_budget_spent', 'x', 'document')).toBe(
      'This document has used today’s 1,000 runs. It runs again tomorrow.',
    );
    expect(runRefusalWords('automation_not_manual', 'x', 'document')).toMatch(/Run by Hand/);
    expect(runRefusalWords('automation_not_found', 'x', 'document')).toMatch(/deleted/);
    expect(runRefusalWords('tab_not_found', 'x', 'document')).toMatch(/no longer here/);
    expect(runRefusalWords('automation_invalid', 'As the api said', 'document')).toBe(
      'As the api said',
    );
  });

  it('offers Run Rule on a by-hand rule that is on and not paused', () => {
    const manual = { enabled: true, trigger: { kind: 'manual' } };
    expect(runOffered(manual)).toBe(true);
    expect(runOffered({ ...manual, enabled: false })).toBe(false);
    expect(runOffered({ ...manual, paused: { reason: 'x', at: 0 } })).toBe(false);
    expect(runOffered({ enabled: true, trigger: { kind: 'edited' } })).toBe(false);
  });
});

describe('the panels’ own reads', () => {
  it('keeps a typed number whole and in range', () => {
    expect(wholeWithin('12.7', 1, 365, 1)).toBe(12);
    expect(wholeWithin('900', 1, 365, 1)).toBe(365);
    expect(wholeWithin('-3', 1, 365, 1)).toBe(1);
    expect(wholeWithin('', 1, 365, 7)).toBe(7);
    expect(wholeWithin('abc', 1, 365, 7)).toBe(7);
  });

  it('names the item’s first tab in the Incoming Webhook example, where it can be quoted', () => {
    expect(incomingExample([{ name: 'Roadmap' }])).toBe('{"tab": "Roadmap", "status": "green"}');
    expect(incomingExample([{ name: 'Ana’s "Plan"' }])).toBe(
      '{"tab": "Ana’s \\"Plan\\"", "status": "green"}',
    );
    expect(incomingExample([{ name: "Ana's" }])).toBe('{"status": "green"}');
    expect(incomingExample([])).toBe('{"status": "green"}');
  });

  it('turns picks to parts and back', () => {
    const edited: { kind: string; tab?: string } = { kind: 'edited', tab: 't1' };
    expect(withTab(edited, '')).toEqual({ kind: 'edited' });
    expect(withTab({ ...edited, tab: 't9' }, 't2')).toEqual({ kind: 'edited', tab: 't2' });
    const negated: { kind: string; not?: true } = { kind: 'tab', not: true };
    expect(withNot(negated, false)).toEqual({ kind: 'tab' });
    expect(withNot<typeof negated>({ kind: 'tab' }, true)).toEqual({ kind: 'tab', not: true });
    expect(whoOf(whoKey({ role: 'agent' }))).toEqual({ role: 'agent' });
    expect(whoOf(whoKey({ person: 'p1' }))).toEqual({ person: 'p1' });
    for (const to of [{ owner: true }, { trigger: true }, { person: 'p1' }] as const)
      expect(toOf(toKey(to), to)).toEqual(to);
    const typed = { addresses: ['a@example.test'] };
    expect(toOf(toKey(typed), typed)).toBe(typed);
    expect(toOf('addresses', { owner: true })).toEqual({ addresses: [] });
    expect(firstTab(ITEM.tabs, 't2')).toBe('t2');
    expect(firstTab(ITEM.tabs, 'gone')).toBe('t1');
    expect(firstTab([], null)).toBe('');
  });
});

describe('a template’s shape', () => {
  it('reads its trigger and the step it ends by doing', () => {
    expect(templateShape(TEMPLATES[0]!)).toEqual({ trigger: 'scheduled', step: 'revert_snapshot' });
    // An If / Else that ends the rule: its last action.
    expect(templateShape(TEMPLATES[1]!)).toEqual({ trigger: 'poll_ended', step: 'clear_box' });
    expect(lastStepOf([])).toBeNull();
    const empty = { kind: 'if', conditions: [], then: [], else: [] };
    expect(lastStepOf([empty])).toBe(empty);
    const bare = { kind: 'for', conditions: [], then: [{ kind: 'wait' }] };
    expect(lastStepOf([bare])).toEqual({ kind: 'wait' });
    expect(
      templateShape({
        ...TEMPLATES[0]!,
        build: () => ({
          body: {
            ...TEMPLATES[0]!.build({ tabs: [], people: [], timeZone: 'UTC' }).body,
            steps: [],
          },
          picks: [],
        }),
      }),
    ).toEqual({ trigger: 'scheduled', step: null });
  });
});

describe('a list read once', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('reads the first time it is asked for, and tells whoever listens', async () => {
    const store = onceStore<string>();
    const read = vi.fn(async () => ['a']);
    const heard = vi.fn();
    const off = store.subscribe('k', heard);
    expect(store.get('k')).toEqual({ status: 'idle', list: [] });
    expect(store.get('other')).toBe(store.get('k'));
    store.ask('k', read);
    store.ask('k', read);
    expect(store.get('k').status).toBe('loading');
    await flush();
    expect(store.get('k')).toEqual({ status: 'ready', list: ['a'] });
    store.ask('k', read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledTimes(2);
    off();
    store.retry('k', read);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('reads again on retry after a failure, never while a read is under way', async () => {
    const store = onceStore<string>();
    const read = vi.fn<() => Promise<string[]>>().mockRejectedValueOnce(new Error('offline'));
    store.ask('k', read);
    store.retry('k', read);
    await flush();
    expect(store.get('k').status).toBe('error');
    read.mockResolvedValueOnce(['b']);
    store.retry('k', read);
    await flush();
    expect(store.get('k')).toEqual({ status: 'ready', list: ['b'] });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('forgets the list when its last holder lets go, and drops a read under way', async () => {
    const store = onceStore<string>();
    const one = store.hold('k');
    const two = store.hold('k');
    store.ask('k', async () => ['a']);
    await flush();
    one();
    expect(store.get('k').status).toBe('ready');
    two();
    expect(store.get('k')).toEqual({ status: 'idle', list: [] });
    // Forgotten while idle changes nothing; an answer (or a failure) to a read since forgotten is dropped.
    const again = store.hold('k');
    again();
    for (const read of [async () => ['late'], () => Promise.reject(new Error('late'))]) {
      const held = store.hold('k');
      store.ask('k', read);
      held();
      await flush();
      expect(store.get('k')).toEqual({ status: 'idle', list: [] });
    }
  });
});

describe('the routes', () => {
  it('names the tab a test and a run are about, and nothing for the item alone', async () => {
    expect(tabSubject('t1')).toEqual({ tab: 't1' });
    expect(tabSubject(null)).toEqual({});
    expect(ITEM_AUTOMATION_ERRORS).toContain('tab_not_found');
    expect(ITEM_AUTOMATION_ERRORS).toContain('automation_snapshots_full');
    const sent: { url: string; init: RequestInit }[] = [];
    const client = createItemAutomationsClient({
      base: (scope) => `https://api.test/documents/${scope.itemId}/automations`,
      fetch: async (url, init) => {
        sent.push({ url, init });
        return url.includes('/boom/')
          ? new Response(JSON.stringify({ error: 'tab_not_found' }), { status: 404 })
          : new Response(JSON.stringify({ run: { id: 'run1' } }), { status: 200 });
      },
      headers: async () => ({ 'content-type': 'application/json' }),
      expectOk: async <T>(res: Response) => (await res.json()) as T,
      expectOkVoid: async () => {},
    });
    const rule = { name: 'x' } as never;
    await client.test(SCOPE, rule, 't2');
    await client.run(SCOPE, 'r1', null);
    await client.run(SCOPE, 'r1', 't1');
    expect(sent.map((s) => `${s.init.method} ${s.url} ${s.init.body as string}`)).toEqual([
      'POST https://api.test/documents/d1/automations/test {"rule":{"name":"x"},"tab":"t2"}',
      'POST https://api.test/documents/d1/automations/r1/run {}',
      'POST https://api.test/documents/d1/automations/r1/run {"tab":"t1"}',
    ]);
    // A tab the item lacks is a refusal the screen words, not an error to report.
    await expect(client.run(SCOPE, 'boom', 't9')).rejects.toMatchObject({ code: 'tab_not_found' });
  });
});

describe('the outline', () => {
  const idle = { status: 'idle' as const, list: [] };
  const asks = { ask: () => {}, retry: () => {} };

  it('names and holds only what has been read', () => {
    const before = buildOutline({
      kinds: KINDS,
      item: ITEM,
      templates: [{ id: 'retro', name: 'Retrospective' }],
      snapshots: { ...idle, ...asks },
      connections: idle,
    });
    expect(before.names.tabs!.get('t1')).toBe('Roadmap');
    expect(before.names.templates!.get('retro')).toBe('Retrospective');
    expect(before.names.snapshots).toBeUndefined();
    expect(before.have.snapshot).toBeUndefined();
    expect(before.have.connection).toBeUndefined();
    expect([...before.have.template!]).toEqual(['retro']);
    const after = buildOutline({
      kinds: { itemWord: 'Space', tabTemplates: false },
      item: ITEM,
      templates: [],
      snapshots: { status: 'ready', list: SNAPSHOTS, ...asks },
      connections: { status: 'ready', list: [{ id: 'w1', name: 'Launch Channel' }] },
    });
    expect(after.names.snapshots!.get('s1')).toBe('Clean board');
    expect(after.names.snapshots!.get('s2')).toMatch(/^Snapshot of /);
    expect(after.names.connections!.get('w1')).toBe('Launch Channel');
    expect([...after.have.snapshot!]).toEqual(['s1', 's2']);
    expect(after.have.template).toBeUndefined();
    expect(snapshotLabel({ name: '  ', createdAt: 0 })).toMatch(/^Snapshot of /);
  });

  it('knows which lists the rules name something of', () => {
    expect([...listsNamed(undefined)]).toEqual([]);
    expect([
      ...listsNamed([
        { steps: [{ kind: 'revert_snapshot', snapshot: 's1' }] },
        { steps: [{ kind: 'notify', webhook: '' }] },
        { trigger: { kind: 'edited', tab: 't1' } },
      ]),
    ]).toEqual(['snapshot', 'tab']);
  });
});
