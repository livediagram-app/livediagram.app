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
  filters: new Map([['sf-1', 'Blocked Work']]),
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
