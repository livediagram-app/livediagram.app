import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_AI_STEPS_MAX,
  AUTOMATION_NAME_MAX,
  AUTOMATION_OUTGOING_MAX,
  AUTOMATION_WAITS_MAX,
} from './limits';
import type { AutomationIf, AutomationKind, AutomationOutgoing, AutomationWait } from './types';
import {
  checkActionsCap,
  countActions,
  freeRuleName,
  readIf,
  readNotify,
  readRuleShell,
  readWait,
  ruleNameTaken,
  stepActions,
  type RuleReaders,
} from './validate';
import {
  AUTOMATION_LIST_MAX,
  Refused,
  clock,
  day,
  id,
  ids,
  isObj,
  not,
  obj,
  optionalIds,
  refuse,
  text,
  unsupported,
  whole,
} from './validate-read';
import { readScheduled } from './validate-scheduled';
import { isSharedValue, unknownValueIn } from './values';

// What a refusal says, or nothing when `read` answers.
const refusal = (read: () => unknown) => {
  try {
    read();
  } catch (error) {
    if (error instanceof Refused) return error.refusal;
    throw error;
  }
  return null;
};

describe('the reading primitives', () => {
  it('reads an object, an id and a list of ids, each once', () => {
    expect(isObj([])).toBe(false);
    expect(obj({ a: 1 }, 'p')).toEqual({ a: 1 });
    expect(refusal(() => obj(null, 'p'))).toMatchObject({ error: 'automation_invalid', path: 'p' });
    expect(id('a', 'p')).toBe('a');
    for (const bad of ['', 'x'.repeat(81), 5]) expect(refusal(() => id(bad, 'p'))?.path).toBe('p');
    expect(ids(['a', 'b', 'a'], 'p')).toEqual(['a', 'b']);
    expect(refusal(() => ids('a', 'p'))?.message).toBe(
      `p must be a list of 0 to ${AUTOMATION_LIST_MAX}`,
    );
    expect(refusal(() => ids([], 'p', { min: 1 }))?.message).toContain('1 to');
    expect(refusal(() => ids(Array(AUTOMATION_LIST_MAX + 1).fill('a'), 'p'))).not.toBeNull();
    expect(refusal(() => ids(['a', ''], 'p'))?.path).toBe('p.1');
    expect(optionalIds(undefined, 'p')).toBeUndefined();
    expect(optionalIds(['a'], 'p')).toEqual(['a']);
  });

  it('reads text within its bound, checked by the app for unknown values', () => {
    expect(text('hello', 'p', 10)).toBe('hello');
    expect(text('', 'p', 10, { empty: true })).toBe('');
    expect(refusal(() => text('', 'p', 10))?.message).toBe('p must be text of 1 to 10 characters');
    expect(refusal(() => text('x'.repeat(11), 'p', 10, { empty: true }))?.message).toBe(
      'p must be text of up to 10 characters',
    );
    expect(refusal(() => text(5, 'p', 10))).not.toBeNull();
    const unknownValue = (t: string) => unknownValueIn(t, (name) => isSharedValue(name));
    expect(text('by {{person}}', 'p', 50, { unknownValue })).toBe('by {{person}}');
    expect(refusal(() => text('{{nope}}', 'p', 50, { unknownValue }))).toEqual({
      error: 'automation_value_unknown',
      path: 'p',
      message: '{{nope}} is not a value',
    });
  });

  it('reads not, a day, a time and a whole number', () => {
    expect(not(undefined, 'p')).toEqual({});
    expect(not(false, 'p')).toEqual({});
    expect(not(true, 'p')).toEqual({ not: true });
    expect(refusal(() => not('yes', 'p'))?.message).toBe('p must be true');
    expect(day({ day: '2026-11-11' }, 'p')).toEqual({ day: '2026-11-11' });
    expect(day({ today: -3 }, 'p')).toEqual({ today: -3 });
    for (const bad of [{ day: 'soon' }, { today: 1.5 }, { today: 4000 }, { today: '1' }, {}])
      expect(refusal(() => day(bad, 'p'))?.message).toBe('p must be a day or today ± days');
    // An app whose fields hold more than a plain day hands in its own check.
    const loose = (v: unknown): v is string => v === 'soon';
    expect(day({ day: 'soon' }, 'p', loose)).toEqual({ day: 'soon' });
    expect(clock('09:15', 'p')).toBe('09:15');
    expect(refusal(() => clock('09:10', 'p'))?.message).toContain('quarter hour');
    expect(whole(3, 'p', 1, 5)).toBe(3);
    for (const bad of [0, 6, 2.5, '3']) expect(refusal(() => whole(bad, 'p', 1, 5))).not.toBeNull();
  });

  it('refuses with the kind of refusal asked for', () => {
    expect(refusal(() => refuse('a', 'b'))).toEqual({
      error: 'automation_invalid',
      path: 'a',
      message: 'b',
    });
    expect(refusal(() => unsupported('automation_step_unsupported', 'a', 'b'))?.error).toBe(
      'automation_step_unsupported',
    );
  });
});

describe('Scheduled', () => {
  it('keeps each recurrence, dropping what it does not use', () => {
    expect(readScheduled({ every: 'day', at: '09:00', days: [1] })).toEqual({
      kind: 'scheduled',
      every: 'day',
      at: '09:00',
    });
    expect(readScheduled({ every: 'week', days: [4, 1, 4], at: '09:00' })).toEqual({
      kind: 'scheduled',
      every: 'week',
      days: [1, 4],
      at: '09:00',
    });
    expect(readScheduled({ every: 'month', dayOfMonth: 31, at: '17:45' })).toEqual({
      kind: 'scheduled',
      every: 'month',
      dayOfMonth: 31,
      at: '17:45',
    });
  });

  it('refuses a recurrence, days or a day it cannot read', () => {
    expect(refusal(() => readScheduled({ every: 'year', at: '09:00' }))?.path).toBe(
      'trigger.every',
    );
    expect(refusal(() => readScheduled({ at: '09:00' }))?.path).toBe('trigger.every');
    expect(refusal(() => readScheduled({ every: 'day', at: 'noon' }))?.path).toBe('trigger.at');
    for (const days of [undefined, [], Array(8).fill(1)])
      expect(refusal(() => readScheduled({ every: 'week', days, at: '09:00' }))?.path).toBe(
        'trigger.days',
      );
    expect(refusal(() => readScheduled({ every: 'week', days: [7], at: '09:00' }))?.path).toBe(
      'trigger.days.0',
    );
    expect(
      refusal(() => readScheduled({ every: 'month', dayOfMonth: 32, at: '09:00' }))?.path,
    ).toBe('trigger.dayOfMonth');
  });
});

describe('the steps every app has', () => {
  it('reads a Wait of 1 to 720 whole hours', () => {
    expect(readWait({ hours: 24 }, 's')).toEqual({ kind: 'wait', hours: 24 });
    for (const hours of [0, 721, 1.5, '2'])
      expect(refusal(() => readWait({ hours }, 's'))?.path).toBe('s.hours');
  });

  it('reads a message through a connection, its name trimmed', () => {
    expect(
      readNotify(
        { via: 'slack', webhook: 'wh_1', name: ' Launch ', text: 'Shipped', more: 1 },
        's',
      ),
    ).toEqual({ kind: 'notify', via: 'slack', webhook: 'wh_1', name: 'Launch', text: 'Shipped' });
    expect(readNotify({ via: 'teams', webhook: 'wh_1', text: 'Hi' }, 's')).toEqual({
      kind: 'notify',
      via: 'teams',
      webhook: 'wh_1',
      text: 'Hi',
    });
    expect(refusal(() => readNotify({ via: 'fax', webhook: 'w', text: 'x' }, 's'))?.path).toBe(
      's.via',
    );
    expect(refusal(() => readNotify({ webhook: 'w', text: 'x' }, 's'))?.path).toBe('s.via');
    const unknownValue = () => 'nope';
    expect(
      refusal(() => readNotify({ via: 'webhook', webhook: 'w', text: 'x' }, 's', { unknownValue }))
        ?.error,
    ).toBe('automation_value_unknown');
  });

  it('reads an If / Else over the app’s conditions and actions', () => {
    const read = {
      conditions: (v: unknown) => (v as AutomationKind[]) ?? [],
      action: (v: unknown) => v as AutomationKind,
      refused: new Set(['if', 'wait']),
    };
    expect(
      readIf({ conditions: [{ kind: 'tab' }], then: [{ kind: 'snapshot' }], else: [] }, 's', read),
    ).toEqual({
      kind: 'if',
      conditions: [{ kind: 'tab' }],
      then: [{ kind: 'snapshot' }],
      else: [],
    });
    expect(refusal(() => readIf({ conditions: [], then: [], else: [] }, 's', read))?.message).toBe(
      'an If needs a condition',
    );
    const held = { conditions: [{ kind: 'tab' }] };
    expect(refusal(() => readIf({ ...held, then: 'x', else: [] }, 's', read))?.path).toBe('s.then');
    expect(
      refusal(() => readIf({ ...held, then: [{ kind: 'wait' }], else: [] }, 's', read)),
    ).toEqual({
      error: 'automation_step_unsupported',
      path: 's.then.0',
      message: "an If can't hold wait",
    });
    // A part that is no object is the app's reader's to refuse.
    expect(readIf({ ...held, then: [5], else: [] }, 's', read).then).toEqual([5]);
  });
});

type Step = AutomationKind | AutomationWait | AutomationOutgoing | AutomationIf;

const readers: RuleReaders<AutomationKind, AutomationKind, Step> = {
  trigger: (v) => obj(v, 'trigger') as AutomationKind,
  conditions: (v) => v as AutomationKind[],
  step: (v, path) => {
    const s = obj(v, path);
    return s['kind'] === 'wait' ? readWait(s, path) : (s as Step);
  },
};
const rule = (over: Record<string, unknown> = {}) => ({
  name: ' Friday Snapshot ',
  timeZone: 'Europe/London',
  trigger: { kind: 'manual' },
  steps: [{ kind: 'snapshot' }],
  extra: true,
  ...over,
});
const many = (kind: string, n: number) => Array.from({ length: n }, () => ({ kind }));

describe('the rule shell', () => {
  it('keeps a rule as it is kept: trimmed, chain off, unknown keys dropped', () => {
    expect(readRuleShell(rule(), readers)).toEqual({
      body: {
        name: 'Friday Snapshot',
        trigger: { kind: 'manual' },
        conditions: [],
        steps: [{ kind: 'snapshot' }],
        chain: false,
        timeZone: 'Europe/London',
      },
    });
    expect(
      readRuleShell(rule({ chain: true, conditions: [{ kind: 'tab' }] }), readers),
    ).toMatchObject({ body: { chain: true, conditions: [{ kind: 'tab' }] } });
  });

  it('refuses the first part at fault, with its path', () => {
    const path = (v: unknown) => {
      const read = readRuleShell(v, readers);
      return 'error' in read ? read.path : null;
    };
    expect(path(null)).toBe('rule');
    expect(path(rule({ name: 5 }))).toBe('name');
    expect(path(rule({ name: '  ' }))).toBe('name');
    expect(path(rule({ name: 'x'.repeat(AUTOMATION_NAME_MAX + 1) }))).toBe('name');
    expect(path(rule({ timeZone: 'Mars/Olympus' }))).toBe('timeZone');
    expect(path(rule({ chain: 'yes' }))).toBe('chain');
    expect(path(rule({ trigger: 5 }))).toBe('trigger');
    expect(path(rule({ steps: 'none' }))).toBe('steps');
    expect(path(rule({ steps: [{ kind: 'wait', hours: 0 }] }))).toBe('steps.0.hours');
  });

  it('holds a rule to the shared caps, or to the app’s own check', () => {
    const message = (steps: unknown[], r = readers) => {
      const read = readRuleShell(rule({ steps }), r);
      return 'error' in read ? read.message : null;
    };
    expect(message(many('snapshot', AUTOMATION_ACTIONS_MAX))).toBeNull();
    expect(message(many('snapshot', AUTOMATION_ACTIONS_MAX + 1))).toBe(
      'a rule holds up to 20 actions',
    );
    expect(message(many('notify', AUTOMATION_OUTGOING_MAX + 1))).toBe(
      'a rule holds up to 5 outgoing actions',
    );
    expect(message(many('ai', AUTOMATION_AI_STEPS_MAX + 1))).toBe(
      'a rule holds up to 3 AI actions',
    );
    expect(message(Array(AUTOMATION_WAITS_MAX + 1).fill({ kind: 'wait', hours: 1 }))).toBe(
      'a rule holds up to 3 Waits',
    );
    const checked: RuleReaders<AutomationKind, AutomationKind, Step> = {
      ...readers,
      check: ({ steps }) => {
        if (steps.length > 1) refuse('steps', 'one step here');
      },
    };
    expect(message(many('snapshot', 2), checked)).toBe('one step here');
    expect(message(many('snapshot', 1), checked)).toBeNull();
  });

  it('lets anything but a refusal through', () => {
    const broken = {
      ...readers,
      trigger: () => {
        throw new TypeError('bug');
      },
    };
    expect(() => readRuleShell(rule(), broken)).toThrow(TypeError);
  });
});

describe('counting actions', () => {
  it('counts an If / Else’s both lists, a Wait as none, any other step as one', () => {
    const branch = {
      kind: 'if',
      conditions: [],
      then: [{ kind: 'a' }],
      else: [{ kind: 'b' }, { kind: 'c' }],
    };
    expect(stepActions(branch)).toHaveLength(3);
    expect(stepActions({ kind: 'wait', hours: 1 })).toEqual([]);
    expect(countActions([branch, { kind: 'wait' }, { kind: 'snapshot' }])).toBe(4);
    // An app with a container of its own counts its way.
    expect(countActions([{ kind: 'for' }], () => [1, 2])).toBe(2);
    expect(() => checkActionsCap([{ kind: 'for' }], () => Array(21).fill(0))).toThrow(Refused);
  });
});

describe('a rule’s name', () => {
  const rules = [
    { id: 'a', name: 'Triage' },
    { id: 'b', name: 'New Rule' },
  ];

  it('is taken by another rule, any case', () => {
    expect(ruleNameTaken(' triage ', rules)).toBe(true);
    expect(ruleNameTaken('Triage', rules, 'a')).toBe(false);
    expect(ruleNameTaken('Other', rules)).toBe(false);
  });

  it('finds the first free name, cutting the base and never the tail', () => {
    expect(freeRuleName('Fresh', rules)).toBe('Fresh');
    expect(freeRuleName('New Rule', rules)).toBe('New Rule 2');
    expect(freeRuleName('Triage', [...rules, { id: 'c', name: 'Triage copy' }], ' copy')).toBe(
      'Triage copy 2',
    );
    const long = 'x'.repeat(AUTOMATION_NAME_MAX);
    const copy = freeRuleName(long, [{ id: 'l', name: long }], ' copy');
    expect(copy).toHaveLength(AUTOMATION_NAME_MAX);
    expect(copy.endsWith(' copy')).toBe(true);
  });
});
