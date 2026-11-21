import { describe, expect, it } from 'vitest';
import { AUTOMATION_AI_SUMMARY_MAX, AUTOMATION_RULES_MAX } from '../limits';
import { TEST_KINDS } from '../room/item/test-kit';
import {
  AI_SUMMARISE_TEXT_MAX,
  collabEvents,
  itemDraftAbout,
  itemDraftSystem,
  itemNames,
  itemPicks,
  itemPicksLeft,
  itemRuleFormat,
  itemRuleSentence,
  itemRuleSummary,
  itemStepLists,
  itemTriggerLine,
  itemValueNames,
  needLine,
  readItemDraft,
  readItemRule,
  readSummary,
  ruleHasStep,
  ruleNeeds,
  ruleNeedsPerson,
  ruleSnapshotIds,
  ruleUnpicked,
  rulesForFile,
  rulesFromFile,
  sentenceText,
  snapshotsFull,
  summariseRequest,
  undescribedKinds,
  type CollabSummary,
  type ItemNames,
  type ItemPart,
  type ItemRule,
  type ItemRuleBody,
  type ItemTemplate,
} from './index';

const outline = {
  tabs: [
    { id: 't1', name: 'Roadmap' },
    { id: 't2', name: 'Retro' },
  ],
  people: [{ id: 'ana', name: 'Ana Costa' }],
};
const names: ItemNames = itemNames('document', outline, {
  snapshots: new Map([['s1', 'Clean board']]),
  connections: new Map([['c1', 'Launch Channel']]),
  templates: new Map([['retro', 'Retrospective']]),
});
const body = (over: Record<string, unknown> = {}) => ({
  name: 'Rule',
  timeZone: 'UTC',
  trigger: { kind: 'joined' },
  conditions: [],
  steps: [],
  ...over,
});
const read = (over: Record<string, unknown>) => readItemRule(body(over), TEST_KINDS);
const refusal = (over: Record<string, unknown>) => {
  const out = read(over);
  return 'error' in out ? [out.error, out.path] : out.body;
};
const steps = (...list: unknown[]) => refusal({ steps: list });
const snap = { kind: 'take_snapshot', name: 'S' };
const revert = { kind: 'revert_snapshot', snapshot: 's1' };
const stamp = { by: { id: 'ana', name: 'Ana Costa', color: '#111' }, at: 5 };
const rule = (over: Partial<ItemRule> = {}): ItemRule => ({
  id: 'r1',
  name: 'Rule',
  timeZone: 'UTC',
  chain: false,
  enabled: true,
  trigger: { kind: 'joined' },
  conditions: [],
  steps: [],
  made: stamp,
  edited: stamp,
  ...over,
});

describe('the shared steps, read', () => {
  it('keeps what each holds and drops the rest', () => {
    expect(
      steps(
        { kind: 'take_snapshot', name: 'Week of {{now.date}}', extra: 1 },
        { kind: 'email', to: { owner: true }, subject: 'S', body: 'B' },
        { kind: 'email', to: { trigger: true }, subject: 'S', body: 'B' },
        { kind: 'email', to: { person: 'ana' }, subject: 'S', body: 'B' },
        {
          kind: 'email',
          to: { addresses: [' Ana@Example.com ', 'ana@example.com'] },
          subject: 'S',
          body: 'B',
        },
        { kind: 'add_tab', template: 'retro', name: 'Retro {{now.date}}' },
        { kind: 'notify', via: 'slack', webhook: 'c1', name: ' Launch ', text: 'Hi' },
        { kind: 'ai', task: 'summarise' },
        { kind: 'ai', task: 'summarise', tab: 'run' },
        { kind: 'ai', task: 'summarise', tab: 't1' },
        { kind: 'wait', hours: 2 },
        { kind: 'clear_box' },
        { kind: 'if', conditions: [{ kind: 'weekday', days: [1] }], then: [snap], else: [] },
        { kind: 'revert_snapshot', snapshot: 's1', name: ' Clean board ' },
      ),
    ).toMatchObject({
      steps: [
        { kind: 'take_snapshot', name: 'Week of {{now.date}}' },
        { to: { owner: true } },
        { to: { trigger: true } },
        { to: { person: 'ana' } },
        { to: { addresses: ['ana@example.com'] } },
        { kind: 'add_tab', template: 'retro' },
        { kind: 'notify', name: 'Launch' },
        { kind: 'ai', task: 'summarise' },
        { kind: 'ai', tab: 'run' },
        { kind: 'ai', tab: 't1' },
        { kind: 'wait', hours: 2 },
        { kind: 'clear_box' },
        { kind: 'if', then: [snap], else: [] },
        { kind: 'revert_snapshot', snapshot: 's1', name: 'Clean board' },
      ],
    });
    const out = read({ steps: [{ kind: 'take_snapshot', name: 'S', extra: 1 }] });
    expect('body' in out && out.body.steps[0]).toEqual(snap);
  });

  it('refuses what a step may not hold', () => {
    const email = (to: unknown) => ({ kind: 'email', to, subject: 'S', body: 'B' });
    expect(steps({ kind: 'take_snapshot', name: '' })).toEqual([
      'automation_invalid',
      'steps.0.name',
    ]);
    expect(steps({ kind: 'take_snapshot', name: '{{nope}}' })).toEqual([
      'automation_value_unknown',
      'steps.0.name',
    ]);
    expect(steps({ kind: 'revert_snapshot', snapshot: '' })).toEqual([
      'automation_invalid',
      'steps.0.snapshot',
    ]);
    expect(steps(email({}))).toEqual(['automation_invalid', 'steps.0.to']);
    expect(steps(email('x'))).toEqual(['automation_invalid', 'steps.0.to']);
    expect(steps(email({ addresses: [] }))).toEqual(['automation_invalid', 'steps.0.to']);
    expect(steps(email({ addresses: ['not an email'] }))).toEqual([
      'automation_invalid',
      'steps.0.to.addresses.0',
    ]);
    expect(steps(email({ addresses: [7] }))).toEqual([
      'automation_invalid',
      'steps.0.to.addresses.0',
    ]);
    expect(steps(email({ person: '' }))).toEqual(['automation_invalid', 'steps.0.to.person']);
    expect(steps({ kind: 'email', to: { owner: true }, subject: '', body: 'B' })).toEqual([
      'automation_invalid',
      'steps.0.subject',
    ]);
    expect(
      refusal({
        trigger: { kind: 'scheduled', every: 'day', at: '09:00' },
        steps: [email({ trigger: true })],
      }),
    ).toEqual(['automation_condition_unsupported', 'steps.0.to']);
    expect(steps({ kind: 'add_tab', template: '', name: 'x' })).toEqual([
      'automation_invalid',
      'steps.0.template',
    ]);
    expect(steps({ kind: 'ai', task: 'triage' })).toEqual(['automation_invalid', 'steps.0.task']);
    expect(steps({ kind: 'ai', task: 'summarise', tab: '' })).toEqual([
      'automation_invalid',
      'steps.0.tab',
    ]);
    expect(steps({ kind: 'notify', via: 'sms', webhook: 'c1', text: 'x' })).toEqual([
      'automation_invalid',
      'steps.0.via',
    ]);
    expect(steps({ kind: 'wait', hours: 0 })).toEqual(['automation_invalid', 'steps.0.hours']);
    expect(steps({ kind: 'nope' })).toEqual(['automation_invalid', 'steps.0.kind']);
    expect(steps('x')).toEqual(['automation_invalid', 'steps.0']);
    expect(steps({ kind: 'if', conditions: [], then: [], else: [] })).toEqual([
      'automation_invalid',
      'steps.0.conditions',
    ]);
  });

  it('holds a rule to its caps', () => {
    expect(steps(...Array.from({ length: 21 }, () => snap))).toEqual([
      'automation_invalid',
      'steps',
    ]);
    const notify = { kind: 'notify', via: 'slack', webhook: 'c1', text: 'x' };
    expect(steps(...Array.from({ length: 6 }, () => notify))).toEqual([
      'automation_invalid',
      'steps',
    ]);
    expect(steps(...Array.from({ length: 4 }, () => ({ kind: 'ai', task: 'summarise' })))).toEqual([
      'automation_invalid',
      'steps',
    ]);
    expect(steps(...Array.from({ length: 4 }, () => ({ kind: 'wait', hours: 1 })))).toEqual([
      'automation_invalid',
      'steps',
    ]);
  });
});

describe('the rules over a whole rule', () => {
  const branch = (then: unknown[], otherwise: unknown[] = []) => ({
    kind: 'if',
    conditions: [{ kind: 'weekday', days: [1] }],
    then,
    else: otherwise,
  });

  it('lets a revert stand only at the rule’s end', () => {
    expect(steps(snap, revert)).toHaveProperty('steps');
    expect(steps(revert, snap)).toEqual(['automation_step_unsupported', 'steps.0']);
    expect(steps(snap, branch([snap, revert], [revert]))).toHaveProperty('steps');
    expect(steps(branch([revert, snap]))).toEqual([
      'automation_step_unsupported',
      'steps.0.then.0',
    ]);
    expect(steps(branch([snap], [revert]), snap)).toEqual([
      'automation_step_unsupported',
      'steps.0.else.0',
    ]);
  });

  it('keeps an If / Else to actions', () => {
    for (const inner of [
      { kind: 'wait', hours: 1 },
      { kind: 'ai', task: 'summarise' },
      { kind: 'notify', via: 'slack', webhook: 'c1', text: 'x' },
      branch([snap]),
    ])
      expect(steps(branch([inner]))).toEqual(['automation_step_unsupported', 'steps.0.then.0']);
    expect(steps(branch('x' as never))).toEqual(['automation_invalid', 'steps.0.then']);
  });

  it('reads {{summary}} only after a Summarise step', () => {
    const ai = { kind: 'ai', task: 'summarise' };
    const uses = { kind: 'take_snapshot', name: 'S {{summary}}' };
    const asks = { kind: 'text', value: 'summary', op: 'contains', text: 'x' };
    expect(steps(ai, uses)).toHaveProperty('steps');
    expect(steps(uses, ai)).toEqual(['automation_value_unknown', 'steps.0']);
    expect(steps(uses)).toEqual(['automation_value_unknown', 'steps.0']);
    expect(refusal({ conditions: [asks], steps: [ai] })).toEqual([
      'automation_value_unknown',
      'conditions',
    ]);
    expect(steps(ai, { ...branch([snap]), conditions: [asks] })).toHaveProperty('steps');
    expect(steps({ ...branch([snap]), conditions: [asks] }, ai)).toEqual([
      'automation_value_unknown',
      'steps.0',
    ]);
    // A snapshot merely called "summary" names no value.
    expect(steps({ kind: 'take_snapshot', name: 'summary' })).toHaveProperty('steps');
  });

  it('knows a trigger’s own values only under that trigger', () => {
    const says = (text: string) => ({ kind: 'take_snapshot', name: text });
    expect(
      refusal({ trigger: { kind: 'comment_added' }, steps: [says('{{comment}}')] }),
    ).toHaveProperty('steps');
    expect(steps(says('{{comment}}'))).toEqual(['automation_value_unknown', 'steps.0.name']);
    expect(
      refusal({ trigger: { kind: 'poll_ended' }, steps: [says('{{poll.question}}')] }),
    ).toHaveProperty('steps');
    expect(steps(says('{{poll.question}}'))).toEqual(['automation_value_unknown', 'steps.0.name']);
    expect(
      refusal({ trigger: { kind: 'incoming_webhook' }, steps: [says('{{webhook.a.b}}')] }),
    ).toHaveProperty('steps');
    expect(steps(says('{{webhook.a}}'))).toEqual(['automation_value_unknown', 'steps.0.name']);
  });

  it('says what a rule holds: a step, a step only a person saves, snapshots, and what is left to pick', () => {
    expect(ruleHasStep({ steps: [] })).toBe(false);
    expect(ruleHasStep({ steps: [{ kind: 'wait', hours: 1 } as ItemPart] })).toBe(false);
    expect(ruleHasStep({ steps: [snap] })).toBe(true);
    expect(ruleNeedsPerson({ steps: [snap] }, TEST_KINDS)).toBe(false);
    expect(ruleNeedsPerson({ steps: [revert] }, TEST_KINDS)).toBe(true);
    expect(ruleNeedsPerson({ steps: [branch([], [revert])] as ItemPart[] }, TEST_KINDS)).toBe(true);
    expect(ruleNeedsPerson({ steps: [{ kind: 'gone_kind' }] }, TEST_KINDS)).toBe(false);
    const reverts = (ids: string[]) =>
      ids.map((id) => ({ steps: [{ kind: 'revert_snapshot', snapshot: id }] }));
    expect(ruleSnapshotIds(reverts(['a', 'b', 'a', '']))).toEqual(['a', 'b']);
    expect(snapshotsFull(reverts(['a', 'b', 'c', 'd', 'e']))).toBe(false);
    expect(snapshotsFull(reverts(['a', 'b', 'c', 'd', 'e', 'f']))).toBe(true);
    expect(
      ruleUnpicked({
        trigger: { kind: 'comment_added', tab: '' },
        conditions: [],
        steps: [
          { kind: 'revert_snapshot', snapshot: '' },
          { kind: 'add_tab', template: 'retro', name: 'x' },
        ],
      }),
    ).toEqual([
      { kind: 'tab', id: '' },
      { kind: 'snapshot', id: '' },
    ]);
    expect(itemValueNames([{ kind: 'text', value: 'comment' }, 'a {{rule}}', 7])).toEqual([
      'comment',
      'rule',
    ]);
  });
});

describe('words', () => {
  const whole: Pick<ItemRuleBody, 'trigger' | 'conditions' | 'steps'> = {
    trigger: { kind: 'comment_added', tab: 't1' },
    conditions: [
      { kind: 'weekday', days: [1] },
      { kind: 'who', who: [{ role: 'editor' }] },
    ],
    steps: [
      { kind: 'take_snapshot', name: 'Kept' },
      { kind: 'revert_snapshot', snapshot: 's1' },
      { kind: 'revert_snapshot', snapshot: 'zz', name: 'Old Name' },
      { kind: 'revert_snapshot', snapshot: 'zz' },
      {
        kind: 'email',
        to: { addresses: ['a@example.com', 'b@example.com'] },
        subject: 'S',
        body: 'B',
      },
      { kind: 'email', to: { person: 'ana' }, subject: 'S', body: 'B' },
      { kind: 'add_tab', template: 'retro', name: 'Retro' },
      { kind: 'notify', via: 'slack', webhook: 'c1', text: 'Hi' },
      { kind: 'ai', task: 'summarise' },
      { kind: 'ai', task: 'summarise', tab: 'run' },
      { kind: 'ai', task: 'summarise', tab: 't2' },
      { kind: 'wait', hours: 48 },
      { kind: 'if', conditions: [], then: [{ kind: 'clear_box' }], else: [] },
      { kind: 'gone_step' },
    ],
  };

  it('makes the Rules list’s sentence from the kinds’ own words', () => {
    expect(sentenceText(itemRuleSentence(whole, TEST_KINDS, names))).toBe(
      'When Comment Added on Roadmap only if today is Monday and it is by an Editor then Take Snapshot “Kept” ' +
        "and Revert to “Clean board” and Revert to “a snapshot that's gone” and Revert to “a snapshot that's gone” " +
        'and Send Email to a@example.com and 1 more and Send Email to Ana Costa and ' +
        'Add a Tab “Retro” from Retrospective and Post to Slack Launch Channel and Summarise with AI and ' +
        'Summarise the Tab with AI and Summarise Retro with AI and Wait 2 Days and If / Else (1 Actions) and gone_step',
    );
    expect(
      itemRuleSentence(
        { trigger: { kind: 'gone' }, conditions: [{ kind: 'gone' }], steps: [] },
        TEST_KINDS,
        names,
      ),
    ).toEqual([{ word: 'When' }, { chip: 'gone' }, { word: 'only if' }, { chip: 'gone' }]);
    // With no list of snapshots or connections, a step reads by the name it kept.
    const bare = itemNames('document', outline);
    expect(
      sentenceText(
        itemRuleSentence(
          {
            trigger: { kind: 'manual' },
            conditions: [],
            steps: [
              { kind: 'revert_snapshot', snapshot: 's9', name: 'Kept Name' },
              { kind: 'notify', via: 'teams', webhook: 'c9', name: 'Ops', text: 'x' },
            ],
          },
          TEST_KINDS,
          bare,
        ),
      ),
    ).toBe('When Run by Hand then Revert to “Kept Name” and Post to Microsoft Teams Ops');
    // Not picked yet: the step's own name and the unpicked word, never a quoted "a snapshot".
    expect(
      sentenceText(
        itemRuleSentence(
          {
            trigger: { kind: 'manual' },
            conditions: [],
            steps: [{ kind: 'revert_snapshot', snapshot: '' }],
          },
          TEST_KINDS,
          bare,
        ),
      ),
    ).toBe('When Run by Hand then Revert to Snapshot (pick one)');
  });

  it('says a run’s first line: who and what, or how long it waited', () => {
    const by = { id: 'ana', name: 'Ana Costa', color: '' };
    const joined = { id: 'e', kind: 'joined', at: 0 };
    expect(
      itemTriggerLine(
        whole,
        { ...joined, kind: 'comment_added', tab: 't1', by },
        TEST_KINDS,
        names,
      ),
    ).toEqual({
      kind: 'trigger',
      text: 'Ana Costa commented on Roadmap',
      by,
    });
    expect(
      itemTriggerLine(whole, { ...joined, kind: 'resume', waited: 26, by }, TEST_KINDS, names),
    ).toEqual({
      kind: 'trigger',
      text: 'After waiting 1 day 2 hours',
    });
    expect(itemTriggerLine({ trigger: { kind: 'gone' } }, joined, TEST_KINDS, names)).toEqual({
      kind: 'trigger',
      text: 'gone',
    });
  });

  it('describes every registered kind to agents, and catches one that is not', () => {
    const format = itemRuleFormat(TEST_KINDS);
    for (const t of TEST_KINDS.triggers) expect(format.trigger).toContain(`"kind":"${t.kind}"`);
    for (const c of TEST_KINDS.conditions)
      expect(format.conditions).toContain(`"kind":"${c.kind}"`);
    for (const a of TEST_KINDS.actions) expect(format.steps).toContain(`"kind":"${a.kind}"`);
    expect(format.trigger).toContain('Nobody is behind scheduled, incoming_webhook, not_edited');
    expect(format.steps).toContain('{{comment}} (only under comment_added)');
    expect(format.steps).toContain('{{summary}} (only after an ai step)');
    expect(format.steps).toContain('{{person}}');
    expect(undescribedKinds(TEST_KINDS)).toEqual([]);
    const undescribed = {
      ...TEST_KINDS,
      actions: [{ ...TEST_KINDS.action('wait')!, format: 'holds the rule' }],
    };
    expect(undescribedKinds(undescribed)).toEqual(['wait']);
  });

  it('says what a rule names that the item lacks, or has still to pick', () => {
    const needs = ruleNeeds(
      {
        trigger: { kind: 'comment_added', tab: 'zz' },
        conditions: [
          { kind: 'tab', tabs: ['t1', ''] },
          { kind: 'who', who: [{ person: 'gone' }] },
        ],
        steps: [
          { kind: 'revert_snapshot', snapshot: 's9' },
          { kind: 'notify', via: 'slack', webhook: 'c9', text: 'x' },
          { kind: 'add_tab', template: 'x', name: 'x' },
        ],
      },
      { tab: new Set(['t1']), person: new Set(['ana']), snapshot: new Set(['s1']) },
    );
    expect(needs).toEqual([
      { kind: 'tab', id: 'zz' },
      { kind: 'tab', id: '' },
      { kind: 'person', id: 'gone' },
      { kind: 'snapshot', id: 's9' },
    ]);
    expect(needs.map(needLine)).toEqual([
      'Tab zz is gone',
      'Pick a tab',
      'Person gone is gone',
      'Snapshot s9 is gone',
    ]);
    expect(needLine({ kind: 'connection', id: 'c' })).toBe('Connection c is gone');
    expect(needLine({ kind: 'template', id: '' })).toBe('Pick a template');
  });

  it('summarises a rule for a reader: no address, no connection’s name, no AI ask', () => {
    const summary = itemRuleSummary(
      rule({
        ...whole,
        conditions: [
          { kind: 'text', value: 'comment', op: 'contains', text: 'ana@example.com' },
          { kind: 'gone', text: 'x@y.example' },
          { kind: 'weekday', days: [1] },
        ],
        steps: [
          ...whole.steps.slice(4, 6),
          whole.steps[7]!,
          whole.steps[8]!,
          whole.steps[11]!,
          {
            kind: 'if',
            conditions: [{ kind: 'weekday', days: [2] }],
            then: [{ kind: 'email', to: { owner: true }, subject: 'S', body: 'B' }],
            else: [{ kind: 'email', to: { trigger: true }, subject: 'S', body: 'B' }],
          },
          { kind: 'gone_step' },
          { kind: 'clear_box' },
        ],
        paused: { reason: 'x', at: 1 },
      }),
      TEST_KINDS,
      names,
    );
    expect(summary).toEqual({
      id: 'r1',
      name: 'Rule',
      on: true,
      paused: true,
      trigger: 'Comment Added on Roadmap',
      picks: false,
      conditions: ['Text', 'gone', 'today is Monday'],
      steps: [
        { kind: 'email', words: 'Send Email to typed-in addresses' },
        { kind: 'email', words: 'Send Email to a person' },
        { kind: 'notify', via: 'slack', words: 'Post to Slack' },
        { kind: 'ai', words: 'An AI Step' },
        { kind: 'wait', words: 'Wait' },
        {
          kind: 'if',
          words: 'If / Else',
          conditions: ['today is Tuesday'],
          then: [{ kind: 'email', words: 'Send Email to the owner' }],
          else: [{ kind: 'email', words: 'Send Email to whoever started it' }],
        },
        { kind: 'gone_step', words: 'gone_step' },
        { kind: 'clear_box', words: 'Clear the Box' },
      ],
      made: { by: 'Ana Costa', at: 5 },
    });
    expect(
      itemRuleSummary(
        rule({ steps: [snap, revert, { kind: 'add_tab', template: 'x', name: 'y' }] }),
        TEST_KINDS,
        names,
      ).steps,
    ).toEqual([
      { kind: 'take_snapshot', words: 'Take Snapshot' },
      { kind: 'revert_snapshot', words: 'Revert to Snapshot' },
      { kind: 'add_tab', words: 'Add a Tab from a Template' },
    ]);
  });
});

describe('the collab diff', () => {
  const thread = (over: Partial<CollabSummary['threads'][number]> = {}) => ({
    elementId: 'el1',
    resolved: false,
    commentCount: 1,
    latestText: 'First',
    latestAuthorId: 'ben',
    latestAuthorName: 'Ben Okafor',
    ...over,
  });
  const action = (over: Partial<CollabSummary['actions'][number]> = {}) => ({
    elementId: 'el1',
    actionId: 'a1',
    name: 'Ship it',
    status: 'open',
    assigneeId: null,
    ...over,
  });
  const about = { tab: 't1', at: 100 };
  const none: CollabSummary = { threads: [], actions: [] };
  const kinds = (before: CollabSummary | null, after: CollabSummary) =>
    collabEvents(before, after, about).map((e) => e.kind);

  it('makes no event from the first summary it ever sees', () => {
    expect(
      collabEvents(null, { threads: [thread()], actions: [action({ status: 'done' })] }, about),
    ).toEqual([]);
  });

  it('hears a new thread and a reply, with the comment’s opening and its author', () => {
    const started = collabEvents(
      none,
      {
        threads: [thread({ latestText: 'x'.repeat(600), latestAuthorColor: '#abc' })],
        actions: [],
      },
      {
        ...about,
        role: 'participant',
      },
    );
    expect(started).toEqual([
      {
        id: 'c:t1:el1:1',
        kind: 'comment_added',
        at: 100,
        tab: 't1',
        by: { id: 'ben', name: 'Ben Okafor', color: '#abc' },
        role: 'participant',
        data: { comment: 'x'.repeat(500) },
      },
    ]);
    const replied = collabEvents(
      { threads: [thread()], actions: [] },
      {
        threads: [thread({ commentCount: 2, latestAuthorId: null, latestAuthorName: 'A Guest' })],
        actions: [],
      },
      about,
    );
    expect(replied).toMatchObject([
      { id: 'c:t1:el1:2', by: { id: '', name: 'A Guest', color: '' } },
    ]);
    expect(replied[0]).not.toHaveProperty('role');
    expect(
      kinds({ threads: [thread()], actions: [] }, { threads: [thread()], actions: [] }),
    ).toEqual([]);
  });

  it('never hears Automation’s own comment', () => {
    expect(
      kinds(none, { threads: [thread({ latestAuthorId: 'automation' })], actions: [] }),
    ).toEqual([]);
  });

  it('hears a thread resolved, and the last open one on the tab', () => {
    const by = { id: 'ana', name: 'Ana Costa', color: '' };
    const before = { threads: [thread(), thread({ elementId: 'el2' })], actions: [] };
    const one = collabEvents(
      before,
      { threads: [thread({ resolved: true }), thread({ elementId: 'el2' })], actions: [] },
      {
        ...about,
        by,
        role: 'editor',
      },
    );
    expect(one).toEqual([
      { id: 'r:t1:el1:100', kind: 'thread_resolved', at: 100, tab: 't1', by, role: 'editor' },
    ]);
    const last = {
      threads: [thread({ resolved: true }), thread({ elementId: 'el2', resolved: true })],
      actions: [],
    };
    expect(kinds(before, last)).toEqual(['thread_resolved', 'thread_resolved', 'threads_resolved']);
    // A thread that arrives resolved resolves nothing.
    expect(
      kinds(none, { threads: [thread({ resolved: true, commentCount: 0 })], actions: [] }),
    ).toEqual([]);
  });

  it('hears an action assigned and an action done', () => {
    const before = { threads: [], actions: [action()] };
    const assigned = collabEvents(
      before,
      { threads: [], actions: [action({ assigneeId: 'ana', assigneeName: 'Ana Costa' })] },
      about,
    );
    expect(assigned).toEqual([
      {
        id: 'a:t1:a1:ana:100',
        kind: 'action_assigned',
        at: 100,
        tab: 't1',
        data: { action: 'Ship it', assignee: 'Ana Costa' },
      },
    ]);
    expect(kinds(before, { threads: [], actions: [action({ status: 'done' })] })).toEqual([
      'action_done',
    ]);
    expect(
      kinds(none, { threads: [], actions: [action({ assigneeId: 'ana', status: 'done' })] }),
    ).toEqual(['action_assigned', 'action_done']);
    const same = { threads: [], actions: [action({ assigneeId: 'ana', status: 'done' })] };
    expect(kinds(same, same)).toEqual([]);
    expect(
      collabEvents(none, { threads: [], actions: [action({ assigneeId: 'ana' })] }, about)[0]!.data,
    ).toEqual({
      action: 'Ship it',
      assignee: '',
    });
  });
});

describe('AI', () => {
  it('asks for a summary of the text, cut to its budget', () => {
    const request = summariseRequest('x'.repeat(AI_SUMMARISE_TEXT_MAX + 50));
    expect(request.messages[0]!.role).toBe('system');
    const sent = JSON.parse(request.messages[1]!.content) as { text: string };
    expect(sent.text.length).toBeLessThanOrEqual(AI_SUMMARISE_TEXT_MAX);
    expect(request.response_format.json_schema.name).toBe('automation_summary');
  });

  it('reads the answer as plain text with no link the text lacked', () => {
    expect(
      readSummary(
        { response: { summary: 'See **this** https://evil.example and https://ok.example/a' } },
        'x https://ok.example/a',
      ),
    ).toBe('See this and https://ok.example/a');
    expect(
      readSummary({ response: { summary: 'word '.repeat(400) } }, '')!.length,
    ).toBeLessThanOrEqual(AUTOMATION_AI_SUMMARY_MAX);
    expect(readSummary({ response: { summary: 7 } }, '')).toBeNull();
    expect(readSummary('nothing', '')).toBeNull();
    expect(readSummary({ response: { summary: '' } }, '')).toBe('');
  });

  it('tells Describe a Rule’s model the kinds and the tabs’ names, nothing else', () => {
    const system = itemDraftSystem(TEST_KINDS);
    expect(system).toContain('one automation rule for a document');
    expect(system).toContain('"kind":"everyone_left"');
    expect(system).toContain('"kind":"clear_box"');
    const about = itemDraftAbout({
      tabs: [
        { id: 't1', name: `Road\u0007map ${'x'.repeat(60)}` },
        ...Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, name: `T${i}` })),
      ],
    });
    expect(about.item.tabs).toHaveLength(40);
    expect(about.item.tabs[0]!.length).toBeLessThanOrEqual(40);
    expect(about.item.tabs[0]).not.toContain('\u0007');
  });

  it('reads a drafted rule: tabs back to ids, what the model could not know left to pick, texts cleaned', () => {
    const ctx = {
      prompt: 'post to https://mine.example when commented',
      timeZone: 'UTC',
      rules: [],
    };
    const out = readItemDraft(
      {
        outcome: 'rule',
        rule: {
          name: '',
          trigger: { kind: 'comment_added', tab: 'ROADMAP' },
          conditions: [{ kind: 'who', who: [{ person: 'Ana' }] }],
          steps: [
            {
              kind: 'email',
              to: { owner: true },
              subject: 'New\ncomment',
              body: 'See https://mine.example\nand https://evil.example',
            },
            {
              kind: 'if',
              conditions: [{ kind: 'tab', tabs: ['t2', 'Nope'] }],
              then: [{ kind: 'add_tab', template: 'retro', name: 'Retro' }, 'junk'],
              else: 'junk',
            },
          ],
        },
      },
      ctx,
      TEST_KINDS,
      outline,
    );
    expect(out).toEqual({
      refused: { path: 'steps.1.then.1', message: 'steps.1.then.1 must be an object' },
    });
    const good = readItemDraft(
      {
        outcome: 'rule',
        rule: {
          name: '',
          trigger: { kind: 'comment_added', tab: 'ROADMAP' },
          conditions: [{ kind: 'who', who: [{ person: 'Ana' }] }],
          steps: [
            {
              kind: 'email',
              to: { owner: true },
              subject: 'New\ncomment',
              body: 'See https://mine.example\nand https://evil.example',
            },
            {
              kind: 'if',
              conditions: [{ kind: 'tab', tabs: ['t2', 'Nope'] }],
              then: [{ kind: 'add_tab', template: 'retro', name: 'Retro' }],
              else: [{ kind: 'revert_snapshot', snapshot: 'x' }],
            },
          ],
        },
      },
      ctx,
      TEST_KINDS,
      outline,
    );
    expect(good).toEqual({
      body: {
        name: 'New Rule',
        trigger: { kind: 'comment_added', tab: 't1' },
        conditions: [{ kind: 'who', who: [{ person: '' }] }],
        steps: [
          {
            kind: 'email',
            to: { owner: true },
            subject: 'New comment',
            body: 'See https://mine.example\nand',
          },
          {
            kind: 'if',
            conditions: [{ kind: 'tab', tabs: ['t2', ''] }],
            then: [{ kind: 'add_tab', template: '', name: 'Retro' }],
            else: [{ kind: 'revert_snapshot', snapshot: '' }],
          },
        ],
        chain: false,
        timeZone: 'UTC',
      },
      picks: [
        { path: 'conditions.0', pick: 'person' },
        { path: 'steps.1', pick: 'tab' },
        { path: 'steps.1.then.0', pick: 'template' },
        { path: 'steps.1.else.0', pick: 'snapshot' },
      ],
    });
    expect(readItemDraft({ outcome: 'not_a_rule' }, ctx, TEST_KINDS, outline)).toEqual({
      off: true,
    });
  });
});

describe('templates', () => {
  const template: ItemTemplate<'reset', 'workshops'> = {
    id: 'reset',
    name: 'Reset Every Night',
    description: 'Every day at 00:00, revert to a snapshot',
    category: 'workshops',
    build: (item) => {
      const body: ItemRuleBody = {
        name: 'Reset Every Night',
        trigger: { kind: 'comment_added', tab: item.tabs[9]?.id ?? '' },
        conditions: [{ kind: 'who', who: [{ person: '' }] }],
        steps: [
          { kind: 'revert_snapshot', snapshot: '' },
          { kind: 'notify', via: 'slack', webhook: '', text: 'Reset' },
          {
            kind: 'if',
            conditions: [{ kind: 'tab', tabs: [''] }],
            then: [{ kind: 'add_tab', template: '', name: 'x' }],
            else: [{ kind: 'take_snapshot', name: 'x' }],
          },
        ],
        chain: false,
        timeZone: item.timeZone,
      };
      return { body, picks: itemPicks(body) };
    },
  };

  it('names every empty reference as a pick, and drops one once it is picked or its step is gone', () => {
    const { body, picks } = template.build({ ...outline, timeZone: 'UTC' });
    expect(picks).toEqual([
      { path: 'trigger', pick: 'tab' },
      { path: 'conditions.0', pick: 'person' },
      { path: 'steps.0', pick: 'snapshot' },
      { path: 'steps.1', pick: 'connection' },
      { path: 'steps.2', pick: 'tab' },
      { path: 'steps.2.then.0', pick: 'template' },
    ]);
    expect(itemPicksLeft(body, picks)).toEqual(picks);
    const picked: ItemRuleBody = {
      ...body,
      trigger: { kind: 'comment_added', tab: 't1' },
      steps: [{ kind: 'revert_snapshot', snapshot: 's1' }, body.steps[1]!],
    };
    expect(itemPicksLeft(picked, picks)).toEqual([
      { path: 'conditions.0', pick: 'person' },
      { path: 'steps.1', pick: 'connection' },
    ]);
    expect(itemStepLists(body.steps[2]!, 'then')).toHaveLength(1);
    expect(itemStepLists(body.steps[2]!, 'else')).toHaveLength(1);
    expect(itemStepLists(body.steps[2]!, 'conditions')).toBeUndefined();
    expect(itemStepLists(body.steps[0]!, 'then')).toBeUndefined();
  });
});

describe('rules in a file', () => {
  const stored = [
    rule({
      name: 'Tell Slack',
      trigger: { kind: 'comment_added', tab: 't1' },
      steps: [
        { kind: 'notify', via: 'slack', webhook: 'c1', name: 'Launch Channel', text: 'Hi' },
        { kind: 'revert_snapshot', snapshot: 's1' },
      ],
      paused: { reason: 'x', at: 1 },
    }),
    rule({ id: 'r2', name: 'Plain', steps: [snap], enabled: false }),
  ];
  let made = 0;
  const opts = { stamp, newId: () => `new-${(made += 1)}` };

  it('keeps each rule’s body and whether it was on, nothing else', () => {
    expect(rulesForFile(stored)).toEqual([
      {
        name: 'Tell Slack',
        trigger: stored[0]!.trigger,
        conditions: [],
        steps: stored[0]!.steps,
        chain: false,
        timeZone: 'UTC',
        enabled: true,
      },
      {
        name: 'Plain',
        trigger: { kind: 'joined' },
        conditions: [],
        steps: [snap],
        chain: false,
        timeZone: 'UTC',
        enabled: false,
      },
    ]);
  });

  it('reads them back as they were, under new ids', () => {
    const { rules, dropped } = rulesFromFile(rulesForFile(stored), TEST_KINDS, opts);
    expect(dropped).toBe(0);
    expect(rules).toMatchObject([
      { name: 'Tell Slack', enabled: true, trigger: { tab: 't1' }, made: stamp, edited: stamp },
      { name: 'Plain', enabled: false },
    ]);
    expect(rules[0]!.steps).toEqual(stored[0]!.steps);
    expect(rules[0]!.id).not.toBe('r1');
    expect(rules[0]).not.toHaveProperty('paused');
    expect(rulesFromFile(rulesForFile(stored), TEST_KINDS, { stamp }).rules[0]!.id).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it('gives a copy its rules off, tabs remapped, snapshots and connections left to pick', () => {
    const file = [
      ...rulesForFile(stored),
      { ...rulesForFile(stored)[0]!, trigger: { kind: 'comment_added', tab: 'unmapped' } },
    ];
    const { rules } = rulesFromFile(file, TEST_KINDS, {
      ...opts,
      copy: true,
      tabs: new Map([['t1', 'copy-t1']]),
    });
    expect(rules.map((r) => [r.name, r.enabled])).toEqual([
      ['Tell Slack', false],
      ['Plain', false],
      ['Tell Slack 2', false],
    ]);
    expect(rules[0]).toMatchObject({
      trigger: { kind: 'comment_added', tab: 'copy-t1' },
      steps: [
        { kind: 'notify', via: 'slack', webhook: '', text: 'Hi' },
        { kind: 'revert_snapshot', snapshot: '' },
      ],
    });
    expect(rules[0]!.steps[0]).not.toHaveProperty('name');
    expect(rules[2]!.trigger).toEqual({ kind: 'comment_added', tab: '' });
  });

  it('keeps a rule off while it has something to pick or no step, drops what does not read, and caps the count', () => {
    const { rules, dropped } = rulesFromFile(
      [
        {
          ...rulesForFile(stored)[1]!,
          enabled: true,
          steps: [{ kind: 'revert_snapshot', snapshot: '' }],
        },
        { ...rulesForFile(stored)[1]!, name: 'No Step', enabled: true, steps: [] },
        { ...rulesForFile(stored)[1]!, name: 'On', enabled: true },
        { name: 'From Another App', trigger: { kind: 'card_moved' } },
        'junk',
      ],
      TEST_KINDS,
      opts,
    );
    expect(rules.map((r) => [r.name, r.enabled])).toEqual([
      ['Plain', false],
      ['No Step', false],
      ['On', true],
    ]);
    expect(dropped).toBe(2);
    expect(rulesFromFile('junk', TEST_KINDS, opts)).toEqual({ rules: [], dropped: 0 });
    const many = Array.from({ length: AUTOMATION_RULES_MAX + 5 }, () => rulesForFile(stored)[1]!);
    expect(rulesFromFile(many, TEST_KINDS, opts).rules).toHaveLength(AUTOMATION_RULES_MAX);
  });
});
