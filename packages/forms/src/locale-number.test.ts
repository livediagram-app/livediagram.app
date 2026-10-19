import { describe, expect, it, vi } from 'vitest';
import { checkAnswer } from './answers';
import { readLocaleNumber, withLocaleNumbers } from './locale-number';
import type { FormQuestion } from './model';

describe('readLocaleNumber', () => {
  it('reads a decimal comma and a group dot where the locale writes them', () => {
    expect(readLocaleNumber('3,5', 'de-DE')).toBe('3.5');
    expect(readLocaleNumber('1.234,5', 'de-DE')).toBe('1234.5');
    expect(readLocaleNumber('1 234,5', 'fr-FR')).toBe('1234.5');
    expect(readLocaleNumber('-2,25', 'de-DE')).toBe('-2.25');
  });

  it('reads a group comma where the locale writes one', () => {
    expect(readLocaleNumber('1,234.5', 'en-GB')).toBe('1234.5');
    expect(readLocaleNumber('3.5', 'en-US')).toBe('3.5');
  });

  it('reads a group mark only between thousands, so an en-US 3,5 is not 35', () => {
    expect(readLocaleNumber('3,5', 'en-US')).toBe('3,5');
    expect(readLocaleNumber('1,23', 'en-GB')).toBe('1,23');
    expect(readLocaleNumber('12,345,678', 'en-GB')).toBe('12345678');
  });

  it('keeps text that is not a number in the locale', () => {
    expect(readLocaleNumber('abc', 'de-DE')).toBe('abc');
    expect(readLocaleNumber('', 'de-DE')).toBe('');
    expect(readLocaleNumber('3,5,6.7', 'de-DE')).toBe('3,5,6.7');
  });
});

describe('readLocaleNumber edges', () => {
  it('falls back to comma groups and a dot where the locale cannot be read', () => {
    expect(readLocaleNumber('1,234.5', 'not a locale!!')).toBe('1234.5');
  });

  it('falls back the same where the locale names no group or decimal mark', () => {
    const spy = vi
      .spyOn(Intl.NumberFormat.prototype, 'formatToParts')
      .mockReturnValue([{ type: 'integer', value: '1234567' }]);
    expect(readLocaleNumber('1,234.5', 'en-GB')).toBe('1234.5');
    spy.mockRestore();
  });

  it('reads a negative grouped number, and keeps a misgrouped one', () => {
    expect(readLocaleNumber('-1.234,5', 'de-DE')).toBe('-1234.5');
    expect(readLocaleNumber('1234,567.8', 'en-GB')).toBe('1234,567.8');
  });
});

describe('withLocaleNumbers', () => {
  const q = (id: string, type: FormQuestion['type']) => ({ id, type, prompt: id }) as FormQuestion;

  it('rewrites only number answers, so a German 3,5 passes the check', () => {
    const questions = [q('n', 'number'), q('t', 'short')];
    const out = withLocaleNumbers(questions, { n: '3,5', t: '3,5' }, 'de-DE');
    expect(out).toEqual({ n: '3.5', t: '3,5' });
    expect(checkAnswer(questions[0]!, out.n)).toEqual({ value: 3.5 });
  });

  it('leaves an answer that is not text alone', () => {
    const answers = { n: 4 };
    expect(withLocaleNumbers([q('n', 'number')], answers, 'de-DE')).toBe(answers);
  });

  it('hands back the same object when nothing changes', () => {
    const answers = { n: '4' };
    expect(withLocaleNumbers([q('n', 'number')], answers, 'en-GB')).toBe(answers);
  });
});
