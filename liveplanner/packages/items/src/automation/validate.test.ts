import { describe, expect, it } from 'vitest';
import { countActions, freeRuleName, readRuleBody, ruleHasAction, ruleNameTaken } from './validate';
import { ruleBody } from './test-fixtures';
import type { AutomationAction } from './types';

// docs/specs/026-plan/automations.md "A rule", "Limits"; blueprint "Routes" (400 automation_invalid + path).
const flags = (n: number): AutomationAction[] =>
  Array.from({ length: n }, () => ({ kind: 'flag' as const }));
const pathOf = (raw: unknown) => {
  const r = readRuleBody(raw);
  return 'body' in r ? null : r.path;
};
const withRule = (extra: Record<string, unknown>) => ({ ...ruleBody(), ...extra });
const withStep = (step: unknown) => withRule({ steps: [step] });
const withCondition = (c: unknown) => withRule({ conditions: [c] });

describe('readRuleBody', () => {
  it('keeps a well formed rule, its name trimmed and unknown keys dropped', () => {
    const raw = {
      ...ruleBody({
        name: '  Triage  ',
        chain: true,
        trigger: { kind: 'field_changed', fields: ['priority', 'priority'] },
        conditions: [
          { kind: 'type', types: ['bug'], not: true },
          { kind: 'column', statuses: ['todo'], not: false as never },
          { kind: 'field', field: 'due', op: 'before', value: { today: 3 } },
          { kind: 'field', field: 'estimate', op: 'less_than', value: 5 },
          { kind: 'field', field: 'estimate', op: 'is', value: 5 },
          { kind: 'field', field: 'labels', op: 'contains', value: ['a'] },
          { kind: 'field', field: 'title', op: 'is', value: '{{card.key}}' },
          { kind: 'field', field: 'due', op: 'empty', value: 'ignored' },
          { kind: 'who', who: [{ person: 'p1' }, { role: 'agent' }] },
          { kind: 'saved_filter', tab: 't', filter: 'f' },
        ],
        steps: [
          { kind: 'move', status: 'done' },
          { kind: 'set_field', field: 'title', value: { text: '{{card.title}}!' } },
          { kind: 'set_field', field: 'estimate', value: { number: 3 } },
          { kind: 'set_field', field: 'labels', value: { list: ['a'] } },
          { kind: 'set_field', field: 'due', value: { date: { day: '2026-11-11' } } },
          { kind: 'set_field', field: 'f-x', value: { from: 'title' } },
          { kind: 'clear_field', field: 'due' },
          { kind: 'assign', to: { person: 'p1' } },
          { kind: 'assign', to: { trigger: true } },
          { kind: 'assign', to: { nobody: true } },
          { kind: 'add_label', label: ' bug ' },
          { kind: 'remove_label', label: 'old' },
          { kind: 'comment', text: 'Hi {{person}}' },
          {
            kind: 'if',
            conditions: [{ kind: 'column', statuses: ['done'] }],
            then: [{ kind: 'flag' }],
            else: [{ kind: 'unflag' }, { kind: 'archive' }],
          },
          {
            kind: 'create_card',
            type: 'task',
            title: 'Follow up',
            status: 'todo',
            copy: ['labels'],
            linkField: 'f-l',
          },
          { kind: 'email', to: { assignee: true }, subject: 'S', body: 'B' },
          { kind: 'email', to: { trigger: true }, subject: 'S', body: 'B' },
          { kind: 'email', to: { person: 'p1' }, subject: 'S', body: 'B' },
        ],
      }),
      extra: 'dropped',
    };
    const r = readRuleBody(raw);
    if (!('body' in r)) throw new Error(r.message);
    expect(r.body.name).toBe('Triage');
    expect(r.body.trigger).toEqual({ kind: 'field_changed', fields: ['priority'] });
    expect(r.body).not.toHaveProperty('extra');
    expect(r.body.conditions[0]).toEqual({ kind: 'type', not: true, types: ['bug'] });
    expect(r.body.conditions[1]).toEqual({ kind: 'column', statuses: ['todo'] });
    expect(r.body.conditions[7]).toEqual({ kind: 'field', field: 'due', op: 'empty' });
    expect(r.body.steps[10]).toEqual({ kind: 'add_label', label: 'bug' });
    expect(countActions(r.body.steps)).toBe(20);
  });

  it('reads each trigger, with and without what narrows it', () => {
    const triggers = [
      { kind: 'card_created' },
      { kind: 'card_created', status: 'todo' },
      { kind: 'form_response' },
      { kind: 'form_response', formTab: 'f' },
      { kind: 'card_moved' },
      { kind: 'card_moved', from: ['a'], to: ['b'] },
      { kind: 'comment_added' },
      { kind: 'manual' },
    ];
    for (const trigger of triggers) {
      const r = readRuleBody(withRule({ trigger }));
      expect('body' in r && r.body.trigger).toEqual(trigger);
    }
  });

  it('takes a rule with no steps yet, conditions absent and chain absent', () => {
    const r = readRuleBody({ name: 'n', timeZone: 'UTC', trigger: { kind: 'manual' }, steps: [] });
    expect(r).toMatchObject({ body: { conditions: [], steps: [], chain: false } });
  });

  it.each([
    ['not an object', null, 'rule'],
    ['no name', withRule({ name: ' ' }), 'name'],
    ['a name too long', withRule({ name: 'x'.repeat(61) }), 'name'],
    ['a name not text', withRule({ name: 3 }), 'name'],
    ['a bad zone', withRule({ timeZone: 'Mars/Base' }), 'timeZone'],
    ['chain not a boolean', withRule({ chain: 'yes' }), 'chain'],
    ['no trigger', withRule({ trigger: undefined }), 'trigger'],
    ['an unknown trigger', withRule({ trigger: { kind: 'tick' } }), 'trigger.kind'],
    ['a bad status', withRule({ trigger: { kind: 'card_created', status: '' } }), 'trigger.status'],
    [
      'a bad form tab',
      withRule({ trigger: { kind: 'form_response', formTab: 1 } }),
      'trigger.formTab',
    ],
    ['from not a list', withRule({ trigger: { kind: 'card_moved', from: 'a' } }), 'trigger.from'],
    ['a bad id in to', withRule({ trigger: { kind: 'card_moved', to: [''] } }), 'trigger.to.0'],
    ['no fields', withRule({ trigger: { kind: 'field_changed', fields: [] } }), 'trigger.fields'],
    [
      'too many ids',
      withRule({ trigger: { kind: 'field_changed', fields: Array(51).fill('a') } }),
      'trigger.fields',
    ],
    ['conditions not a list', withRule({ conditions: {} }), 'conditions'],
    [
      'too many conditions',
      withRule({ conditions: Array(11).fill({ kind: 'type', types: ['a'] }) }),
      'conditions',
    ],
    ['a condition not an object', withCondition('x'), 'conditions.0'],
    ['an unknown condition', withCondition({ kind: 'mood' }), 'conditions.0.kind'],
    ['not true', withCondition({ kind: 'type', not: 1, types: ['a'] }), 'conditions.0.not'],
    ['no types', withCondition({ kind: 'type', types: [] }), 'conditions.0.types'],
    ['no statuses', withCondition({ kind: 'column' }), 'conditions.0.statuses'],
    ['a bad op', withCondition({ kind: 'field', field: 'a', op: 'like' }), 'conditions.0.op'],
    ['no field', withCondition({ kind: 'field', op: 'empty' }), 'conditions.0.field'],
    [
      'a bad day',
      withCondition({ kind: 'field', field: 'a', op: 'after', value: { day: '2026-13-01' } }),
      'conditions.0.value',
    ],
    [
      'too many days',
      withCondition({ kind: 'field', field: 'a', op: 'after', value: { today: 4000 } }),
      'conditions.0.value',
    ],
    [
      'a day not an object',
      withCondition({ kind: 'field', field: 'a', op: 'after', value: 3 }),
      'conditions.0.value',
    ],
    [
      'a number op with text',
      withCondition({ kind: 'field', field: 'a', op: 'less_than', value: 'x' }),
      'conditions.0.value',
    ],
    ['no value', withCondition({ kind: 'field', field: 'a', op: 'is' }), 'conditions.0.value'],
    [
      'an empty list',
      withCondition({ kind: 'field', field: 'a', op: 'is', value: [] }),
      'conditions.0.value',
    ],
    [
      'an unknown value',
      withCondition({ kind: 'field', field: 'a', op: 'is', value: '{{x}}' }),
      'conditions.0.value',
    ],
    ['no one', withCondition({ kind: 'who', who: [] }), 'conditions.0.who'],
    ['a bad who', withCondition({ kind: 'who', who: [{ role: 'owner' }] }), 'conditions.0.who.0'],
    ['a bad filter', withCondition({ kind: 'saved_filter', tab: 't' }), 'conditions.0.filter'],
    ['steps not a list', withRule({ steps: 'flag' }), 'steps'],
    ['too many actions', withRule({ steps: flags(21) }), 'steps'],
    ['a step not an object', withStep(1), 'steps.0'],
    ['an unknown action', withStep({ kind: 'dance' }), 'steps.0.kind'],
    ['a move with no column', withStep({ kind: 'move' }), 'steps.0.status'],
    [
      'a set with no value',
      withStep({ kind: 'set_field', field: 'a', value: {} }),
      'steps.0.value',
    ],
    [
      'a set number not a number',
      withStep({ kind: 'set_field', field: 'a', value: { number: 'x' } }),
      'steps.0.value.number',
    ],
    [
      'a set text too long',
      withStep({ kind: 'set_field', field: 'a', value: { text: 'x'.repeat(2001) } }),
      'steps.0.value.text',
    ],
    ['a clear with no field', withStep({ kind: 'clear_field' }), 'steps.0.field'],
    ['an assign to no one', withStep({ kind: 'assign', to: {} }), 'steps.0.to'],
    ['a label too long', withStep({ kind: 'add_label', label: 'x'.repeat(33) }), 'steps.0.label'],
    ['an empty comment', withStep({ kind: 'comment', text: '  ' }), 'steps.0.text'],
    [
      'a comment with an unknown value',
      withStep({ kind: 'comment', text: '{{card.owner}}' }),
      'steps.0.text',
    ],
    [
      'a create with a bad copy',
      withStep({ kind: 'create_card', type: 't', title: 'x', copy: ['priority'] }),
      'steps.0.copy',
    ],
    ['a create with no title', withStep({ kind: 'create_card', type: 't' }), 'steps.0.title'],
    [
      'an email to no one',
      withStep({ kind: 'email', to: {}, subject: 's', body: 'b' }),
      'steps.0.to',
    ],
    [
      'an email to no addresses',
      withStep({ kind: 'email', to: { addresses: [] }, subject: 's', body: 'b' }),
      'steps.0.to.addresses',
    ],
    [
      'an email to 11 addresses',
      withStep({
        kind: 'email',
        to: { addresses: Array.from({ length: 11 }, (_, i) => `p${i}@example.com`) },
        subject: 's',
        body: 'b',
      }),
      'steps.0.to.addresses',
    ],
    [
      'an email to a bad address',
      withStep({
        kind: 'email',
        to: { addresses: ['ana@example.com', 'not an address'] },
        subject: 's',
        body: 'b',
      }),
      'steps.0.to.addresses.1',
    ],
    [
      'an email to an address a header would misread',
      withStep({
        kind: 'email',
        to: { addresses: ['Ana <ana@example.com>'] },
        subject: 's',
        body: 'b',
      }),
      'steps.0.to.addresses.0',
    ],
    [
      'an email to an address that is not text',
      withStep({ kind: 'email', to: { addresses: [5] }, subject: 's', body: 'b' }),
      'steps.0.to.addresses.0',
    ],
    [
      'an email to addresses that are not text',
      withStep({ kind: 'email', to: { addresses: 'ana@example.com' }, subject: 's', body: 'b' }),
      'steps.0.to.addresses',
    ],
    [
      'an email subject too long',
      withStep({ kind: 'email', to: { trigger: true }, subject: 'x'.repeat(201), body: 'b' }),
      'steps.0.subject',
    ],
    [
      'an If with no condition',
      withStep({ kind: 'if', conditions: [], then: [], else: [] }),
      'steps.0.conditions',
    ],
    [
      'an If whose then is not a list',
      withStep({ kind: 'if', conditions: [{ kind: 'type', types: ['a'] }], then: 1, else: [] }),
      'steps.0.then',
    ],
    [
      'an If inside an If',
      withStep({
        kind: 'if',
        conditions: [{ kind: 'type', types: ['a'] }],
        then: [{ kind: 'if' }],
        else: [],
      }),
      'steps.0.then.0',
    ],
    [
      'two cards in one run',
      withRule({
        steps: [
          { kind: 'create_card', type: 't', title: 'a' },
          { kind: 'create_card', type: 't', title: 'b' },
        ],
      }),
      'steps',
    ],
  ])('refuses %s', (_name, raw, path) => {
    expect(pathOf(raw)).toBe(path);
  });

  it('says which value is unknown, as its own error', () => {
    expect(readRuleBody(withStep({ kind: 'comment', text: 'Hi {{owner}}' }))).toEqual({
      error: 'automation_value_unknown',
      path: 'steps.0.text',
      message: '{{owner}} is not a value',
    });
  });

  it('says text a step must hold needs 1 to its most characters, never "up to"', () => {
    expect(readRuleBody(withStep({ kind: 'comment', text: '  ' }))).toEqual({
      error: 'automation_invalid',
      path: 'steps.0.text',
      message: 'steps.0.text must be text of 1 to 2000 characters',
    });
  });

  it('counts a card in each branch of an If as one per run', () => {
    const step = {
      kind: 'if',
      conditions: [{ kind: 'type', types: ['a'] }],
      then: [{ kind: 'create_card', type: 't', title: 'a' }],
      else: [{ kind: 'create_card', type: 't', title: 'b' }],
    };
    expect(pathOf(withStep(step))).toBeNull();
  });

  it('lets anything but its own refusals through', () => {
    const raw = withRule({});
    Object.defineProperty(raw, 'name', {
      get() {
        throw new TypeError('boom');
      },
    });
    expect(() => readRuleBody(raw)).toThrow('boom');
  });
});

describe('rule names and actions', () => {
  const rules = [
    { id: 'a', name: 'New Rule' },
    { id: 'b', name: 'new rule 2' },
  ];

  it('finds a name taken by another rule, case aside', () => {
    expect(ruleNameTaken(' NEW RULE ', rules)).toBe(true);
    expect(ruleNameTaken('New Rule', rules, 'a')).toBe(false);
  });

  it('numbers the next free name, cut so the number fits', () => {
    expect(freeRuleName('New Rule', rules)).toBe('New Rule 3');
    expect(freeRuleName('Fresh', rules)).toBe('Fresh');
    const long = 'x'.repeat(60);
    expect(freeRuleName(long, [{ id: 'a', name: long }])).toBe(`${'x'.repeat(58)} 2`);
  });

  it('cuts the base, not the tail, so a copy of a long name still ends in copy', () => {
    const long = 'x'.repeat(60);
    const copy = `${'x'.repeat(55)} copy`;
    expect(freeRuleName(long, [{ id: 'a', name: long }], ' copy')).toBe(copy);
    expect(freeRuleName(long, [{ id: 'b', name: copy }], ' copy')).toBe(`${'x'.repeat(53)} copy 2`);
    expect(freeRuleName('Triage', [{ id: 'a', name: 'Triage copy' }], ' copy')).toBe(
      'Triage copy 2',
    );
  });

  it('knows whether a rule does anything', () => {
    expect(ruleHasAction({ steps: [] })).toBe(false);
    expect(
      ruleHasAction({
        steps: [{ kind: 'if', conditions: [], then: [], else: [{ kind: 'flag' }] }],
      }),
    ).toBe(true);
  });
});

describe('the triggers after Phase 3', () => {
  it('reads each, keeping only what narrows it', () => {
    const triggers = [
      { kind: 'card_archived' },
      { kind: 'card_restored' },
      { kind: 'checklist_completed' },
      { kind: 'threads_resolved' },
      { kind: 'card_unblocked' },
      { kind: 'mentioned' },
      { kind: 'mentioned', people: ['p1'] },
      { kind: 'related_done', related: 'linked' },
      { kind: 'column_limit', status: 'doing', limit: 5 },
      { kind: 'stuck', days: 5, at: '09:00' },
      { kind: 'stuck', days: 90, at: '09:15', statuses: ['doing'] },
    ];
    for (const trigger of triggers) {
      const r = readRuleBody(withRule({ trigger }));
      expect('body' in r && r.body.trigger).toEqual(trigger);
    }
    const empty = readRuleBody(withRule({ trigger: { kind: 'mentioned', people: [] } }));
    expect('body' in empty && empty.body.trigger).toEqual({ kind: 'mentioned' });
  });

  it.each([
    ['a relation it lacks', { kind: 'related_done', related: 'parents' }, 'trigger.related'],
    ['a limit of 0', { kind: 'column_limit', status: 'doing', limit: 0 }, 'trigger.limit'],
    ['a limit past 500', { kind: 'column_limit', status: 'doing', limit: 501 }, 'trigger.limit'],
    ['stuck past 90 days', { kind: 'stuck', days: 91, at: '09:00' }, 'trigger.days'],
  ])('refuses %s', (_, trigger, path) => {
    expect(pathOf(withRule({ trigger }))).toBe(path);
  });
});

describe('the actions after Phase 3 and Wait', () => {
  const bodyOf = (raw: unknown) => {
    const r = readRuleBody(raw);
    if (!('body' in r)) throw new Error(r.path);
    return r.body;
  };

  it('reads them, trimming checklist items', () => {
    const body = bodyOf(
      withRule({
        steps: [
          { kind: 'copy_card', status: 'done' },
          { kind: 'add_checklist', items: [' Write tests ', 'Ship'] },
          { kind: 'link_card', field: 'f-parent', to: { card: 'c1' } },
          { kind: 'restore' },
          { kind: 'resolve_threads' },
          { kind: 'wait', hours: 48 },
          { kind: 'flag' },
        ],
      }),
    );
    expect(body.steps).toEqual([
      { kind: 'copy_card', status: 'done' },
      { kind: 'add_checklist', items: ['Write tests', 'Ship'] },
      { kind: 'link_card', field: 'f-parent', to: { card: 'c1' } },
      { kind: 'restore' },
      { kind: 'resolve_threads' },
      { kind: 'wait', hours: 48 },
      { kind: 'flag' },
    ]);
  });

  it('lets a branch link to the card that started the rule', () => {
    const step = {
      kind: 'for',
      related: { kind: 'children' },
      conditions: [],
      then: [{ kind: 'link_card', field: 'f-parent', to: { trigger: true } }],
    };
    expect(bodyOf(withStep(step)).steps).toEqual([step]);
  });

  it.each([
    ['no checklist items', { kind: 'add_checklist', items: [] }, 'steps.0.items'],
    [
      'too many checklist items',
      { kind: 'add_checklist', items: Array(21).fill('x') },
      'steps.0.items',
    ],
    ['a blank checklist item', { kind: 'add_checklist', items: ['a', '  '] }, 'steps.0.items.1'],
    ['a checklist item that is not text', { kind: 'add_checklist', items: [3] }, 'steps.0.items.0'],
    ['a link to nothing', { kind: 'link_card', field: 'f-parent', to: {} }, 'steps.0.to'],
    [
      'a link to the starting card outside a branch',
      { kind: 'link_card', field: 'f-parent', to: { trigger: true } },
      'steps.0',
    ],
    ['a Wait of no time', { kind: 'wait', hours: 0 }, 'steps.0.hours'],
    ['a Wait of part of an hour', { kind: 'wait', hours: 1.5 }, 'steps.0.hours'],
    ['a Wait past 30 days', { kind: 'wait', hours: 721 }, 'steps.0.hours'],
    ['a Wait in words', { kind: 'wait', hours: '3' }, 'steps.0.hours'],
  ])('refuses %s', (_, step, path) => {
    expect(pathOf(withStep(step))).toBe(path);
  });

  it('reads a bare Copy Card, and refuses a second card made in one run', () => {
    expect(bodyOf(withStep({ kind: 'copy_card' })).steps).toEqual([{ kind: 'copy_card' }]);
    expect(pathOf(withRule({ steps: [{ kind: 'copy_card' }, { kind: 'copy_card' }] }))).toBe(
      'steps',
    );
  });

  it('refuses more than three Waits', () => {
    const steps = Array.from({ length: 4 }, () => ({ kind: 'wait', hours: 1 }));
    expect(pathOf(withRule({ steps }))).toBe('steps');
  });
});

describe('Send Email to typed-in addresses', () => {
  it('keeps 1 to 10 addresses, trimmed, lower case and each once', () => {
    const r = readRuleBody(
      withStep({
        kind: 'email',
        to: { addresses: [' Ana@Example.com ', 'ana@example.com', 'bo@example.org'] },
        subject: 's',
        body: 'b',
      }),
    );
    expect('body' in r && r.body.steps[0]).toEqual({
      kind: 'email',
      to: { addresses: ['ana@example.com', 'bo@example.org'] },
      subject: 's',
      body: 'b',
    });
    const ten = Array.from({ length: 10 }, (_, i) => `p${i}@example.com`);
    expect(
      pathOf(withStep({ kind: 'email', to: { addresses: ten }, subject: 's', body: 'b' })),
    ).toBe(null);
  });

  it('lets a time rule email addresses: nobody needs to be behind it', () => {
    const r = readRuleBody(
      withRule({
        trigger: { kind: 'scheduled', every: 'day', at: '09:00' },
        steps: [{ kind: 'email', to: { addresses: ['ana@example.com'] }, subject: 's', body: 'b' }],
      }),
    );
    expect('body' in r).toBe(true);
  });
});
