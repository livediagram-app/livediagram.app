import { describe, expect, it } from 'vitest';
import { namedRuleBody, type RuleNames } from './named';
import { ALI, BUG, NOTE, OUTLINE, SAM } from './test-fixtures';

// docs/specs/026-plan/automations.md "Agents and the CLI", "Describe a Rule": names as the board shows them become ids.
// The adapter's own cases are agent-verbs' rule-names.test.ts; these walk every part items reads.
const NAMES: RuleNames = {
  statuses: OUTLINE.statuses,
  types: [BUG, NOTE],
  people: [SAM, ALI],
  tabs: [{ id: 'form1', name: 'RSVP' }],
};

describe('namedRuleBody', () => {
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

  it('answers anything but an object as it came', () => {
    expect(namedRuleBody('x', NAMES)).toBe('x');
    expect(namedRuleBody({ trigger: 'x', steps: 3 }, NAMES)).toEqual({ trigger: 'x', steps: 3 });
  });
});
