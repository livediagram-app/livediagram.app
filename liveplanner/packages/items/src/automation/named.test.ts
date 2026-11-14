import { describe, expect, it } from 'vitest';
import { namedRuleBody, ruleWithRefs, ruleWithTabIds, type RuleNames } from './named';
import { ruleNeeds } from './attention';
import { ALI, BUG, NOTE, OUTLINE, SAM, ruleBody } from './test-fixtures';

// docs/specs/026-plan/automations.md "Agents and the CLI", "Describe a Rule": names as the board shows them become ids.
// The adapter's own cases are agent-verbs' rule-names.test.ts; these walk every part items reads.
const NAMES: RuleNames = {
  statuses: OUTLINE.statuses,
  types: [BUG, NOTE],
  people: [SAM, ALI],
  tabs: [{ id: 'form1', name: 'RSVP' }],
};

describe('namedRuleBody', () => {
  it('names Card Moved’s card types by name, keeping one the plan lacks', () => {
    expect(
      namedRuleBody({ trigger: { kind: 'card_moved', types: ['bug', 'Note', 'Epic'] } }, NAMES),
    ).toEqual({ trigger: { kind: 'card_moved', types: ['bug', 'note', 'Epic'] } });
  });

  it('names a trigger’s columns, fields, people and tab', () => {
    expect(
      namedRuleBody(
        {
          trigger: { kind: 'card_moved', from: ['to do', 7], to: 'Done', people: 'sam lee' },
        },
        NAMES,
      ),
    ).toEqual({
      trigger: { kind: 'card_moved', from: ['todo', 7], to: 'done', people: 'p-sam' },
    });
    expect(
      namedRuleBody(
        {
          trigger: {
            kind: 'field_changed',
            fields: ['Severity', 'Deadline', 'Due Date', 'title', 'f-points', 'Gone'],
          },
        },
        NAMES,
      ),
    ).toEqual({
      trigger: {
        kind: 'field_changed',
        fields: ['f-severity', 'due', 'due', 'title', 'f-points', 'Gone'],
      },
    });
    expect(namedRuleBody({ trigger: { kind: 'form_response', formTab: 'rsvp' } }, NAMES)).toEqual({
      trigger: { kind: 'form_response', formTab: 'form1' },
    });
  });

  it('names every condition and step, nested ones too, and leaves what it cannot read', () => {
    const body = {
      conditions: [
        { kind: 'type', types: ['bug', 'Note'] },
        { kind: 'column', statuses: ['Doing'] },
        { kind: 'field', field: 'Points' },
        { kind: 'saved_filter', tab: 'RSVP' },
        { kind: 'who', who: [{ person: 'Ali' }, 'x'] },
        { kind: 'who', who: 'nobody' },
        'not a condition',
      ],
      steps: [
        { kind: 'move', status: 'Done' },
        { kind: 'create_card', type: 'Bug', linkField: 'Parent Bug' },
        { kind: 'set_field', field: 'When', value: { from: 'Deadline' } },
        { kind: 'set_field', field: 'Points', value: 3 },
        { kind: 'clear_field', field: 'Owner' },
        { kind: 'assign', to: { rotate: ['Sam Lee', 'Ali'] } },
        { kind: 'assign', to: 'nobody' },
        { kind: 'email', to: { person: 'Ali' } },
        { kind: 'mention', to: { person: 'Sam Lee' } },
        { kind: 'set_type', type: 'Note' },
        { kind: 'link_card', field: 'Parent Bug', to: { trigger: true } },
        { kind: 'ai', task: 'summarise', field: 'Severity' },
        {
          kind: 'if',
          conditions: [{ kind: 'column', statuses: ['To Do'] }],
          then: [{ kind: 'move', status: 'Doing' }],
          else: [{ kind: 'assign', to: { person: 'Sam Lee' } }],
        },
        {
          kind: 'for',
          related: { kind: 'linked', field: 'Links', tab: 'RSVP' },
          conditions: [],
          then: [{ kind: 'move', status: 'Done' }],
        },
        { kind: 'for', related: 'children', then: 'x' },
        7,
      ],
    };
    const before = structuredClone(body);
    expect(namedRuleBody(body, NAMES)).toEqual({
      conditions: [
        { kind: 'type', types: ['bug', 'note'] },
        { kind: 'column', statuses: ['doing'] },
        { kind: 'field', field: 'f-points' },
        { kind: 'saved_filter', tab: 'form1' },
        { kind: 'who', who: [{ person: 'p-ali' }, 'x'] },
        { kind: 'who', who: 'nobody' },
        'not a condition',
      ],
      steps: [
        { kind: 'move', status: 'done' },
        { kind: 'create_card', type: 'bug', linkField: 'f-parent' },
        { kind: 'set_field', field: 'f-when', value: { from: 'due' } },
        { kind: 'set_field', field: 'f-points', value: 3 },
        { kind: 'clear_field', field: 'f-owner' },
        { kind: 'assign', to: { rotate: ['p-sam', 'p-ali'] } },
        { kind: 'assign', to: 'nobody' },
        { kind: 'email', to: { person: 'p-ali' } },
        { kind: 'mention', to: { person: 'p-sam' } },
        { kind: 'set_type', type: 'note' },
        { kind: 'link_card', field: 'f-parent', to: { trigger: true } },
        { kind: 'ai', task: 'summarise', field: 'f-severity' },
        {
          kind: 'if',
          conditions: [{ kind: 'column', statuses: ['todo'] }],
          then: [{ kind: 'move', status: 'doing' }],
          else: [{ kind: 'assign', to: { person: 'p-sam' } }],
        },
        {
          kind: 'for',
          related: { kind: 'linked', field: 'f-links', tab: 'form1' },
          conditions: [],
          then: [{ kind: 'move', status: 'done' }],
        },
        { kind: 'for', related: 'children', then: 'x' },
        7,
      ],
    });
    // A copy: the input is untouched.
    expect(body).toEqual(before);
  });

  // item-types.md "Explicit mappings": a source named across every type, a target within the new type first.
  it('names a Change Card Type mapping’s fields, keeping one the plan lacks', () => {
    expect(
      namedRuleBody(
        {
          steps: [
            {
              kind: 'set_type',
              type: 'Note',
              map: [
                { from: 'Severity', to: 'links' },
                { from: 'f-points', to: 'Description' },
                { from: 'Gone', to: 'Nowhere' },
              ],
            },
          ],
        },
        NAMES,
      ),
    ).toEqual({
      steps: [
        {
          kind: 'set_type',
          type: 'note',
          map: [
            { from: 'f-severity', to: 'f-links' },
            { from: 'f-points', to: 'description' },
            { from: 'Gone', to: 'Nowhere' },
          ],
        },
      ],
    });
    // A copy's refs keep a mapping's fields through the field map.
    expect(
      ruleWithRefs(
        { steps: [{ kind: 'set_type', type: 'a', map: [{ from: 'x', to: 'y' }] }] },
        { field: (f) => `${f}2` },
      ),
    ).toEqual({ steps: [{ kind: 'set_type', type: 'a', map: [{ from: 'x2', to: 'y2' }] }] });
  });

  it('answers anything but an object as it came', () => {
    expect(namedRuleBody('x', NAMES)).toBe('x');
    expect(namedRuleBody({ trigger: 'x', steps: 3 }, NAMES)).toEqual({ trigger: 'x', steps: 3 });
  });
});

// docs/specs/026-plan/automations.md "Agents and the CLI": every part that takes a person names one by id or by the
// name list_rules lists; a name nobody has, or two people share, is kept as written (the rule needs attention).
describe('namedRuleBody, people', () => {
  // Each part that takes a person, holding `p`.
  const body = (p: string) => ({
    trigger: { kind: 'mentioned', people: [p] },
    conditions: [{ kind: 'who', who: [{ person: p }] }],
    steps: [
      { kind: 'mention', to: { person: p }, text: 'Look' },
      { kind: 'email', to: { person: p }, subject: 's', body: 'b' },
      { kind: 'assign', to: { person: p } },
      { kind: 'assign', to: { rotate: [p, 'p-ali'] } },
      { kind: 'set_field', field: 'assignee', value: { text: p } },
      { kind: 'set_field', field: 'Owner', value: { text: p } },
      {
        kind: 'if',
        conditions: [{ kind: 'who', who: [{ person: p }] }],
        then: [{ kind: 'mention', to: { person: p }, text: 'Look' }],
        else: [],
      },
    ],
  });
  const named = (p: string) => {
    const out = body(p);
    out.steps[5] = { kind: 'set_field', field: 'f-owner', value: { text: p } };
    return out;
  };

  it.each([
    ['their name', 'Sam Lee'],
    ['their name, case and spacing aside', '  sam   LEE '],
    ['their id', 'p-sam'],
  ])('names a person by %s in every part that takes one', (_how, ref) => {
    expect(namedRuleBody(body(ref), NAMES)).toEqual(named('p-sam'));
  });

  it('keeps a name nobody has as written, so the rule needs attention', () => {
    expect(namedRuleBody(body('Thomas Gone'), NAMES)).toEqual(named('Thomas Gone'));
  });

  it('flags a name kept as written as a person gone, and nothing once it names someone', () => {
    const rule = (p: string) =>
      namedRuleBody(
        ruleBody({ steps: [{ kind: 'mention', to: { person: p }, text: 'Look' }] }),
        NAMES,
      );
    expect(ruleNeeds(rule('Thomas Gone'), OUTLINE)).toEqual(['Person Thomas Gone is gone']);
    expect(ruleNeeds(rule('Sam Lee'), OUTLINE)).toEqual([]);
  });

  it('never guesses between two people of one name', () => {
    const twins = { ...NAMES, people: [SAM, { id: 'p-sam2', name: 'Sam Lee' }, ALI] };
    expect(namedRuleBody(body('Sam Lee'), twins)).toEqual(named('Sam Lee'));
    // Each still named by id.
    expect(namedRuleBody(body('p-sam2'), twins)).toEqual(named('p-sam2'));
  });

  it('leaves a Set Field’s value filled in, and a field that holds no person', () => {
    const steps = [
      { kind: 'set_field', field: 'assignee', value: { text: '{{person}}' } },
      { kind: 'set_field', field: 'title', value: { text: 'Sam Lee' } },
      { kind: 'set_field', field: 'f-owner', value: { from: 'assignee' } },
      { kind: 'set_field', field: 'f-owner', value: { text: 7 } },
    ];
    expect(namedRuleBody({ steps }, NAMES).steps).toEqual(steps);
  });

  it('names no Set Field people through ruleWithRefs unless asked', () => {
    const steps = [{ kind: 'set_field', field: 'assignee', value: { text: 'Sam Lee' } }];
    expect(ruleWithRefs({ steps }, { person: () => 'x' }).steps).toEqual(steps);
  });
});

// docs/specs/026-plan/automations.md "Copies, exports and deletes": a copy's tabs take new ids, and its rules follow.
describe('ruleWithTabIds', () => {
  const tabs = new Map([
    ['form1', 'form2'],
    ['board1', 'board2'],
  ]);
  it('re-points a Form tab and every saved filter at the copy’s tabs, and keeps the rest', () => {
    const filter = (tab: string) => ({ kind: 'saved_filter', tab, filter: 'f1' });
    const body = {
      trigger: { kind: 'form_response', formTab: 'form1' },
      conditions: [filter('board1'), { kind: 'column', statuses: ['todo'] }],
      steps: [
        { kind: 'if', conditions: [filter('board1')], then: [], else: [] },
        { kind: 'for', related: filter('gone'), conditions: [filter('board1')], then: [] },
        { kind: 'move', status: 'done' },
      ],
    };
    expect(ruleWithTabIds(body, tabs)).toEqual({
      trigger: { kind: 'form_response', formTab: 'form2' },
      conditions: [filter('board2'), { kind: 'column', statuses: ['todo'] }],
      steps: [
        { kind: 'if', conditions: [filter('board2')], then: [], else: [] },
        { kind: 'for', related: filter('gone'), conditions: [filter('board2')], then: [] },
        { kind: 'move', status: 'done' },
      ],
    });
    expect(body.trigger.formTab).toBe('form1');
    expect(ruleWithTabIds('x', tabs)).toBe('x');
    expect(ruleWithTabIds({ steps: [] }, tabs)).toEqual({ steps: [] });
  });
});
