import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  dayFrom,
  dayText,
  fieldText,
  fillValues,
  isKnownValue,
  todayIn,
  unknownValueIn,
  valuesIn,
  VALUE_NAMES,
  type ValueContext,
} from './values';
import { BUG, NOW, OUTLINE, SAM, ZONE, bug } from './test-fixtures';

// docs/specs/026-plan/automations.md "Values".
const ctx = (fields = {}, extra: Partial<ValueContext> = {}): ValueContext => ({
  card: bug({ due: '2026-11-20', assignee: SAM, priority: 'high', ...fields }, { key: 48 }),
  type: BUG,
  outline: OUTLINE,
  url: 'https://app.test/c/48',
  person: 'Ana Costa',
  rule: 'Escalate',
  now: NOW,
  timeZone: ZONE,
  ...extra,
});

describe('finding values', () => {
  it('lists the names between the braces, trimmed', () => {
    expect(valuesIn('Hi {{ card.title }} and {{now + 3d}}{{}}')).toEqual([
      'card.title',
      'now + 3d',
      '',
    ]);
  });

  it('knows the fixed names, a field by name and a day from today', () => {
    for (const name of VALUE_NAMES) expect(isKnownValue(name)).toBe(true);
    expect(isKnownValue('card.field.Severity')).toBe(true);
    expect(isKnownValue('now - 1d')).toBe(true);
    expect(isKnownValue('now+10d')).toBe(true);
    expect(isKnownValue('card.field. ')).toBe(false);
    expect(isKnownValue('now + 3w')).toBe(false);
    expect(isKnownValue('card.owner')).toBe(false);
  });

  it('answers the first unknown value, or null', () => {
    expect(unknownValueIn('{{card.title}} {{nope}} {{also}}')).toBe('nope');
    expect(unknownValueIn('plain {{card.key}}')).toBeNull();
  });
});

describe('days', () => {
  it("reads today in the rule's zone, and a day shifted from it", () => {
    expect(todayIn(Date.parse('2026-11-11T23:30:00Z'), 'Asia/Tokyo')).toBe('2026-11-12');
    expect(dayFrom({ today: -1 }, NOW, ZONE)).toBe('2026-11-10');
    expect(dayFrom({ day: '2026-01-02' }, NOW, ZONE)).toBe('2026-01-02');
  });

  it('writes a day as "11 Nov 2026", and leaves anything else', () => {
    expect(dayText('2026-11-11')).toBe('11 Nov 2026');
    expect(dayText('soon')).toBe('soon');
  });
});

describe('fieldText', () => {
  it('reads every kind of value as a line of text', () => {
    expect(fieldText(undefined)).toBe('');
    expect(fieldText(null)).toBe('');
    expect(fieldText('high', 'priority')).toBe('High');
    expect(fieldText('urgentish', 'priority')).toBe('urgentish');
    expect(fieldText('2026-11-11')).toBe('11 Nov 2026');
    expect(fieldText('words')).toBe('words');
    expect(fieldText(3)).toBe('3');
    expect(fieldText(true)).toBe('Yes');
    expect(fieldText(false)).toBe('No');
    expect(fieldText(['a', '', 2])).toBe('a, 2');
    expect(fieldText(SAM)).toBe('Sam Lee');
    expect(fieldText({ other: 1 })).toBe('');
  });
});

describe('fillValues', () => {
  it('fills every value from the card, the rule and the moment', () => {
    const text =
      '{{card.title}} {{card.key}} {{card.url}} {{card.assignee}} {{card.column}} {{card.due}} ' +
      '{{person}} {{rule}} {{now.date}} {{now}} {{now + 3d}} {{card.field.Severity}} {{card.field.deadline}}';
    expect(fillValues(text, ctx())).toBe(
      'Login fails #48 https://app.test/c/48 Sam Lee To Do 20 Nov 2026 Ana Costa Escalate 11 Nov 2026 ' +
        '11 Nov 2026, 10:42 14 Nov 2026 High 20 Nov 2026',
    );
  });

  it('writes days as YYYY-MM-DD for a date field', () => {
    expect(fillValues('{{now - 1d}}|{{now.date}}|{{card.due}}', ctx(), { iso: true })).toBe(
      '2026-11-10|2026-11-11|2026-11-20',
    );
  });

  it('reads what it cannot fill as nothing, and never reads a value twice', () => {
    const empty = ctx({ assignee: undefined, due: undefined, status: undefined });
    expect(
      fillValues(
        '[{{card.assignee}}][{{card.column}}][{{card.due}}][{{card.field.Nope}}][{{bad}}]',
        empty,
      ),
    ).toBe('[][][][][]');
    expect(fillValues('{{card.title}}', ctx({ title: '{{rule}}' }))).toBe('{{rule}}');
  });
});

describe('hostile text', () => {
  // CodeQL polynomial-regex: a long run that almost names a value must stay one linear pass.
  it('checks a long near-miss field name within budget', () => {
    const name = `card.field.${'!'.repeat(100_000)}`;
    const spaces = `card.field.${' '.repeat(100_000)}`;
    const ms = cpuMsOf(() => {
      expect(isKnownValue(name)).toBe(true);
      expect(isKnownValue(spaces)).toBe(false);
      expect(unknownValueIn(`{{${spaces}}}`)).toBe(spaces.trim());
    });
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});

// Phase 2 (#712): a branch's text names the card that started the rule.
describe('the triggering card’s values', () => {
  it('are known only in a branch', () => {
    expect(isKnownValue('trigger.title')).toBe(false);
    expect(isKnownValue('trigger.title', { branch: true })).toBe(true);
    expect(unknownValueIn('{{trigger.url}}', { branch: true })).toBeNull();
    expect(unknownValueIn('{{trigger.url}}')).toBe('trigger.url');
  });
  it('fill from the triggering card, and read as nothing without one', () => {
    const trigger = { card: bug({ title: 'Epic' }, { key: 7 }), url: 'https://app.test/7' };
    const text = '{{trigger.title}} {{trigger.key}} {{trigger.url}}';
    expect(fillValues(text, ctx({}, { trigger }))).toBe('Epic #7 https://app.test/7');
    expect(fillValues(text, ctx())).toBe('  ');
  });
});
