import { describe, expect, it } from 'vitest';
import { TEST_KINDS } from '../room/item/test-kit';
import type { ItemHoldContext, ItemNames } from './index';
import {
  GONE_NAMES,
  UNPICKED_NAMES,
  defineItemKinds,
  defineTrigger,
  eventTabName,
  eventWho,
  itemNames,
  itemValueKnown,
  itemValueOptions,
  itemValueResolver,
  itemWordTitle,
  mapRefs,
  quietWords,
  readItemRule,
  refName,
  refsOf,
  scheduledWords,
  weekdayName,
  type ItemEvent,
  type ItemPart,
} from './index';

const names: ItemNames = itemNames(
  'document',
  {
    tabs: [
      { id: 't1', name: 'Roadmap' },
      { id: 't2', name: 'Retro' },
    ],
    people: [{ id: 'ana', name: 'Ana Costa' }],
  },
  { snapshots: new Map([['s1', 'Clean board']]), connections: new Map([['c1', 'Launch Channel']]) },
);
const event = (over: Partial<ItemEvent> = {}): ItemEvent => ({
  id: 'e',
  kind: 'joined',
  at: 0,
  ...over,
});
const body = (over: Record<string, unknown>) => ({
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

describe('the registry', () => {
  it('holds the shared kinds and the app’s own, by kind', () => {
    expect(TEST_KINDS.triggers.map((t) => t.kind)).toEqual([
      'scheduled',
      'manual',
      'incoming_webhook',
      'tab_added',
      'tab_removed',
      'edited',
      'not_edited',
      'snapshot_taken',
      'joined',
      'access_requested',
      'comment_added',
      'thread_resolved',
      'threads_resolved',
      'action_assigned',
      'action_done',
      'everyone_left',
      'poll_ended',
      'agent_changed',
    ]);
    expect(TEST_KINDS.conditions.map((c) => c.kind)).toEqual(['tab', 'who', 'weekday', 'text']);
    expect(TEST_KINDS.actions.map((a) => a.kind)).toEqual([
      'take_snapshot',
      'revert_snapshot',
      'email',
      'add_tab',
      'notify',
      'ai',
      'wait',
      'if',
      'plan_card',
      'kb_page',
      'space_post',
      'doc_tab',
      'inbox_notice',
      'clear_box',
      'unwired',
    ]);
    expect(TEST_KINDS.trigger('edited')!.name).toBe('Edited, Then Quiet');
    expect(TEST_KINDS.condition('who')!.personal).toBe(true);
    expect(TEST_KINDS.action('revert_snapshot')).toMatchObject({ last: true, needsPerson: true });
    expect(TEST_KINDS.value('poll.question')!.label).toBe('Poll Question');
    expect(TEST_KINDS.trigger('nope')).toBeUndefined();
    expect(TEST_KINDS).toMatchObject({ itemWord: 'document', collab: true, tabTemplates: true });
  });

  it('leaves out the comment triggers and Add a Tab where the app has neither, and names values its way', () => {
    const plain = defineItemKinds({ itemWord: 'Space', collab: false, tabTemplates: false });
    expect(plain.triggers.some((t) => t.collab)).toBe(false);
    expect(plain.trigger('comment_added')).toBeUndefined();
    expect(plain.action('add_tab')).toBeUndefined();
    expect(plain.value('item.name')!.label).toBe('Space Name');
    expect(
      defineItemKinds({ itemWord: 'design', collab: true, tabTemplates: true }).value('item.url')!
        .label,
    ).toBe('Design Link');
    expect(itemWordTitle('plan')).toBe('Plan');
  });

  it('refuses a kind defined twice', () => {
    const twice = defineTrigger({ ...TEST_KINDS.trigger('manual')! });
    expect(() =>
      defineItemKinds({
        itemWord: 'document',
        collab: true,
        tabTemplates: true,
        triggers: [twice],
      }),
    ).toThrow('automation kind defined twice: manual');
  });

  it('gives every kind a default the builder starts from, and words for it', () => {
    for (const def of [...TEST_KINDS.triggers, ...TEST_KINDS.conditions, ...TEST_KINDS.actions]) {
      const part = def.defaults();
      expect(part.kind).toBe(def.kind);
      expect(def.words(part as never, names).length).toBeGreaterThan(0);
      expect(def.name).toMatch(/^[A-Z]/);
      expect(def.line.length).toBeGreaterThan(0);
      expect(def.group.length).toBeGreaterThan(0);
    }
    for (const def of TEST_KINDS.actions)
      expect(def.would(def.defaults(), { fill: (text) => text, names })).toMatch(/^Would /);
  });
});

describe('names and references', () => {
  it('names a reference, or says it is gone or not picked', () => {
    expect(refName(names, 'tab', 't1')).toBe('Roadmap');
    expect(refName(names, 'tab', 'zz')).toBe(GONE_NAMES.tab);
    expect(refName(names, 'tab', '')).toBe(UNPICKED_NAMES.tab);
    expect(refName(names, 'template', 'x')).toBe(UNPICKED_NAMES.template);
    expect(refName(names, 'person', 'ana')).toBe('Ana Costa');
  });

  it('lists and rewrites what a part names, by field, wherever it sits', () => {
    const rule = {
      trigger: { kind: 'comment_added', tab: 't1' },
      conditions: [
        { kind: 'tab', tabs: ['t1', 't2', 7] },
        { kind: 'who', who: [{ person: 'ana' }, { role: 'editor' }] },
      ],
      steps: [
        { kind: 'ai', task: 'summarise', tab: 'run' },
        { kind: 'notify', via: 'slack', webhook: 'c1', text: 'tab' },
        {
          kind: 'if',
          conditions: [],
          then: [{ kind: 'revert_snapshot', snapshot: 's1' }],
          else: [
            { kind: 'add_tab', template: 'retro', name: 'x' },
            { kind: 'email', to: { person: 'ana' } },
          ],
        },
      ],
      // Only a tab may be the run's own: a snapshot called "run" is a snapshot.
      extra: { snapshot: 'run' },
      constructor: 'not a reference',
      count: 3,
    };
    expect(refsOf(rule)).toEqual([
      { kind: 'tab', id: 't1' },
      { kind: 'tab', id: 't2' },
      { kind: 'person', id: 'ana' },
      { kind: 'connection', id: 'c1' },
      { kind: 'snapshot', id: 's1' },
      { kind: 'template', id: 'retro' },
      { kind: 'snapshot', id: 'run' },
    ]);
    const mapped = mapRefs(rule, (ref) => `${ref.kind}:${ref.id}`);
    expect(mapped.trigger.tab).toBe('tab:t1');
    expect(mapped.conditions[0]!.tabs).toEqual(['tab:t1', 'tab:t2', 7]);
    expect(mapped.steps[0]!.tab).toBe('run');
    expect(mapped.steps[1]).toMatchObject({ webhook: 'connection:c1', text: 'tab' });
    expect(rule.trigger.tab).toBe('t1');
    expect(mapped.count).toBe(3);
  });
});

describe('the shared triggers', () => {
  const trigger = (kind: string) => TEST_KINDS.trigger(kind)!;

  it('say a schedule, a quiet stretch and a weekday in words', () => {
    expect(scheduledWords({ kind: 'scheduled', every: 'day', at: '09:00' })).toBe(
      'Every Day at 9:00',
    );
    expect(scheduledWords({ kind: 'scheduled', every: 'weekday', at: '17:45' })).toBe(
      'Every Weekday at 17:45',
    );
    expect(scheduledWords({ kind: 'scheduled', every: 'day', at: '00:00' })).toBe(
      'Every Day at Midnight',
    );
    expect(scheduledWords({ kind: 'scheduled', every: 'weekday', at: '12:00' })).toBe(
      'Every Weekday at Noon',
    );
    expect(scheduledWords({ kind: 'scheduled', every: 'week', days: [1, 5], at: '09:00' })).toBe(
      'Weekly on Monday, Friday at 9:00',
    );
    expect(scheduledWords({ kind: 'scheduled', every: 'month', dayOfMonth: 15, at: '09:00' })).toBe(
      'Monthly on Day 15 at 9:00',
    );
    expect([5, 60, 90, 120, 61].map(quietWords)).toEqual([
      '5 Minutes',
      '1 Hour',
      '1 Hour 30 Minutes',
      '2 Hours',
      '1 Hour 1 Minute',
    ]);
    expect(weekdayName(0)).toBe('Sunday');
  });

  it('read their own fields and refuse what is out of range', () => {
    expect(
      refusal({ trigger: { kind: 'edited', minutes: 30, tab: 't1', extra: 1 } }),
    ).toMatchObject({
      trigger: { kind: 'edited', minutes: 30, tab: 't1' },
    });
    expect(refusal({ trigger: { kind: 'edited', minutes: 4 } })).toEqual([
      'automation_invalid',
      'trigger.minutes',
    ]);
    expect(refusal({ trigger: { kind: 'edited', minutes: 1441 } })).toEqual([
      'automation_invalid',
      'trigger.minutes',
    ]);
    expect(refusal({ trigger: { kind: 'not_edited', days: 0, at: '09:00' } })).toEqual([
      'automation_invalid',
      'trigger.days',
    ]);
    expect(refusal({ trigger: { kind: 'not_edited', days: 366, at: '09:00' } })).toEqual([
      'automation_invalid',
      'trigger.days',
    ]);
    expect(refusal({ trigger: { kind: 'not_edited', days: 3, at: '09:10' } })).toEqual([
      'automation_invalid',
      'trigger.at',
    ]);
    expect(refusal({ trigger: { kind: 'comment_added', tab: '' } })).toEqual([
      'automation_invalid',
      'trigger.tab',
    ]);
    expect(refusal({ trigger: { kind: 'tab_added', tab: 't1' } })).toMatchObject({
      trigger: { kind: 'tab_added' },
    });
    expect(refusal({ trigger: { kind: 'scheduled', every: 'hour', at: '09:00' } })).toEqual([
      'automation_invalid',
      'trigger.every',
    ]);
    expect(refusal({ trigger: { kind: 'nope' } })).toEqual(['automation_invalid', 'trigger.kind']);
    expect(refusal({ trigger: {} })).toEqual(['automation_invalid', 'trigger.kind']);
    expect(refusal({ trigger: 'x' })).toEqual(['automation_invalid', 'trigger']);
    for (const kind of ['manual', 'incoming_webhook', 'everyone_left', 'poll_ended'])
      expect(read({ trigger: { ...trigger(kind).defaults() } })).toHaveProperty('body');
  });

  it('match an event on their tab, and only the engine’s own triggers match nothing', () => {
    const comment = trigger('comment_added');
    expect(comment.matches({ kind: 'comment_added' }, event({ tab: 't1' }))).toBe(true);
    expect(comment.matches({ kind: 'comment_added', tab: 't1' }, event({ tab: 't1' }))).toBe(true);
    expect(comment.matches({ kind: 'comment_added', tab: 't1' }, event({ tab: 't2' }))).toBe(false);
    expect(
      trigger('edited').matches({ kind: 'edited', minutes: 5, tab: 't1' }, event({ tab: 't2' })),
    ).toBe(false);
    for (const kind of ['scheduled', 'manual', 'incoming_webhook', 'not_edited'])
      expect(trigger(kind).matches(trigger(kind).defaults(), event())).toBe(false);
  });

  it('say the run’s first line', () => {
    const said = (kind: string, e: Partial<ItemEvent> = {}, part?: ItemPart) =>
      trigger(kind).said(part ?? trigger(kind).defaults(), event(e), names);
    const by = { id: 'ana', name: 'Ana Costa', color: '' };
    expect(said('manual', { by })).toBe('Ana Costa ran the rule');
    expect(said('manual')).toBe('Someone ran the rule');
    expect(said('incoming_webhook')).toBe('An Incoming Webhook call');
    expect(said('tab_added', { by, tab: 't1' })).toBe('Ana Costa added Roadmap');
    expect(said('tab_removed', { tab: 'gone', data: { 'tab.name': 'Old Tab' } })).toBe(
      'Someone removed Old Tab',
    );
    expect(said('tab_removed', { tab: 'gone', data: { 'tab.name': '' } })).toBe(
      'Someone removed a tab',
    );
    expect(said('snapshot_taken', { by })).toBe('Ana Costa took a snapshot');
    expect(said('joined', { by })).toBe('Ana Costa joined');
    expect(said('access_requested', { by })).toBe('Ana Costa asked for access');
    expect(said('comment_added', { by, tab: 't2' })).toBe('Ana Costa commented on Retro');
    expect(said('thread_resolved', { by, tab: 't2' })).toBe('Ana Costa resolved a thread on Retro');
    expect(said('threads_resolved', { tab: 't2' })).toBe('Every thread on Retro is resolved');
    expect(said('action_assigned', { by })).toBe('Ana Costa assigned an action');
    expect(said('action_done', { by })).toBe('Ana Costa finished an action');
    expect(said('not_edited', {}, { kind: 'not_edited', days: 1, at: '09:00' })).toBe(
      'Automation · Not edited for 1 day',
    );
    expect(eventWho(event())).toBe('Someone');
    expect(eventTabName(event(), { itemWord: 'document' })).toBe('a tab');
  });

  it('put a chosen tab in their chips', () => {
    expect(trigger('comment_added').words({ kind: 'comment_added', tab: 't1' }, names)).toEqual([
      { chip: 'Comment Added', trigger: true },
      { word: 'on' },
      { chip: 'Roadmap' },
    ]);
    expect(trigger('edited').words({ kind: 'edited', minutes: 90, tab: 'zz' }, names)).toEqual([
      { chip: 'Edited, Then Quiet for 1 Hour 30 Minutes', trigger: true },
      { word: 'on' },
      { chip: "a tab that's gone" },
    ]);
    expect(
      trigger('not_edited').words({ kind: 'not_edited', days: 90, at: '09:00' }, names),
    ).toEqual([{ chip: 'Not Edited For 90 Days', trigger: true }]);
  });

  it('settle on the tab a rule is kept to, else on the whole item, and know a stale stretch', () => {
    const { settle } = trigger('edited');
    expect(settle!.quietMs({ kind: 'edited', minutes: 5 })).toBe(300_000);
    expect(settle!.key(event({ tab: 't1' }), { kind: 'edited', minutes: 5 })).toBe('');
    expect(settle!.key(event({ tab: 't1' }), { kind: 'edited', minutes: 5, tab: 't1' })).toBe('t1');
    expect(settle!.key(event(), { kind: 'edited', minutes: 5, tab: 't1' })).toBe('');
    const due = trigger('not_edited').due!;
    const day = 86_400_000;
    expect(
      due({ kind: 'not_edited', days: 2, at: '09:00' }, { moment: 2 * day, editedAt: 0 }),
    ).toBe('0');
    expect(
      due({ kind: 'not_edited', days: 2, at: '09:00' }, { moment: 2 * day - 1, editedAt: 0 }),
    ).toBeNull();
  });
});

describe('the shared conditions', () => {
  const ctx = (over: Partial<ItemEvent> = {}, value = ''): ItemHoldContext => ({
    event: event(over),
    // Monday 4 January 2027, 23:30 UTC.
    now: Date.UTC(2027, 0, 4, 23, 30),
    timeZone: 'UTC',
    names,
    value: () => value,
  });
  const holds = (c: ItemPart, c2 = ctx()) => TEST_KINDS.condition(c.kind)!.holds(c, c2);

  it('hold on the run’s tab', () => {
    expect(holds({ kind: 'tab', tabs: ['t1', 't2'] }, ctx({ tab: 't1' }))).toEqual({
      ok: true,
      text: 'Tab is Roadmap or Retro',
    });
    expect(holds({ kind: 'tab', tabs: ['t1'] }).ok).toBe(false);
    expect(holds({ kind: 'tab', tabs: ['t1'], not: true })).toEqual({
      ok: true,
      text: 'Tab is not Roadmap',
    });
    expect(holds({ kind: 'tab', tabs: ['t1'], not: true }, ctx({ tab: 't1' })).ok).toBe(false);
  });

  it('hold on who started the rule', () => {
    const by = { id: 'ana', name: 'Ana Costa', color: '' };
    const who = [{ person: 'ana' }, { role: 'agent' }];
    expect(holds({ kind: 'who', who }, ctx({ by }))).toEqual({
      ok: true,
      text: 'Who Did It is Ana Costa or an agent',
    });
    expect(holds({ kind: 'who', who }, ctx({ role: 'agent' })).ok).toBe(true);
    expect(holds({ kind: 'who', who }, ctx({ role: 'viewer' })).ok).toBe(false);
    expect(holds({ kind: 'who', who: [{ role: 'participant' }], not: true })).toEqual({
      ok: true,
      text: 'Who Did It is not a Participant',
    });
    expect(
      holds({ kind: 'who', who: [{ role: 'editor' }], not: true }, ctx({ role: 'editor' })).ok,
    ).toBe(false);
  });

  it('hold on the day of the week in the rule’s time zone', () => {
    expect(holds({ kind: 'weekday', days: [1, 2] })).toEqual({
      ok: true,
      text: 'Today is Monday or Tuesday',
    });
    expect(holds({ kind: 'weekday', days: [1] }, { ...ctx(), timeZone: 'Asia/Tokyo' }).ok).toBe(
      false,
    );
  });

  it('hold on a value’s text, any case', () => {
    const c = { kind: 'text', value: 'comment', op: 'contains', text: 'URGENT' };
    expect(holds(c, ctx({}, 'This is urgent'))).toEqual({
      ok: true,
      text: '{{comment}} contains “URGENT”',
    });
    expect(holds(c, ctx({}, 'calm')).ok).toBe(false);
    expect(holds({ ...c, op: 'not_contains' }, ctx({}, 'calm'))).toEqual({
      ok: true,
      text: '{{comment}} does not contain “URGENT”',
    });
    expect(holds({ ...c, op: 'not_contains' }, ctx({}, 'urgent')).ok).toBe(false);
  });

  it('read, and refuse what is not theirs', () => {
    const c = (condition: unknown, trigger: unknown = { kind: 'comment_added' }) =>
      refusal({ trigger, conditions: [condition] });
    expect(c({ kind: 'tab', tabs: ['t1', 't1'], not: true })).toMatchObject({
      conditions: [{ kind: 'tab', tabs: ['t1'], not: true }],
    });
    expect(c({ kind: 'tab', tabs: [] })).toEqual(['automation_invalid', 'conditions.0.tabs']);
    expect(c({ kind: 'who', who: [{ person: 'ana' }, { role: 'editor' }] })).toHaveProperty(
      'conditions',
    );
    expect(c({ kind: 'who', who: [] })).toEqual(['automation_invalid', 'conditions.0.who']);
    expect(c({ kind: 'who', who: 'ana' })).toEqual(['automation_invalid', 'conditions.0.who']);
    expect(c({ kind: 'who', who: [{ role: 'owner' }] })).toEqual([
      'automation_invalid',
      'conditions.0.who.0',
    ]);
    expect(c({ kind: 'who', who: [{ role: 7 }] })).toEqual([
      'automation_invalid',
      'conditions.0.who.0',
    ]);
    expect(
      c(
        { kind: 'who', who: [{ role: 'editor' }] },
        { kind: 'scheduled', every: 'day', at: '09:00' },
      ),
    ).toEqual(['automation_condition_unsupported', 'conditions.0']);
    expect(c({ kind: 'weekday', days: [5, 1, 5] })).toMatchObject({
      conditions: [{ days: [1, 5] }],
    });
    expect(c({ kind: 'weekday', days: [] })).toEqual(['automation_invalid', 'conditions.0.days']);
    expect(c({ kind: 'weekday', days: [7] })).toEqual([
      'automation_invalid',
      'conditions.0.days.0',
    ]);
    expect(c({ kind: 'text', value: ' comment ', op: 'contains', text: 'x' })).toMatchObject({
      conditions: [{ kind: 'text', value: 'comment', op: 'contains', text: 'x' }],
    });
    expect(
      c({ kind: 'text', value: 'comment', op: 'contains', text: 'x' }, { kind: 'joined' }),
    ).toEqual(['automation_value_unknown', 'conditions.0.value']);
    expect(c({ kind: 'text', op: 'contains', text: 'x' })).toEqual([
      'automation_value_unknown',
      'conditions.0.value',
    ]);
    expect(c({ kind: 'text', value: 'comment', op: 'is', text: 'x' })).toEqual([
      'automation_invalid',
      'conditions.0.op',
    ]);
    expect(c({ kind: 'text', value: 'comment', op: 'contains', text: '' })).toEqual([
      'automation_invalid',
      'conditions.0.text',
    ]);
    expect(c({ kind: 'nope' })).toEqual(['automation_invalid', 'conditions.0.kind']);
    expect(c('x')).toEqual(['automation_invalid', 'conditions.0']);
    expect(refusal({ conditions: 'x' })).toEqual(['automation_invalid', 'conditions']);
    expect(
      refusal({ conditions: Array.from({ length: 11 }, () => ({ kind: 'weekday', days: [1] })) }),
    ).toEqual(['automation_invalid', 'conditions']);
  });

  it('say themselves in chips', () => {
    const words = (c: ItemPart) => TEST_KINDS.condition(c.kind)!.words(c, names);
    expect(words({ kind: 'tab', tabs: ['t1'], not: true })).toEqual([
      { word: 'tab is not' },
      { chip: 'Roadmap' },
    ]);
    expect(words({ kind: 'who', who: [{ person: 'zz' }] })).toEqual([
      { word: 'it is by' },
      { chip: "someone who's gone" },
    ]);
    expect(words({ kind: 'weekday', days: [6, 0] })).toEqual([
      { word: 'today is' },
      { chip: 'Saturday or Sunday' },
    ]);
    expect(words({ kind: 'text', value: 'comment', op: 'not_contains', text: 'x' })).toEqual([
      { chip: '{{comment}}' },
      { word: 'does not contain' },
      { chip: '“x”' },
    ]);
  });
});

describe('values', () => {
  const place = (kind: string, afterAi = false) => ({ trigger: { kind }, afterAi });

  it('knows which a text may hold where', () => {
    expect(itemValueKnown(TEST_KINDS, place('joined'), 'item.name')).toBe(true);
    expect(itemValueKnown(TEST_KINDS, place('joined'), 'now + 3d')).toBe(true);
    expect(itemValueKnown(TEST_KINDS, place('joined'), 'comment')).toBe(false);
    expect(itemValueKnown(TEST_KINDS, place('comment_added'), 'comment')).toBe(true);
    expect(itemValueKnown(TEST_KINDS, place('joined'), 'webhook.a')).toBe(false);
    expect(itemValueKnown(TEST_KINDS, place('incoming_webhook'), 'webhook.a')).toBe(true);
    expect(itemValueKnown(TEST_KINDS, place('joined'), 'summary')).toBe(false);
    expect(itemValueKnown(TEST_KINDS, place('joined', true), 'summary')).toBe(true);
    expect(itemValueKnown(TEST_KINDS, place('joined'), 'nope')).toBe(false);
  });

  it('offers them in Insert a Value, without Who Did It where nobody is behind the trigger', () => {
    expect(itemValueOptions(TEST_KINDS, place('poll_ended', true))).toEqual([
      { name: 'item.name', label: 'Document Name' },
      { name: 'item.url', label: 'Document Link' },
      { name: 'tab.name', label: 'Tab Name' },
      { name: 'tab.url', label: 'Tab Link' },
      { name: 'summary', label: 'AI Summary' },
      { name: 'poll.question', label: 'Poll Question' },
      { name: 'person', label: 'Who Did It' },
      { name: 'now.date', label: 'Today' },
      { name: 'rule', label: 'Rule Name' },
      { name: 'now', label: 'Now' },
    ]);
    const timed = itemValueOptions(TEST_KINDS, place('scheduled')).map((o) => o.name);
    expect(timed).not.toContain('person');
    expect(timed).not.toContain('summary');
    expect(itemValueOptions(TEST_KINDS, place('gone_kind')).map((o) => o.name)).toContain('person');
  });

  it('fills them when a rule runs', () => {
    const outline = {
      name: 'Launch Plan',
      url: 'https://x.example/d',
      ownerId: 'ana',
      tabs: [],
      people: [],
    };
    const resolve = itemValueResolver(TEST_KINDS, {
      event: event({
        by: { id: 'ana', name: 'Ana Costa', color: '' },
        data: { comment: 'Looks good', 'webhook.build.status': true, 'tab.name': 'Kept', n: 3 },
      }),
      outline,
      tab: { id: 't1', name: 'Roadmap', url: 'https://x.example/d?tab=t1' },
      summary: 'Short',
      rule: { name: 'My Rule' },
      now: Date.UTC(2027, 0, 4, 9, 5),
      timeZone: 'UTC',
      own: { 'room.name': 'Atrium' },
    });
    expect(
      [
        'item.name',
        'item.url',
        'tab.name',
        'tab.url',
        'comment',
        'summary',
        'person',
        'rule',
        'now.date',
        'webhook.build.status',
        'webhook.missing',
        'room.name',
        'constructor',
        'nope',
      ].map(resolve),
    ).toEqual([
      'Launch Plan',
      'https://x.example/d',
      'Roadmap',
      'https://x.example/d?tab=t1',
      'Looks good',
      'Short',
      'Ana Costa',
      'My Rule',
      '4 Jan 2027',
      'true',
      '',
      'Atrium',
      '',
      '',
    ]);
    const bare = itemValueResolver(TEST_KINDS, {
      event: event({ data: { 'tab.name': 'Kept' } }),
      outline,
      tab: null,
      summary: '',
      rule: { name: 'R' },
      now: 0,
      timeZone: 'UTC',
    });
    expect(['tab.name', 'tab.url', 'person', 'comment', 'room.name'].map(bare)).toEqual([
      'Kept',
      '',
      '',
      '',
      '',
    ]);
    const none = itemValueResolver(TEST_KINDS, {
      event: event(),
      outline,
      tab: null,
      summary: '',
      rule: { name: 'R' },
      now: 0,
      timeZone: 'UTC',
    });
    expect(none('tab.name')).toBe('');
  });
});
