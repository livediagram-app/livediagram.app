import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '../item-types';
import { needLine, ruleNeedItems, ruleNeeds } from './attention';
import { unheardFields } from './outline';
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

  it('names a person a Set Field on a Person field picked who has left, by the text it holds', () => {
    const set = (field: string, text: string) =>
      ({ kind: 'set_field', field, value: { text } }) as const;
    expect(
      ruleNeedItems(
        ruleBody({
          steps: [
            set('assignee', 'p-sam'),
            set('f-owner', 'ali'),
            set('assignee', '{{person}}'),
            set('assignee', ' '),
            set('title', 'p-left'),
            set('f-owner', 'p-left'),
          ],
        }),
        OUTLINE,
      ),
    ).toEqual([{ kind: 'person', id: 'p-left' }]);
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

  it('answers the same needs as data, for the editor to word without ids', () => {
    expect(
      ruleNeedItems(
        ruleBody({
          trigger: { kind: 'card_moved', to: ['qa'] },
          steps: [
            { kind: 'assign', to: { person: 'p-gone' } },
            { kind: 'move', status: 'qa' },
          ],
        }),
        OUTLINE,
      ),
    ).toEqual([
      { kind: 'column', id: 'qa' },
      { kind: 'person', id: 'p-gone' },
    ]);
    expect(needLine({ kind: 'unheard', name: 'Time Spent' })).toBe(
      'Field Changed never hears Time Spent',
    );
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
    // Card Moved's Card Types: a deleted type needs attention, as a gone column does.
    expect(
      ruleNeedItems(
        ruleBody({ trigger: { kind: 'card_moved', types: ['bug', 'epic'], to: ['qa'] } }),
        OUTLINE,
      ),
    ).toEqual([
      { kind: 'type', id: 'epic' },
      { kind: 'column', id: 'qa' },
    ]);
    expect(
      ruleNeeds(ruleBody({ trigger: { kind: 'card_moved', types: ['bug'] } }), OUTLINE),
    ).toEqual([]);
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

describe('the triggers after Phase 3', () => {
  it('needs the columns and people they name', () => {
    expect(
      ruleNeeds(ruleBody({ trigger: { kind: 'column_limit', status: 'gone', limit: 3 } }), OUTLINE),
    ).toHaveLength(1);
    expect(
      ruleNeeds(
        ruleBody({ trigger: { kind: 'stuck', days: 3, at: '09:00', statuses: ['todo', 'gone'] } }),
        OUTLINE,
      ),
    ).toHaveLength(1);
    expect(
      ruleNeeds(ruleBody({ trigger: { kind: 'mentioned', people: ['p-nobody'] } }), OUTLINE),
    ).toHaveLength(1);
    expect(ruleNeeds(ruleBody({ trigger: { kind: 'mentioned' } }), OUTLINE)).toEqual([]);
  });
});

// docs/specs/026-plan/automations.md "GitHub triggers": a GitHub rule on a plan not connected needs attention.
describe('a GitHub rule on a plan not connected', () => {
  const github = ruleBody({ trigger: { kind: 'pull_request_merged' } });

  it('needs attention only when the caller says the plan is not connected', () => {
    expect(ruleNeedItems(github, OUTLINE, undefined, false)).toEqual([{ kind: 'github' }]);
    expect(ruleNeeds(github, OUTLINE)).toEqual([]);
    expect(ruleNeedItems(github, OUTLINE, undefined, ['acme/web'])).toEqual([]);
    expect(needLine({ kind: 'github' })).toBe('GitHub is not connected');
  });

  it('marks no other trigger, and comes first beside what else the rule lacks', () => {
    expect(ruleNeedItems(ruleBody(), OUTLINE, undefined, false)).toEqual([]);
    const both = ruleBody({
      trigger: { kind: 'pull_request_checks', result: 'failing' },
      steps: [{ kind: 'move', status: 'gone' }],
    });
    expect(ruleNeedItems(both, OUTLINE, undefined, false).map((n) => n.kind)).toEqual([
      'github',
      'column',
    ]);
  });
});

// Work Tracker 821 ("GitHub triggers"): a GitHub trigger whose named repositories all left the connection hears
// nothing, so it needs attention naming them; while one is still heard it doesn't.
describe('a GitHub rule whose named repositories are gone', () => {
  const naming = (...repositories: string[]) =>
    ruleBody({ trigger: { kind: 'pull_request_opened', repositories } });

  it('needs attention when every named repository is gone, naming them as the rule holds them', () => {
    expect(
      ruleNeedItems(naming('acme/old', 'acme/gone'), OUTLINE, undefined, ['acme/web']),
    ).toEqual([{ kind: 'repositories', names: ['acme/old', 'acme/gone'] }]);
    expect(ruleNeedItems(naming('acme/old'), OUTLINE, undefined, [])).toEqual([
      { kind: 'repositories', names: ['acme/old'] },
    ]);
  });

  it('needs none while some named repository is still heard, any case', () => {
    expect(ruleNeedItems(naming('acme/old', 'ACME/Web'), OUTLINE, undefined, ['acme/web'])).toEqual(
      [],
    );
  });

  it('checks nothing without the connection, nor a trigger naming none or another trigger', () => {
    expect(ruleNeedItems(naming('acme/old'), OUTLINE)).toEqual([]);
    expect(ruleNeedItems(naming(), OUTLINE, undefined, [])).toEqual([]);
    expect(ruleNeedItems(ruleBody(), OUTLINE, undefined, [])).toEqual([]);
  });

  it('reads as agents read it', () => {
    expect(needLine({ kind: 'repositories', names: ['acme/old'] })).toBe(
      'Repository acme/old is not heard',
    );
    expect(needLine({ kind: 'repositories', names: ['acme/old', 'acme/gone'] })).toBe(
      'Repositories acme/old, acme/gone are not heard',
    );
  });
});

describe('Link Cards', () => {
  const rule = ruleBody({
    steps: [
      { kind: 'link_card', field: 'f-links', to: { card: 'c-gone' } },
      { kind: 'link_card', field: 'f-links', to: { card: 'c-here' } },
    ],
  });
  it('needs its chosen card when the plan has lost it', () => {
    expect(ruleNeeds(rule, { ...OUTLINE, cards: new Set(['c-here']) })).toEqual([
      'Card c-gone is gone',
    ]);
  });
  it('leaves chosen cards unchecked when the caller read no cards', () => {
    expect(ruleNeeds(rule, OUTLINE)).toEqual([]);
  });
});

describe('Field Changed on a field no write changes', () => {
  const timed: ItemTypeDef = {
    ...OUTLINE.types[0]!,
    id: 'timed',
    fields: ['title', 'f-time', 'f-votes', 'f-talk', 'f-kids', 'f-left'],
    custom: [
      { id: 'f-time', label: 'Time Spent', kind: 'duration', timeSpent: true },
      { id: 'f-votes', label: 'Votes Here', kind: 'votes' },
      { id: 'f-talk', label: 'Talk', kind: 'comments' },
      { id: 'f-kids', label: 'Children', kind: 'calculated', calculation: 'childCount' },
      { id: 'f-left', label: 'Time Left', kind: 'duration' },
    ],
  };
  const outline = { ...OUTLINE, types: [timed] };

  it('names each one Field Changed never hears, and passes a field it does', () => {
    const fields = [
      'f-time',
      'f-votes',
      'f-talk',
      'f-kids',
      'f-left',
      'votes',
      'comments',
      'title',
    ];
    expect(unheardFields(outline.types, fields)).toEqual([
      { id: 'f-time', name: 'Time Spent' },
      { id: 'f-votes', name: 'Votes Here' },
      { id: 'f-talk', name: 'Talk' },
      { id: 'f-kids', name: 'Children' },
      { id: 'votes', name: 'Votes' },
      { id: 'comments', name: 'Comments' },
    ]);
    const rule = ruleBody({ trigger: { kind: 'field_changed', fields: ['f-time', 'f-left'] } });
    expect(ruleNeeds(rule, outline)).toEqual(['Field Changed never hears Time Spent']);
  });
});
