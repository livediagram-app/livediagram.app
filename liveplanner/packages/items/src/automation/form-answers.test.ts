import { describe, expect, it } from 'vitest';
import { eventOfWrite } from './matches';
import {
  fillValues,
  isKnownValue,
  unknownValueIn,
  answerNameOf,
  type ValueContext,
} from './values';
import { BUG, NOW, OUTLINE, ZONE, bug } from './test-fixtures';

// A Form Response rule's `{{answer.<Question>}}` (docs/specs/026-plan/automations.md "Values").
const ctx = (
  answers?: Record<string, string>,
  extra: Partial<ValueContext> = {},
): ValueContext => ({
  card: bug({}, { key: 7 }),
  type: BUG,
  outline: OUTLINE,
  url: 'https://app.test/c/7',
  person: 'Form',
  rule: 'Follow up',
  now: NOW,
  timeZone: ZONE,
  ...(answers ? { answers } : {}),
  ...extra,
});

describe('form answers as values', () => {
  it('are known only in a Form Response rule, by a question with words', () => {
    expect(isKnownValue('answer.Company', { form: true })).toBe(true);
    expect(isKnownValue('answer.Company')).toBe(false);
    expect(isKnownValue('answer.  ', { form: true })).toBe(false);
    expect(unknownValueIn('{{answer.Company}}', { form: true })).toBeNull();
    expect(answerNameOf('card.title')).toBeNull();
    expect(answerNameOf('answer. Company ')).toBe('Company');
  });

  it('read the answer by its question, any case, and nothing when there is none', () => {
    const answers = { Company: 'Acme', 'Team size': '12' };
    expect(fillValues('Follow up {{answer.Company}}', ctx(answers))).toBe('Follow up Acme');
    expect(fillValues('{{answer.team SIZE}}', ctx(answers))).toBe('12');
    expect(fillValues('[{{answer.Missing}}]', ctx(answers))).toBe('[]');
    expect(fillValues('[{{answer.Company}}]', ctx())).toBe('[]');
    // Own keys only.
    expect(fillValues('[{{answer.constructor}}]', ctx(answers))).toBe('[]');
    // A cardless run still reads them.
    expect(fillValues('{{answer.Company}}', ctx(answers, { cardless: true }))).toBe('Acme');
  });

  it('ride on a form response event, never on another', () => {
    const made = bug({});
    const answers = { Company: 'Acme' };
    const event = eventOfWrite(null, made, [{ kind: 'created' }], {
      role: 'system',
      form: 'tab-form',
      answers,
    });
    expect(event).toMatchObject({ kind: 'created', form: 'tab-form', answers });
    const plain = eventOfWrite(null, made, [{ kind: 'created' }], { role: 'system', answers });
    expect(plain).not.toHaveProperty('answers');
  });
});
