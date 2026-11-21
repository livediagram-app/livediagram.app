import { describe, expect, it } from 'vitest';
import {
  itemNames,
  itemRuleFormat,
  itemRuleSentence,
  itemTriggerLine,
  itemValueOptions,
  itemValueResolver,
  readItemRule,
  sentenceText,
  undescribedKinds,
  type ItemEvent,
  type ItemPart,
  type ItemRule,
  type ItemRuleBody,
} from '@liveworkspace/automations/item';
import {
  AGENT_CHANGED_EVENT,
  AUTOMATIONS_TELEMETRY_CATEGORY,
  DOCUMENT_TRIGGERS,
  DOCUMENT_VALUES,
  KINDS,
  POLL_ENDED_EVENT,
  QUESTION_ASKED_EVENT,
  pollResultLines,
} from './index';

// livediagram's Automations kinds (docs/specs/013-workspace/automations.md): the shared ones, the comment and action
// triggers, Add a Tab from a Template, and Poll Ended, Question Asked and Agent Made Changes with their values.

const OUTLINE = {
  name: 'Launch',
  url: 'https://www.livediagram.app/document/d1',
  ownerId: 'user_ana',
  tabs: [
    { id: 't1', name: 'Board' },
    { id: 't2', name: 'Retro' },
  ],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
};
const NAMES = itemNames('canvas', OUTLINE);

const rule = (trigger: ItemPart, more: Partial<ItemRuleBody> = {}): ItemRuleBody => ({
  name: 'A Rule',
  trigger,
  conditions: [],
  steps: [{ kind: 'take_snapshot', name: 'Kept' }],
  chain: false,
  timeZone: 'UTC',
  ...more,
});

const STAMP = { by: { id: 'user_ana', name: 'Ana', color: '#111' }, at: 1 };

const stored = (body: ItemRuleBody): ItemRule => ({
  ...body,
  id: 'r1',
  enabled: true,
  made: STAMP,
  edited: STAMP,
});

describe('KINDS', () => {
  it('is a document’s registry: its word, comment threads and tab templates', () => {
    expect(KINDS.itemWord).toBe('canvas');
    expect(KINDS.collab).toBe(true);
    expect(KINDS.tabTemplates).toBe(true);
    expect(AUTOMATIONS_TELEMETRY_CATEGORY).toBe('Document');
  });

  it('describes every kind for agents and Describe a Rule', () => {
    expect(undescribedKinds(KINDS)).toEqual([]);
    const format = itemRuleFormat(KINDS);
    for (const kind of [POLL_ENDED_EVENT, QUESTION_ASKED_EVENT, AGENT_CHANGED_EVENT])
      expect(format.trigger).toContain(`"kind":"${kind}"`);
    expect(format.steps).toContain('"kind":"add_tab"');
  });

  it('holds the shared triggers, the comment and action ones, and its own three', () => {
    const kinds = KINDS.triggers.map((t) => t.kind);
    for (const kind of [
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
      'poll_ended',
      'question_asked',
      'agent_changed',
    ])
      expect(kinds).toContain(kind);
    expect(DOCUMENT_TRIGGERS.map((t) => t.name)).toEqual([
      'Poll Ended',
      'Question Asked',
      'Agent Made Changes',
    ]);
    expect(KINDS.action('add_tab')?.name).toBe('Add a Tab from a Template');
  });
});

describe('Poll Ended', () => {
  const event: ItemEvent = {
    id: 'poll:p1',
    kind: POLL_ENDED_EVENT,
    at: 1,
    by: { id: '', name: 'Ana Costa', color: '#111' },
    data: { 'poll.question': 'Ship it?', 'poll.results': 'Yes: 3\nNo: 1', 'poll.answers': 4 },
  };

  it('reads, matches any poll, and says who ended it', () => {
    const read = readItemRule(rule({ kind: 'poll_ended', tab: 'ignored' }), KINDS);
    if ('error' in read) throw new Error(read.message);
    expect(read.body.trigger).toEqual({ kind: 'poll_ended' });
    const def = KINDS.trigger('poll_ended')!;
    expect(def.matches(read.body.trigger, event)).toBe(true);
    expect(def.defaults()).toEqual({ kind: 'poll_ended' });
    expect(itemTriggerLine(stored(read.body), event, KINDS, NAMES).text).toBe(
      'Ana Costa ended a poll',
    );
    expect(sentenceText(itemRuleSentence(stored(read.body), KINDS, NAMES))).toContain('Poll Ended');
  });

  it('offers its three values under itself only, and fills them from the event', () => {
    const offered = (kind: string) =>
      itemValueOptions(KINDS, { trigger: { kind }, afterAi: false }).map((v) => v.name);
    expect(offered('poll_ended')).toEqual(
      expect.arrayContaining(['poll.question', 'poll.results', 'poll.answers']),
    );
    expect(offered('manual')).not.toContain('poll.results');
    const value = itemValueResolver(KINDS, {
      event,
      outline: OUTLINE,
      tab: null,
      summary: '',
      rule: { name: 'A Rule' },
      now: 1,
      timeZone: 'UTC',
    });
    expect(value('poll.question')).toBe('Ship it?');
    expect(value('poll.results')).toBe('Yes: 3\nNo: 1');
    expect(value('poll.answers')).toBe('4');
    // A value its event does not carry reads as nothing.
    expect(value('question')).toBe('');
  });

  it('refuses a poll value under another trigger', () => {
    const read = readItemRule(
      rule({ kind: 'manual' }, { steps: [{ kind: 'take_snapshot', name: '{{poll.question}}' }] }),
      KINDS,
    );
    expect(read).toMatchObject({ error: 'automation_value_unknown' });
  });
});

describe('Question Asked', () => {
  const event: ItemEvent = {
    id: 'q1',
    kind: QUESTION_ASKED_EVENT,
    at: 1,
    tab: 't2',
    data: { question: 'When do we ship?' },
  };

  it('is kept to a tab when one is picked, and names it in its words', () => {
    const read = readItemRule(rule({ kind: 'question_asked', tab: 't2' }), KINDS);
    if ('error' in read) throw new Error(read.message);
    const def = KINDS.trigger('question_asked')!;
    expect(def.matches(read.body.trigger, event)).toBe(true);
    expect(def.matches(read.body.trigger, { ...event, tab: 't1' })).toBe(false);
    expect(def.matches({ kind: 'question_asked' }, { ...event, tab: 't1' })).toBe(true);
    expect(sentenceText(itemRuleSentence(stored(read.body), KINDS, NAMES))).toContain('Retro');
    expect(itemTriggerLine(stored(read.body), event, KINDS, NAMES).text).toBe(
      'A question was asked on Retro',
    );
    expect(def.defaults()).toEqual({ kind: 'question_asked' });
  });

  it('has nobody behind it: Who Did It and an email to whoever started it are refused', () => {
    expect(KINDS.trigger('question_asked')!.personless).toBe(true);
    const who = readItemRule(
      rule(
        { kind: 'question_asked' },
        { conditions: [{ kind: 'who', who: [{ role: 'editor' }] }] },
      ),
      KINDS,
    );
    expect(who).toMatchObject({ error: 'automation_condition_unsupported' });
    const email = readItemRule(
      rule(
        { kind: 'question_asked' },
        { steps: [{ kind: 'email', to: { trigger: true }, subject: 'Q', body: '{{question}}' }] },
      ),
      KINDS,
    );
    expect(email).toMatchObject({ error: 'automation_condition_unsupported' });
    const ok = readItemRule(
      rule(
        { kind: 'question_asked' },
        { steps: [{ kind: 'email', to: { owner: true }, subject: 'Q', body: '{{question}}' }] },
      ),
      KINDS,
    );
    expect('error' in ok).toBe(false);
  });

  it('refuses a tab that is no id', () => {
    expect(readItemRule(rule({ kind: 'question_asked', tab: 7 }), KINDS)).toHaveProperty('error');
  });
});

describe('Agent Made Changes', () => {
  const event: ItemEvent = {
    id: 'agent:cs1',
    kind: AGENT_CHANGED_EVENT,
    at: 1,
    tab: 't1',
    by: { id: 'user_ana', name: 'Deploy Bot', color: '#111' },
    role: 'agent',
  };

  it('reads with an optional tab, and says the token’s name', () => {
    const read = readItemRule(rule({ kind: 'agent_changed', tab: 't1' }), KINDS);
    if ('error' in read) throw new Error(read.message);
    const def = KINDS.trigger('agent_changed')!;
    expect(def.matches(read.body.trigger, event)).toBe(true);
    expect(def.matches(read.body.trigger, { ...event, tab: 't2' })).toBe(false);
    expect(def.defaults()).toEqual({ kind: 'agent_changed' });
    expect(itemTriggerLine(stored(read.body), event, KINDS, NAMES).text).toBe(
      'Deploy Bot changed Board',
    );
    expect(sentenceText(itemRuleSentence(stored(read.body), KINDS, NAMES))).toContain(
      'Agent Made Changes',
    );
    // Somebody is behind it: Who Did It may ask whether it was an agent.
    const who = readItemRule(
      rule({ kind: 'agent_changed' }, { conditions: [{ kind: 'who', who: [{ role: 'agent' }] }] }),
      KINDS,
    );
    expect('error' in who).toBe(false);
    expect(
      sentenceText(itemRuleSentence(stored(rule({ kind: 'agent_changed' })), KINDS, NAMES)),
    ).not.toContain(' on ');
  });
});

describe('the values', () => {
  it('are the four the spec names', () => {
    expect(DOCUMENT_VALUES.map((v) => [v.name, v.label, v.under])).toEqual([
      ['poll.question', 'Poll Question', ['poll_ended']],
      ['poll.results', 'Poll Results', ['poll_ended']],
      ['poll.answers', 'Poll Answers', ['poll_ended']],
      ['question', 'Question', ['question_asked']],
    ]);
  });

  it('writes a tally one option a line, the most chosen first, ties in the poll’s order', () => {
    expect(
      pollResultLines([
        { option: 'A', count: 1 },
        { option: 'B', count: 3 },
        { option: 'C', count: 1 },
      ]),
    ).toBe('B: 3\nA: 1\nC: 1');
    expect(pollResultLines([])).toBe('');
  });
});
