import { describe, expect, it } from 'vitest';
import { ruleNeeds } from './attention';
import { OUTLINE, ruleBody } from './test-fixtures';

// docs/specs/026-plan/automations.md "Conditions" (Needs Attention) and "Copies, exports and deletes".
describe('ruleNeeds', () => {
  it('needs nothing when everything it names is in the plan', () => {
    expect(
      ruleNeeds(
        ruleBody({
          trigger: { kind: 'card_moved', from: ['todo'], to: ['done'] },
          conditions: [
            { kind: 'type', types: ['bug'] },
            { kind: 'who', who: [{ person: 'p-sam' }, { role: 'editor' }] },
            { kind: 'saved_filter', tab: 't1', filter: 'sf-mine' },
          ],
          steps: [
            { kind: 'set_field', field: 'f-points', value: { from: 'estimate' } },
            { kind: 'set_field', field: 'due', value: { date: { today: 1 } } },
            { kind: 'assign', to: { trigger: true } },
            { kind: 'email', to: { assignee: true }, subject: 's', body: 'b' },
            { kind: 'create_card', type: 'note', title: 't' },
            { kind: 'flag' },
          ],
        }),
        OUTLINE,
      ),
    ).toEqual([]);
  });

  it('names each thing gone once, in the order the rule names it', () => {
    const needs = ruleNeeds(
      ruleBody({
        trigger: { kind: 'field_changed', fields: ['f-gone'] },
        conditions: [
          { kind: 'column', statuses: ['qa'] },
          { kind: 'field', field: 'f-gone', op: 'empty' },
          { kind: 'saved_filter', tab: 't9', filter: 'x' },
        ],
        steps: [
          {
            kind: 'if',
            conditions: [{ kind: 'type', types: ['epic'] }],
            then: [{ kind: 'assign', to: { person: 'p-gone' } }],
            else: [{ kind: 'email', to: { person: 'p-gone2' }, subject: 's', body: 'b' }],
          },
          { kind: 'move', status: 'qa' },
          { kind: 'clear_field', field: 'f-old' },
          { kind: 'create_card', type: 'epic', title: 't', status: 'qa2', linkField: 'f-link' },
        ],
      }),
      OUTLINE,
    );
    expect(needs).toEqual([
      'Field f-gone is gone',
      'Column qa is gone',
      'Saved filter t9/x is gone',
      'Card type epic is gone',
      'Person p-gone is gone',
      'Person p-gone2 is gone',
      'Field f-old is gone',
      'Column qa2 is gone',
      'Field f-link is gone',
    ]);
  });

  it('checks the trigger: a column made in, a Form tab', () => {
    expect(
      ruleNeeds(ruleBody({ trigger: { kind: 'card_created', status: 'qa' } }), OUTLINE),
    ).toEqual(['Column qa is gone']);
    expect(
      ruleNeeds(ruleBody({ trigger: { kind: 'form_response', formTab: 'f9' } }), OUTLINE),
    ).toEqual(['Form tab f9 is gone']);
    expect(
      ruleNeeds(ruleBody({ trigger: { kind: 'form_response', formTab: 'form1' } }), OUTLINE),
    ).toEqual([]);
    expect(ruleNeeds(ruleBody({ trigger: { kind: 'card_moved' } }), OUTLINE)).toEqual([]);
    expect(ruleNeeds(ruleBody({ trigger: { kind: 'manual' } }), OUTLINE)).toEqual([]);
  });
});

// Phase 2 (#712): people in turn, a branch's cards, fields and conditions, and webhooks when the caller has them.
describe('ruleNeeds, Phase 2', () => {
  const rule = ruleBody({
    trigger: { kind: 'scheduled', every: 'day', at: '09:00' },
    steps: [
      { kind: 'assign', to: { rotate: ['p-sam', 'p-gone'] } },
      {
        kind: 'for',
        related: { kind: 'saved_filter', tab: 't1', filter: 'sf-gone' },
        conditions: [{ kind: 'column', statuses: ['col-gone'] }],
        then: [{ kind: 'move', status: 'done' }],
      },
      {
        kind: 'for',
        related: { kind: 'linked', field: 'f-gone' },
        conditions: [],
        then: [{ kind: 'flag' }],
      },
      { kind: 'for', related: { kind: 'children' }, conditions: [], then: [{ kind: 'flag' }] },
      { kind: 'notify', via: 'slack', webhook: 'wh-gone', text: 'x' },
      { kind: 'notify', via: 'slack', webhook: 'wh1', text: 'x' },
    ],
  });
  it('names what is gone', () => {
    expect(ruleNeeds(rule, OUTLINE)).toEqual([
      'Person p-gone is gone',
      'Saved filter t1/sf-gone is gone',
      'Column col-gone is gone',
      'Field f-gone is gone',
    ]);
    expect(ruleNeeds(rule, OUTLINE, new Set(['wh1']))).toContain('Webhook wh-gone is gone');
    expect(ruleNeeds(rule, OUTLINE, new Set(['wh1']))).not.toContain('Webhook wh1 is gone');
  });
});
