import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_SHARED_VALUE_LABELS,
  AUTOMATION_SHARED_VALUE_NAMES,
  dayFrom,
  dayShiftOf,
  fillValues,
  isSharedValue,
  sharedValue,
  todayIn,
  unknownValueIn,
  valuesIn,
  type SharedValueContext,
} from './values';

const ctx: SharedValueContext = {
  person: 'Ana Costa',
  rule: 'Friday Snapshot',
  now: Date.parse('2026-11-11T17:05:00Z'),
  timeZone: 'Europe/London',
  webhook: { 'build.status': 'green', count: 3 },
};

describe('the values a text holds', () => {
  it('finds each name between its braces, trimmed, in order', () => {
    expect(valuesIn('{{ rule }} by {{person}} {{}} {not}')).toEqual(['rule', 'person', '']);
  });

  it('knows the shared names, a day from today, and a webhook field only where one may be', () => {
    for (const name of AUTOMATION_SHARED_VALUE_NAMES) {
      expect(isSharedValue(name)).toBe(true);
      expect(AUTOMATION_SHARED_VALUE_LABELS[name]).toBeTruthy();
    }
    expect(isSharedValue('now + 3d')).toBe(true);
    expect(isSharedValue('webhook.build.status')).toBe(false);
    expect(isSharedValue('webhook.build.status', { webhook: true })).toBe(true);
    expect(isSharedValue('webhook.', { webhook: true })).toBe(false);
    expect(isSharedValue('tab.name')).toBe(false);
  });

  it('answers the first value the app does not know', () => {
    const known = (name: string) => isSharedValue(name) || name === 'tab.name';
    expect(unknownValueIn('{{tab.name}} {{rule}}', known)).toBeNull();
    expect(unknownValueIn('{{tab.name}} {{nope}} {{also}}', known)).toBe('nope');
  });

  it('reads a day shift', () => {
    expect(dayShiftOf('now + 3d')).toBe(3);
    expect(dayShiftOf('now-10d')).toBe(-10);
    expect(dayShiftOf('now')).toBeNull();
  });
});

describe('days', () => {
  it('reads today in the rule’s time zone, and a day from it', () => {
    const late = Date.parse('2026-11-11T23:30:00Z');
    expect(todayIn(late, 'Asia/Tokyo')).toBe('2026-11-12');
    expect(dayFrom({ day: '2026-01-02' }, late, 'UTC')).toBe('2026-01-02');
    expect(dayFrom({ today: 2 }, late, 'UTC')).toBe('2026-11-13');
  });
});

describe('filling', () => {
  it('reads each shared name, a day as words or as a day', () => {
    expect(sharedValue('person', ctx)).toBe('Ana Costa');
    expect(sharedValue('rule', ctx)).toBe('Friday Snapshot');
    expect(sharedValue('now.date', ctx)).toBe('11 Nov 2026');
    expect(sharedValue('now.date', ctx, true)).toBe('2026-11-11');
    expect(sharedValue('now', ctx)).toBe('11 Nov 2026, 17:05');
    expect(sharedValue('now - 1d', ctx)).toBe('10 Nov 2026');
    expect(sharedValue('now + 1d', ctx, true)).toBe('2026-11-12');
  });

  it('reads a webhook call’s own values, and nothing for one it lacks', () => {
    expect(sharedValue('webhook.build.status', ctx)).toBe('green');
    expect(sharedValue('webhook.count', ctx)).toBe('3');
    expect(sharedValue('webhook.missing', ctx)).toBe('');
    expect(sharedValue('webhook.constructor', ctx)).toBe('');
    expect(sharedValue('webhook.count', { ...ctx, webhook: undefined })).toBe('');
  });

  it('leaves any other name to the app', () => {
    expect(sharedValue('tab.name', ctx)).toBeUndefined();
  });

  it('fills a text in one pass: what a value reads is never read again', () => {
    const resolve = (name: string) => sharedValue(name, { ...ctx, person: '{{rule}}' }) ?? '?';
    expect(fillValues('{{ person }} ran {{rule}} {{x}}', resolve)).toBe(
      '{{rule}} ran Friday Snapshot ?',
    );
  });
});
