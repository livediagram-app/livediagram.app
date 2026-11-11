import { describe, expect, it } from 'vitest';
import { countActions, readRuleBody } from './validate';
import { ruleBody } from './test-fixtures';

// docs/specs/026-plan/automations.md "Time triggers", "For Related Cards", "Outgoing actions", "Assign in turn",
// "Limits"; blueprint automations.md "Phase 2" (the refusals).
const withRule = (extra: Record<string, unknown>) => ({ ...ruleBody(), ...extra });
const withStep = (step: unknown) => withRule({ steps: [step] });
const refusal = (raw: unknown) => {
  const r = readRuleBody(raw);
  return 'body' in r ? null : { error: r.error, path: r.path };
};
const kept = (raw: unknown) => {
  const r = readRuleBody(raw);
  if (!('body' in r)) throw new Error(r.message);
  return r.body;
};
const weekday = { kind: 'scheduled', every: 'weekday', at: '09:00' };

describe('time triggers', () => {
  it('keeps each, dropping what its kind does not use', () => {
    expect(kept(withRule({ trigger: { ...weekday, days: [1] } })).trigger).toEqual(weekday);
    expect(
      kept(
        withRule({ trigger: { kind: 'scheduled', every: 'week', days: [4, 1, 1], at: '17:30' } }),
      ).trigger,
    ).toEqual({ kind: 'scheduled', every: 'week', days: [1, 4], at: '17:30' });
    expect(
      kept(
        withRule({ trigger: { kind: 'scheduled', every: 'month', dayOfMonth: 31, at: '00:00' } }),
      ).trigger,
    ).toEqual({ kind: 'scheduled', every: 'month', dayOfMonth: 31, at: '00:00' });
    expect(
      kept(withRule({ trigger: { kind: 'scheduled', every: 'day', at: '23:45' } })).trigger,
    ).toEqual({ kind: 'scheduled', every: 'day', at: '23:45' });
    expect(kept(withRule({ trigger: { kind: 'due_in', days: 30, at: '09:15' } })).trigger).toEqual({
      kind: 'due_in',
      days: 30,
      at: '09:15',
    });
    expect(kept(withRule({ trigger: { kind: 'overdue', at: '09:00' } })).trigger).toEqual({
      kind: 'overdue',
      at: '09:00',
    });
  });

  it.each([
    ['an unknown every', { kind: 'scheduled', every: 'hour', at: '09:00' }, 'trigger.every'],
    ['a minute off the quarter hour', { ...weekday, at: '09:10' }, 'trigger.at'],
    ['no time', { kind: 'overdue' }, 'trigger.at'],
    [
      'a week with no days',
      { kind: 'scheduled', every: 'week', days: [], at: '09:00' },
      'trigger.days',
    ],
    [
      'a weekday past Saturday',
      { kind: 'scheduled', every: 'week', days: [7], at: '09:00' },
      'trigger.days.0',
    ],
    [
      'a month day of 32',
      { kind: 'scheduled', every: 'month', dayOfMonth: 32, at: '09:00' },
      'trigger.dayOfMonth',
    ],
    ['Due In 0 days', { kind: 'due_in', days: 0, at: '09:00' }, 'trigger.days'],
    ['Due In 31 days', { kind: 'due_in', days: 31, at: '09:00' }, 'trigger.days'],
  ])('refuses %s', (_name, trigger, path) => {
    expect(refusal(withRule({ trigger }))).toEqual({ error: 'automation_invalid', path });
  });

  it('refuses whoever triggered it and Who Did It, anywhere in the rule', () => {
    const time = (extra: Record<string, unknown>) => withRule({ trigger: weekday, ...extra });
    const unsupported = (path: string) => ({ error: 'automation_condition_unsupported', path });
    expect(refusal(time({ conditions: [{ kind: 'who', who: [{ role: 'agent' }] }] }))).toEqual(
      unsupported('conditions.0'),
    );
    expect(refusal(time({ steps: [{ kind: 'assign', to: { trigger: true } }] }))).toEqual(
      unsupported('steps.0'),
    );
    expect(
      refusal(time({ steps: [{ kind: 'email', to: { trigger: true }, subject: 'a', body: 'b' }] })),
    ).toEqual(unsupported('steps.0'));
    expect(
      refusal(
        time({
          steps: [
            { kind: 'flag' },
            {
              kind: 'if',
              conditions: [{ kind: 'who', who: [{ person: 'p' }] }],
              then: [{ kind: 'flag' }],
              else: [],
            },
          ],
        }),
      ),
    ).toEqual(unsupported('steps.1.conditions.0'));
    // Other conditions stand.
    expect(
      refusal(time({ conditions: [{ kind: 'type', types: ['bug'] }], steps: [{ kind: 'flag' }] })),
    ).toBeNull();
    // A card trigger keeps them.
    expect(refusal(withRule({ steps: [{ kind: 'assign', to: { trigger: true } }] }))).toBeNull();
  });
});

describe('Assign in Turn', () => {
  it('keeps 2 to 10 people, each once, in order', () => {
    expect(kept(withStep({ kind: 'assign', to: { rotate: ['b', 'a', 'b'] } })).steps[0]).toEqual({
      kind: 'assign',
      to: { rotate: ['b', 'a'] },
    });
  });

  it.each([
    ['one person', ['a']],
    ['eleven people', Array.from({ length: 11 }, (_, i) => `p${i}`)],
    ['not a list', 'a'],
  ])('refuses %s', (_name, rotate) => {
    expect(refusal(withStep({ kind: 'assign', to: { rotate } }))).toEqual({
      error: 'automation_invalid',
      path: 'steps.0.to.rotate',
    });
  });
});

describe('outgoing actions', () => {
  const notify = (extra = {}) => ({
    kind: 'notify',
    via: 'slack',
    webhook: 'wh1',
    text: 'Hi {{card.title}}',
    ...extra,
  });

  it('keeps one, its name trimmed', () => {
    expect(kept(withStep(notify({ name: ' Launch ' }))).steps[0]).toEqual(
      notify({ name: 'Launch' }),
    );
    expect(kept(withStep(notify())).steps[0]).toEqual(notify());
  });

  it.each([
    ['an unknown via', notify({ via: 'email' }), 'steps.0.via'],
    ['no webhook', notify({ webhook: '' }), 'steps.0.webhook'],
    ['a blank message', notify({ text: '   ' }), 'steps.0.text'],
    ['a message too long', notify({ text: 'x'.repeat(2001) }), 'steps.0.text'],
  ])('refuses %s', (_name, step, path) => {
    expect(refusal(withStep(step))).toEqual({ error: 'automation_invalid', path });
  });

  it('refuses a branch’s value outside a branch, more than five, and one inside an If', () => {
    expect(refusal(withStep(notify({ text: '{{trigger.title}}' })))).toEqual({
      error: 'automation_value_unknown',
      path: 'steps.0.text',
    });
    expect(refusal(withRule({ steps: Array.from({ length: 6 }, () => notify()) }))).toEqual({
      error: 'automation_invalid',
      path: 'steps',
    });
    expect(
      refusal(
        withStep({
          kind: 'if',
          conditions: [{ kind: 'type', types: ['a'] }],
          then: [notify()],
          else: [],
        }),
      ),
    ).toEqual({ error: 'automation_step_unsupported', path: 'steps.0.then.0' });
  });
});

describe('For Related Cards', () => {
  const branch = (extra = {}) => ({
    kind: 'for',
    related: { kind: 'blocked_by' },
    then: [{ kind: 'comment', text: '{{trigger.key}} is done: {{card.title}} can start' }],
    ...extra,
  });

  it('keeps each way to pick cards, conditions defaulting to none', () => {
    expect(kept(withStep(branch())).steps[0]).toEqual({ ...branch(), conditions: [] });
    for (const related of [
      { kind: 'linked' },
      { kind: 'linked', field: 'f-parent' },
      { kind: 'blocking' },
      { kind: 'children' },
      { kind: 'saved_filter', tab: 't1', filter: 'f1' },
    ])
      expect(
        (kept(withStep(branch({ related }))).steps[0] as { related: unknown }).related,
      ).toEqual(related);
  });

  it('counts its actions toward the rule’s', () => {
    expect(countActions(kept(withStep(branch())).steps)).toBe(1);
  });

  it.each([
    [
      'an unknown way',
      branch({ related: { kind: 'siblings' } }),
      'automation_invalid',
      'steps.0.related.kind',
    ],
    ['no actions', branch({ then: [] }), 'automation_invalid', 'steps.0.then'],
    ['an action that is not one', branch({ then: [5] }), 'automation_invalid', 'steps.0.then.0'],
    [
      'eleven actions',
      branch({ then: Array.from({ length: 11 }, () => ({ kind: 'flag' })) }),
      'automation_invalid',
      'steps.0.then',
    ],
    ['an If', branch({ then: [{ kind: 'if' }] }), 'automation_step_unsupported', 'steps.0.then.0'],
    [
      'another branch',
      branch({ then: [branch()] }),
      'automation_step_unsupported',
      'steps.0.then.0',
    ],
    [
      'Create Card',
      branch({ then: [{ kind: 'create_card', type: 't', title: 'x' }] }),
      'automation_step_unsupported',
      'steps.0.then.0',
    ],
    [
      'an outgoing action',
      branch({ then: [notify()] }),
      'automation_step_unsupported',
      'steps.0.then.0',
    ],
  ])('refuses %s', (_name, step, error, path) => {
    expect(refusal(withStep(step))).toEqual({ error, path });
  });

  it('refuses more than twenty actions with the rest of the rule', () => {
    const ten = Array.from({ length: 10 }, () => ({ kind: 'flag' }));
    expect(refusal(withRule({ steps: [branch({ then: ten }), ...ten, { kind: 'flag' }] }))).toEqual(
      {
        error: 'automation_invalid',
        path: 'steps',
      },
    );
  });
});

function notify(extra = {}) {
  return { kind: 'notify', via: 'slack', webhook: 'wh1', text: 'Hi', ...extra };
}
