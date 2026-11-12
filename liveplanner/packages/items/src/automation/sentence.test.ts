import { describe, expect, it } from 'vitest';
import type { AutomationAction, AutomationCondition, AutomationRuleBody } from './types';
import { automationDayWords } from './conditions';
import {
  actionChip,
  conditionChip,
  outlineFieldName,
  outlinePersonName,
  outlineTabName,
  ruleSentence,
  savedFilterKey,
  sentenceOrList,
  stepChip,
  triggerParts,
  type RuleSentenceOutline,
} from './sentence';

// docs/specs/026-plan/automations.md "The Automations screen": the Rules list's sentence.
const OUTLINE: RuleSentenceOutline = {
  types: [
    {
      id: 'task',
      label: 'Task',
      fields: ['title', 'priority', 'due'],
      custom: [{ id: 'f-done', label: 'Completed On', kind: 'date' }],
    },
    { id: 'bug', label: 'Bug', fields: ['title', 'priority'] },
  ],
  statuses: new Map([
    ['todo', 'To Do'],
    ['review', 'Review'],
    ['done', 'Done'],
  ]),
  people: [
    { id: 'p-priya', name: 'Priya Shah' },
    { id: 'p-marco', name: 'Marco Ruiz' },
  ],
  tabs: new Map([['t-form', 'Intake Form']]),
  filters: new Map([
    [savedFilterKey('t', 'sf-1'), 'Blocked Work'],
    [savedFilterKey('t2', 'sf-1'), 'Mine'],
  ]),
};

const BARE: RuleSentenceOutline = { types: [], statuses: new Map(), people: [] };

const rule = (over: Partial<AutomationRuleBody>): AutomationRuleBody => ({
  name: 'R',
  trigger: { kind: 'manual' },
  conditions: [],
  steps: [],
  chain: false,
  timeZone: 'UTC',
  ...over,
});

describe('ruleSentence', () => {
  it('reads the design’s first rule: When Card Moved to Done then Set Completed On, Remove Label blocked', () => {
    const parts = ruleSentence(
      rule({
        trigger: { kind: 'card_moved', to: ['done'] },
        steps: [
          { kind: 'set_field', field: 'f-done', value: { date: { today: 0 } } },
          { kind: 'remove_label', label: 'blocked' },
        ],
      }),
      OUTLINE,
    );
    expect(parts).toEqual([
      { word: 'When' },
      { chip: 'Card Moved', trigger: true },
      { word: 'to' },
      { chip: 'Done' },
      { word: 'then' },
      { chip: 'Set Completed On Today' },
      { chip: 'Remove Label blocked' },
    ]);
  });

  it('puts "if" before the conditions', () => {
    const parts = ruleSentence(
      rule({
        trigger: { kind: 'card_created' },
        conditions: [{ kind: 'type', types: ['bug'] }],
        steps: [{ kind: 'assign', to: { person: 'p-priya' } }],
      }),
      OUTLINE,
    );
    expect(parts).toEqual([
      { word: 'When' },
      { chip: 'Card Created', trigger: true },
      { word: 'if' },
      { chip: 'Card Type is Bug' },
      { word: 'then' },
      { chip: 'Assign Priya Shah' },
    ]);
  });

  it('is the trigger alone with no conditions or steps', () => {
    expect(ruleSentence(rule({ trigger: { kind: 'comment_added' } }), OUTLINE)).toEqual([
      { word: 'When' },
      { chip: 'Comment Added', trigger: true },
    ]);
  });
});

describe('triggerParts', () => {
  it('narrows Card Created by its column', () => {
    expect(triggerParts({ kind: 'card_created', status: 'todo' }, OUTLINE).slice(2)).toEqual([
      { word: 'in' },
      { chip: 'To Do' },
    ]);
  });

  it('narrows Form Response by its tab, and names an unknown tab by its id', () => {
    expect(triggerParts({ kind: 'form_response', formTab: 't-form' }, OUTLINE).slice(2)).toEqual([
      { word: 'on' },
      { chip: 'Intake Form' },
    ]);
    expect(triggerParts({ kind: 'form_response' }, OUTLINE)).toHaveLength(2);
    expect(triggerParts({ kind: 'form_response', formTab: 't-x' }, BARE).at(-1)).toEqual({
      chip: 't-x',
    });
  });

  it('joins several columns with "or", from and to', () => {
    expect(
      triggerParts({ kind: 'card_moved', from: ['todo', 'review'], to: ['done'] }, OUTLINE).slice(
        2,
      ),
    ).toEqual([
      { word: 'from' },
      { chip: 'To Do' },
      { word: 'or' },
      { chip: 'Review' },
      { word: 'to' },
      { chip: 'Done' },
    ]);
    expect(triggerParts({ kind: 'card_moved' }, OUTLINE)).toHaveLength(2);
  });

  it('names the fields a Field Changed listens to', () => {
    expect(
      triggerParts({ kind: 'field_changed', fields: ['priority', 'f-done'] }, OUTLINE).slice(2),
    ).toEqual([{ word: 'on' }, { chip: 'Priority' }, { word: 'or' }, { chip: 'Completed On' }]);
  });

  it('adds nothing for Run from a Card', () => {
    expect(triggerParts({ kind: 'manual' }, OUTLINE)).toEqual([
      { word: 'When' },
      { chip: 'Run from a Card', trigger: true },
    ]);
  });
});

describe('conditionChip', () => {
  const cases: [AutomationCondition, string][] = [
    [{ kind: 'type', types: ['task', 'bug'] }, 'Card Type is Task or Bug'],
    [{ kind: 'type', not: true, types: ['gone'] }, 'Card Type is not gone'],
    [{ kind: 'column', statuses: ['done'] }, 'Column is Done'],
    [
      { kind: 'column', not: true, statuses: ['done', 'review', 'todo'] },
      'Column is not Done, Review or To Do',
    ],
    [
      { kind: 'who', who: [{ person: 'p-marco' }, { role: 'editor' }] },
      'Who Did It is Marco Ruiz or an Editor',
    ],
    [
      { kind: 'who', not: true, who: [{ role: 'participant' }, { role: 'agent' }] },
      'Who Did It is not a Participant or an agent',
    ],
    [{ kind: 'saved_filter', tab: 't', filter: 'sf-1' }, 'Matches Blocked Work'],
    [{ kind: 'saved_filter', tab: 't', filter: 'sf-x' }, 'Matches a Saved Filter'],
    // Two boards may hold filters of one id: each reads its own board's name.
    [{ kind: 'saved_filter', tab: 't2', filter: 'sf-1' }, 'Matches Mine'],
    [{ kind: 'saved_filter', tab: 't3', filter: 'sf-1' }, 'Matches a Saved Filter'],
    [{ kind: 'field', field: 'f-done', op: 'empty' }, 'Completed On is empty'],
    [{ kind: 'field', field: 'priority', op: 'is', value: 'urgent' }, 'Priority is Urgent'],
    [{ kind: 'field', field: 'priority', op: 'is_not', value: 'odd' }, 'Priority is not odd'],
    [{ kind: 'field', field: 'labels', op: 'contains', value: ['a', 'b'] }, 'Labels contains a, b'],
    [{ kind: 'field', field: 'estimate', op: 'more_than', value: 5 }, 'Estimate is more than 5'],
    [
      { kind: 'field', field: 'due', op: 'before', value: { today: 3 } },
      'Due Date is before Today + 3 days',
    ],
    [
      { kind: 'field', field: 'due', op: 'on_or_after', value: { day: '2026-11-11' } },
      'Due Date is on or after 11 Nov 2026',
    ],
  ];
  it.each(cases)('reads %j as %s', (c, words) => {
    expect(conditionChip(c, OUTLINE)).toBe(words);
  });

  it('reads a filter with no filter names as a saved filter', () => {
    expect(conditionChip({ kind: 'saved_filter', tab: 't', filter: 'sf-1' }, BARE)).toBe(
      'Matches a Saved Filter',
    );
  });
});

describe('actionChip', () => {
  const cases: [AutomationAction, string][] = [
    [{ kind: 'move', status: 'done' }, 'Move to Done'],
    [{ kind: 'move', status: 'gone' }, 'Move to gone'],
    [{ kind: 'set_field', field: 'priority', value: { text: 'urgent' } }, 'Set Priority Urgent'],
    [{ kind: 'set_field', field: 'title', value: { text: 'Hello' } }, 'Set Title Hello'],
    [{ kind: 'set_field', field: 'title', value: { text: 'Hi {{person}}' } }, 'Set Title'],
    [{ kind: 'set_field', field: 'title', value: { text: '  ' } }, 'Set Title'],
    [{ kind: 'set_field', field: 'title', value: { text: 'x'.repeat(25) } }, 'Set Title'],
    [{ kind: 'set_field', field: 'estimate', value: { number: 8 } }, 'Set Estimate 8'],
    [{ kind: 'set_field', field: 'labels', value: { list: ['a', 'b'] } }, 'Set Labels a, b'],
    [{ kind: 'set_field', field: 'labels', value: { list: [] } }, 'Set Labels'],
    [
      { kind: 'set_field', field: 'due', value: { date: { today: -1 } } },
      'Set Due Date Today - 1 day',
    ],
    [
      { kind: 'set_field', field: 'priority', value: { from: 'f-urgency' } },
      'Set Priority from f-urgency',
    ],
    [{ kind: 'clear_field', field: 'due' }, 'Clear Due Date'],
    [{ kind: 'assign', to: { person: 'p-gone' } }, 'Assign Someone No Longer Here'],
    [{ kind: 'assign', to: { trigger: true } }, 'Assign Who Did It'],
    [{ kind: 'assign', to: { nobody: true } }, 'Unassign'],
    [{ kind: 'add_label', label: 'triage' }, 'Add Label triage'],
    [{ kind: 'comment', text: 'Hi' }, 'Add Comment'],
    [{ kind: 'flag' }, 'Flag'],
    [{ kind: 'unflag' }, 'Unflag'],
    [{ kind: 'archive' }, 'Archive'],
    [{ kind: 'create_card', type: 'bug', title: 'QA' }, 'Create Bug'],
    [{ kind: 'email', to: { person: 'p-marco' }, subject: 's', body: 'b' }, 'Email Marco Ruiz'],
    [{ kind: 'email', to: { trigger: true }, subject: 's', body: 'b' }, 'Email Who Did It'],
    [{ kind: 'email', to: { assignee: true }, subject: 's', body: 'b' }, 'Email Assignee'],
  ];
  it.each(cases)('reads %j as %s', (a, words) => {
    expect(actionChip(a, OUTLINE)).toBe(words);
  });

  it('reads an If / Else step by its name', () => {
    expect(stepChip({ kind: 'if', conditions: [], then: [], else: [] }, OUTLINE)).toBe('If / Else');
    expect(stepChip({ kind: 'flag' }, OUTLINE)).toBe('Flag');
  });
});

describe('the names', () => {
  it('joins lists', () => {
    expect(sentenceOrList([])).toBe('');
    expect(sentenceOrList(['A'])).toBe('A');
    expect(sentenceOrList(['A', 'B'])).toBe('A or B');
  });

  it('words a day', () => {
    expect(automationDayWords({ today: 0 })).toBe('Today');
    expect(automationDayWords({ today: 1 })).toBe('Today + 1 day');
    expect(automationDayWords({ today: -2 })).toBe('Today - 2 days');
    expect(automationDayWords({ day: '2026-01-02' })).toBe('2 Jan 2026');
  });

  it('names fields, people and tabs, falling back to what the rule stored', () => {
    expect(outlineFieldName('due', OUTLINE)).toBe('Due Date');
    expect(outlineFieldName('f-missing', OUTLINE)).toBe('f-missing');
    expect(outlineFieldName('title', BARE)).toBe('Title');
    expect(outlinePersonName('p-priya', OUTLINE)).toBe('Priya Shah');
    expect(outlineTabName('t-x', OUTLINE)).toBe('t-x');
  });
});

describe('the automation person', () => {
  // The author a rule's comments and history lines carry (types.ts), read by the sentence's callers.
  it('is the rule by name, in the Automation colour', async () => {
    const { automationPerson, AUTOMATION_PERSON_ID, AUTOMATION_COLOR } = await import('./types');
    expect(automationPerson('Wrap Up')).toEqual({
      id: AUTOMATION_PERSON_ID,
      name: 'Wrap Up',
      color: AUTOMATION_COLOR,
    });
  });
});

// Phase 2 (#712): time triggers, branches, outgoing actions, Assign in Turn.
describe('Phase 2 words', () => {
  const when = (trigger: AutomationRuleBody['trigger']) => triggerParts(trigger, OUTLINE);
  it('says a time trigger as one chip', () => {
    expect(when({ kind: 'scheduled', every: 'weekday', at: '09:00' })).toEqual([
      { word: 'Every' },
      { chip: 'Weekday at 9:00', trigger: true },
    ]);
    expect(when({ kind: 'overdue', at: '09:00' })).toEqual([
      { word: 'When' },
      { chip: 'Overdue at 9:00', trigger: true },
    ]);
    // The whole words, as the Audit Trail's trigger line reads them.
    const chip = (t: AutomationRuleBody['trigger']) => {
      const [word, part] = when(t) as [{ word: string }, { chip: string }];
      return word.word === 'Every' ? `Every ${part.chip}` : part.chip;
    };
    expect(chip({ kind: 'scheduled', every: 'day', at: '17:45' })).toBe('Every Day at 17:45');
    expect(chip({ kind: 'scheduled', every: 'week', days: [1], at: '09:00' })).toBe(
      'Every Mon at 9:00',
    );
    expect(chip({ kind: 'scheduled', every: 'week', days: [1, 3, 5], at: '09:00' })).toBe(
      'Every Mon, Wed and Fri at 9:00',
    );
    expect(chip({ kind: 'scheduled', every: 'week', at: '09:00' })).toBe('Every  at 9:00');
    expect(
      [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(
        (dayOfMonth) =>
          chip({ kind: 'scheduled', every: 'month', dayOfMonth, at: '09:00' }).split(' ')[3],
      ),
    ).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st']);
    expect(chip({ kind: 'scheduled', every: 'month', at: '09:00' })).toBe(
      'Monthly on the 1st at 9:00',
    );
    expect(chip({ kind: 'due_in', days: 1, at: '09:00' })).toBe('Due in 1 Day at 9:00');
    expect(chip({ kind: 'due_in', days: 2, at: '09:00' })).toBe('Due in 2 Days at 9:00');
    expect(chip({ kind: 'overdue', at: '09:00' })).toBe('Overdue at 9:00');
  });

  it('says a time rule’s conditions as the cards it runs on', () => {
    expect(
      ruleSentence(
        {
          trigger: { kind: 'scheduled', every: 'weekday', at: '09:00' },
          conditions: [{ kind: 'column', not: true, statuses: ['done'] }],
          steps: [{ kind: 'flag' }],
        },
        OUTLINE,
      ).map((p) => ('word' in p ? p.word : p.chip)),
    ).toEqual(['Every', 'Weekday at 9:00', 'for cards', 'Column is not Done', 'then', 'Flag']);
  });

  it('says a branch, an outgoing action and Assign in Turn', () => {
    const o: RuleSentenceOutline = { ...OUTLINE, webhooks: new Map([['wh1', 'Launch Channel']]) };
    const chip = (s: AutomationRuleBody['steps'][number], outline = o) => stepChip(s, outline);
    const branch = (related: object) =>
      ({ kind: 'for', related, conditions: [], then: [{ kind: 'flag' }] }) as never;
    expect(chip(branch({ kind: 'blocked_by' }))).toBe('For each Blocked By Card');
    expect(chip(branch({ kind: 'blocking' }))).toBe('For each Card It Blocks');
    expect(chip(branch({ kind: 'children' }))).toBe('For each Child Card');
    expect(chip(branch({ kind: 'linked' }))).toBe('For each Linked Card');
    expect(chip(branch({ kind: 'linked', field: 'f-done' }))).toBe(
      'For each Linked Card (Completed On)',
    );
    expect(chip(branch({ kind: 'saved_filter', tab: 't', filter: 'sf-1' }))).toBe(
      'For each Card Matching Blocked Work',
    );
    expect(chip(branch({ kind: 'saved_filter', tab: 't', filter: 'sf-x' }))).toBe(
      'For each Card Matching a Saved Filter',
    );
    expect(chip(branch({ kind: 'saved_filter', tab: 't2', filter: 'sf-1' }))).toBe(
      'For each Card Matching Mine',
    );
    const notify = (extra: object) =>
      ({ kind: 'notify', via: 'slack', webhook: 'wh1', text: 'x', ...extra }) as never;
    expect(chip(notify({}))).toBe('Post to Slack Launch Channel');
    expect(chip(notify({ webhook: 'wh9', name: 'Kept' }))).toBe('Post to Slack Kept');
    expect(chip(notify({ webhook: 'wh9', via: 'teams' }))).toBe('Post to Microsoft Teams');
    expect(chip(notify({ via: 'webhook' }), OUTLINE)).toBe('Send to Webhook');
    expect(chip({ kind: 'assign', to: { rotate: ['a', 'b'] } })).toBe('Assign in Turn');
  });
});

describe('the triggers after Phase 3', () => {
  it('names them and their narrowing', () => {
    expect(triggerParts({ kind: 'threads_resolved' }, OUTLINE)).toEqual([
      { word: 'When' },
      { chip: 'All Threads Resolved', trigger: true },
    ]);
    expect(triggerParts({ kind: 'related_done', related: 'children' }, OUTLINE).slice(2)).toEqual([
      { word: 'for its' },
      { chip: 'Children' },
    ]);
    expect(triggerParts({ kind: 'related_done', related: 'linked' }, OUTLINE).at(-1)).toEqual({
      chip: 'Linked Cards',
    });
    expect(
      triggerParts({ kind: 'column_limit', status: 'todo', limit: 4 }, OUTLINE).slice(2),
    ).toEqual([{ word: 'in' }, { chip: 'To Do' }, { word: 'past' }, { chip: '4' }]);
    expect(triggerParts({ kind: 'mentioned', people: ['p-nobody'] }, OUTLINE).slice(2, 3)).toEqual([
      { word: 'naming' },
    ]);
    expect(triggerParts({ kind: 'stuck', days: 1, at: '09:00' }, OUTLINE)).toEqual([
      { word: 'When' },
      { chip: 'Stuck for 1 Day at 9:00', trigger: true },
    ]);
    expect(triggerParts({ kind: 'stuck', days: 5, at: '09:00' }, OUTLINE)[1]).toEqual({
      chip: 'Stuck for 5 Days at 9:00',
      trigger: true,
    });
  });
});

describe('the actions after Phase 3 and Wait', () => {
  it('names each as its chip reads', () => {
    const chip = (s: AutomationRuleBody['steps'][number]) => stepChip(s, OUTLINE);
    expect(chip({ kind: 'set_type', type: 'bug' })).toBe('Change to Bug');
    expect(chip({ kind: 'set_colour', colour: '#ff0000' })).toBe('Set Colour');
    expect(chip({ kind: 'set_colour', colour: null })).toBe('Clear Colour');
    expect(chip({ kind: 'copy_card' })).toBe('Copy Card');
    expect(chip({ kind: 'copy_card', status: 'done' })).toBe('Copy to Done');
    expect(chip({ kind: 'add_checklist', items: ['a'] })).toBe('Add 1 Checklist Item');
    expect(chip({ kind: 'add_checklist', items: ['a', 'b'] })).toBe('Add 2 Checklist Items');
    expect(chip({ kind: 'link_card', field: 'f-done', to: { trigger: true } })).toBe(
      'Link Completed On',
    );
    expect(chip({ kind: 'mention', to: { person: 'p-priya' }, text: 'x' })).toBe(
      'Mention Priya Shah',
    );
    expect(chip({ kind: 'mention', to: { trigger: true }, text: 'x' })).toBe('Mention Who Did It');
    expect(chip({ kind: 'mention', to: { assignee: true }, text: 'x' })).toBe('Mention Assignee');
    expect(chip({ kind: 'restore' })).toBe('Restore From Archive');
    expect(chip({ kind: 'resolve_threads' })).toBe('Resolve Threads');
  });

  it('says a Wait in days and hours', () => {
    const wait = (hours: number) => stepChip({ kind: 'wait', hours }, OUTLINE);
    expect(wait(1)).toBe('Wait 1 Hour');
    expect(wait(3)).toBe('Wait 3 Hours');
    expect(wait(24)).toBe('Wait 1 Day');
    expect(wait(28)).toBe('Wait 1 Day 4 Hours');
    expect(wait(49)).toBe('Wait 2 Days 1 Hour');
    expect(wait(720)).toBe('Wait 30 Days');
  });
});
