import { describe, expect, it } from 'vitest';
import { ANA, listOf, PLAN } from '../testing/rules';
import { namedRuleBody } from './rule-names';
import type { RulesState } from './rule-state';

// docs/specs/026-plan/automations.md "Agents and the CLI", "The rule body": names as the board shows them become ids.
const STATE: RulesState = { list: listOf(), plan: PLAN };

describe('namedRuleBody', () => {
  it('names a trigger’s columns, fields and Form tab', () => {
    expect(
      namedRuleBody({ trigger: { kind: 'card_moved', from: ['to do', 7], to: 'Done' } }, STATE),
    ).toEqual({ trigger: { kind: 'card_moved', from: ['todo', 7], to: 'done' } });
    expect(
      namedRuleBody(
        {
          trigger: {
            kind: 'field_changed',
            fields: ['Severity', 'Deadline', 'due date', 'title', 'Gone'],
          },
        },
        STATE,
      ),
    ).toEqual({
      trigger: { kind: 'field_changed', fields: ['f-sev', 'due', 'due', 'title', 'Gone'] },
    });
    expect(namedRuleBody({ trigger: { kind: 'form_response', formTab: 'rsvp' } }, STATE)).toEqual({
      trigger: { kind: 'form_response', formTab: 'f_1' },
    });
    // Ids are kept, a number is left for the api to refuse.
    expect(namedRuleBody({ trigger: { kind: 'card_created', status: 'done' } }, STATE)).toEqual({
      trigger: { kind: 'card_created', status: 'done' },
    });
    expect(
      namedRuleBody({ trigger: { kind: 'field_changed', fields: ['f-done', 'due'] } }, STATE),
    ).toEqual({ trigger: { kind: 'field_changed', fields: ['f-done', 'due'] } });
    expect(namedRuleBody({ trigger: 'x', steps: 3 }, STATE)).toEqual({ trigger: 'x', steps: 3 });
  });

  it('names every condition kind, and leaves what it cannot read', () => {
    const body = {
      conditions: [
        { kind: 'type', types: ['Bug'] },
        { kind: 'column', statuses: ['Done'] },
        { kind: 'field', field: 'Completed On', op: 'empty' },
        { kind: 'saved_filter', tab: 'Board', filter: 'mine' },
        { kind: 'who', who: [{ person: 'ana costa' }, { role: 'agent' }, 'x'] },
        { kind: 'who', who: 'nobody' },
        'not a condition',
      ],
    };
    expect(namedRuleBody(body, STATE).conditions).toEqual([
      { kind: 'type', types: ['bug'] },
      { kind: 'column', statuses: ['done'] },
      { kind: 'field', field: 'f-done', op: 'empty' },
      { kind: 'saved_filter', tab: 't_1', filter: 'mine' },
      { kind: 'who', who: [{ person: 'p_ana' }, { role: 'agent' }, 'x'] },
      { kind: 'who', who: 'nobody' },
      'not a condition',
    ]);
  });

  it('names every step kind, inside an If / Else and a branch too', () => {
    const body = {
      steps: [
        { kind: 'move', status: 'Done' },
        { kind: 'set_field', field: 'Completed On', value: { from: 'Deadline' } },
        { kind: 'set_field', field: 'f-sev', value: 'High' },
        { kind: 'clear_field', field: 'Severity' },
        { kind: 'assign', to: { rotate: ['Ana Costa', 'Bo'] } },
        { kind: 'assign', to: 'nobody' },
        { kind: 'email', to: { person: 'Ana Costa' }, subject: 's', body: 'b' },
        { kind: 'create_card', type: 'Bug', title: 't', status: 'To Do', linkField: 'Severity' },
        {
          kind: 'if',
          conditions: [{ kind: 'column', statuses: ['Done'] }],
          then: [{ kind: 'move', status: 'To Do' }],
          else: [{ kind: 'assign', to: { person: 'Ana Costa' } }],
        },
        {
          kind: 'for',
          related: { kind: 'saved_filter', tab: 'Board', filter: 'f' },
          conditions: [],
          then: [{ kind: 'flag' }],
        },
        { kind: 'for', related: 'children', then: 'x' },
      ],
    };
    const input = structuredClone(body);
    expect(namedRuleBody(body, STATE).steps).toEqual([
      { kind: 'move', status: 'done' },
      { kind: 'set_field', field: 'f-done', value: { from: 'due' } },
      { kind: 'set_field', field: 'f-sev', value: 'High' },
      { kind: 'clear_field', field: 'f-sev' },
      { kind: 'assign', to: { rotate: ['p_ana', 'Bo'] } },
      { kind: 'assign', to: 'nobody' },
      { kind: 'email', to: { person: 'p_ana' }, subject: 's', body: 'b' },
      { kind: 'create_card', type: 'bug', title: 't', status: 'todo', linkField: 'f-sev' },
      {
        kind: 'if',
        conditions: [{ kind: 'column', statuses: ['done'] }],
        then: [{ kind: 'move', status: 'todo' }],
        else: [{ kind: 'assign', to: { person: 'p_ana' } }],
      },
      {
        kind: 'for',
        related: { kind: 'saved_filter', tab: 't_1', filter: 'f' },
        conditions: [],
        then: [{ kind: 'flag' }],
      },
      { kind: 'for', related: 'children', then: 'x' },
    ]);
    // A copy: the agent's body is untouched.
    expect(body).toEqual(input);
  });

  it('leaves a body that is no object, and names nobody on a plan without people or tabs', () => {
    expect(namedRuleBody('x', STATE)).toBe('x');
    const { people: _people, ...noPeople } = listOf([]);
    const bare: RulesState = { list: noPeople, plan: { ...PLAN, tabs: undefined } };
    expect(
      namedRuleBody(
        {
          trigger: { kind: 'form_response', formTab: 'RSVP' },
          steps: [{ kind: 'assign', to: { person: ANA.name } }],
        },
        bare,
      ),
    ).toEqual({
      trigger: { kind: 'form_response', formTab: 'RSVP' },
      steps: [{ kind: 'assign', to: { person: 'Ana Costa' } }],
    });
  });
});
