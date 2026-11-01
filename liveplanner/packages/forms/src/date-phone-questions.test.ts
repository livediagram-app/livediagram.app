import { describe, expect, it } from 'vitest';
import type { CustomFieldDef, ItemTypeDef } from '@liveplanner/items';
import { answerErrorMessage, checkAnswer } from './answers';
import { answerText, responseCard } from './card';
import { blankQuestion } from './edits';
import { canGoToTitle, fieldTakes, newFieldFor, NEW_FIELD_KIND, MAPPABLE_KINDS } from './mapping';
import {
  QUESTION_TYPE_NAMES,
  QUESTION_TYPE_TELEMETRY,
  type FormDefinition,
  type FormQuestion,
} from './model';
import { readForm } from './read';

// Date and Time, Date Range and Phone questions (docs/specs/030-forms/forms.md "Question types", "Mapping").

const q = (type: FormQuestion['type'], extra: Partial<FormQuestion> = {}): FormQuestion => ({
  ...blankQuestion(type, 'q1'),
  ...extra,
});

describe('the new question types', () => {
  it('are named and counted as the builder names them', () => {
    expect(QUESTION_TYPE_NAMES.datetime).toBe('Date and Time');
    expect(QUESTION_TYPE_NAMES.daterange).toBe('Date Range');
    expect(QUESTION_TYPE_NAMES.phone).toBe('Phone');
    expect([
      QUESTION_TYPE_TELEMETRY.datetime,
      QUESTION_TYPE_TELEMETRY.daterange,
      QUESTION_TYPE_TELEMETRY.phone,
    ]).toEqual(['DateTime', 'DateRange', 'Phone']);
  });

  it('read back a Phone placeholder and a Date Range’s Include Time, and nothing stray', () => {
    const form = readForm({
      heading: 'Sign up',
      sections: [
        {
          id: 's1',
          title: '',
          questions: [
            { id: 'q1', type: 'phone', prompt: 'Phone', placeholder: 'Your mobile' },
            { id: 'q2', type: 'daterange', prompt: 'When', withTime: true },
            { id: 'q3', type: 'datetime', prompt: 'Call', withTime: true, placeholder: 'x' },
          ],
        },
      ],
    })!;
    expect(form.sections[0]!.questions).toEqual([
      { id: 'q1', type: 'phone', prompt: 'Phone', placeholder: 'Your mobile' },
      { id: 'q2', type: 'daterange', prompt: 'When', withTime: true },
      { id: 'q3', type: 'datetime', prompt: 'Call' },
    ]);
  });
});

describe('checking answers', () => {
  it('takes a moment with its offset, kept with its zone', () => {
    expect(checkAnswer(q('datetime'), '2026-10-31T17:00:00Z[Europe/London]')).toEqual({
      value: '2026-10-31T17:00:00Z[Europe/London]',
    });
    expect(checkAnswer(q('datetime'), '2026-10-31T18:00+01:00')).toEqual({
      value: '2026-10-31T17:00:00Z',
    });
    expect(checkAnswer(q('datetime'), '2026-10-31T17:00')).toEqual({ error: 'not_a_time' });
    expect(checkAnswer(q('datetime'), 5)).toEqual({ error: 'not_a_time' });
  });

  it('takes a range’s two ends in order, days or moments', () => {
    expect(checkAnswer(q('daterange'), ['2026-10-31', '2026-11-02'])).toEqual({
      value: ['2026-10-31', '2026-11-02'],
    });
    expect(checkAnswer(q('daterange'), ['2026-11-02', '2026-10-31'])).toEqual({
      error: 'end_before_start',
    });
    expect(checkAnswer(q('daterange'), ['2026-10-31', ''])).toEqual({ error: 'both_dates' });
    expect(checkAnswer(q('daterange'), ['2026-10-31', 4])).toEqual({ error: 'both_dates' });
    expect(checkAnswer(q('daterange'), '2026-10-31')).toEqual({ error: 'both_dates' });
    expect(checkAnswer(q('daterange'), ['2026-02-30', '2026-03-01'])).toEqual({
      error: 'not_a_date',
    });
    const timed = q('daterange', { withTime: true });
    expect(checkAnswer(timed, ['2026-10-31T09:00Z', '2026-10-31T17:00Z'])).toEqual({
      value: ['2026-10-31T09:00:00Z', '2026-10-31T17:00:00Z'],
    });
    expect(checkAnswer(timed, ['2026-10-31T17:00Z', '2026-10-31T09:00Z'])).toEqual({
      error: 'end_before_start',
    });
    expect(checkAnswer(timed, ['2026-10-31', '2026-11-01'])).toEqual({ error: 'not_a_time' });
    // An empty range is no answer, or required.
    expect(checkAnswer(q('daterange'), [])).toEqual({});
    expect(checkAnswer(q('daterange', { required: true }), [])).toEqual({ error: 'required' });
  });

  it('takes a phone number as typed, trimmed', () => {
    expect(checkAnswer(q('phone'), ' +44 20 7946 0958 ')).toEqual({ value: '+44 20 7946 0958' });
    expect(checkAnswer(q('phone'), 'call me')).toEqual({ error: 'not_a_phone' });
    expect(checkAnswer(q('phone'), 44)).toEqual({ error: 'not_a_phone' });
  });

  it('says what is wrong', () => {
    expect(answerErrorMessage(q('datetime'), 'not_a_time')).toBe('Enter a real date and time');
    expect(answerErrorMessage(q('daterange'), 'both_dates')).toBe('Enter both dates');
    expect(answerErrorMessage(q('daterange'), 'end_before_start')).toBe(
      'The end is before the start',
    );
    expect(answerErrorMessage(q('phone'), 'not_a_phone')).toBe(
      'Enter a phone number like +44 20 7946 0958',
    );
  });
});

describe('where the answers go', () => {
  const WHEN: CustomFieldDef = { id: 'f-when', label: 'When', kind: 'daterange' };
  const SLOT: CustomFieldDef = { id: 'f-slot', label: 'Slot', kind: 'daterange', withTime: true };
  const CALL: CustomFieldDef = { id: 'f-call', label: 'Call', kind: 'datetime' };
  const PHONE: CustomFieldDef = { id: 'f-phone', label: 'Phone', kind: 'phone' };

  it('maps each to its kind, a range only to one with matching times', () => {
    expect(MAPPABLE_KINDS.phone).toEqual(['phone', 'text']);
    expect(NEW_FIELD_KIND.datetime).toBe('datetime');
    expect(fieldTakes(q('daterange'), WHEN)).toBe(true);
    expect(fieldTakes(q('daterange'), SLOT)).toBe(false);
    expect(fieldTakes(q('daterange', { withTime: true }), SLOT)).toBe(true);
    expect(fieldTakes(q('datetime'), CALL)).toBe(true);
    expect(fieldTakes(q('phone'), PHONE)).toBe(true);
    expect(canGoToTitle(q('phone'))).toBe(true);
    expect(canGoToTitle(q('datetime'))).toBe(false);
    expect(newFieldFor(q('daterange', { withTime: true }), 'f-x', 'X')).toEqual({
      id: 'f-x',
      label: 'X',
      kind: 'daterange',
      withTime: true,
    });
    expect(newFieldFor(q('daterange'), 'f-x', 'X')).toEqual({
      id: 'f-x',
      label: 'X',
      kind: 'daterange',
    });
  });

  it('reads each answer as text in its own zone, and keeps mapped values as their fields do', () => {
    const at = answerText(q('datetime'), '2026-10-31T17:00:00Z[America/New_York]');
    expect(at).toContain('(America/New_York)');
    expect(at).toMatch(/1:00|13/);
    expect(answerText(q('datetime'), '2026-10-31T17:00:00Z')).toContain('(UTC)');
    expect(answerText(q('datetime'), 'not a time')).toBe('not a time');
    expect(answerText(q('daterange'), ['2026-10-31', '2026-11-02'])).toBe(
      '2026-10-31 to 2026-11-02',
    );
    expect(
      answerText(q('daterange', { withTime: true }), [
        '2026-10-31T09:00:00Z',
        '2026-10-31T17:00:00Z',
      ]),
    ).toContain(' to ');
    expect(answerText(q('phone'), '+44 20 7946 0958')).toBe('+44 20 7946 0958');

    const type: ItemTypeDef = {
      id: 'event',
      label: 'Event',
      newTitle: 'New event',
      color: '#123456',
      glyph: 'calendar',
      fields: ['title', 'status', 'f-when', 'f-call', 'f-phone'],
      custom: [WHEN, CALL, PHONE],
    };
    const form: FormDefinition = {
      v: 1,
      heading: 'Sign up',
      sections: [
        {
          id: 's1',
          title: '',
          questions: [
            { ...q('daterange'), id: 'a', goesTo: { to: 'field', fieldId: 'f-when' } },
            { ...q('datetime'), id: 'b', goesTo: { to: 'field', fieldId: 'f-call' } },
            { ...q('phone'), id: 'c', goesTo: { to: 'title' } },
            { ...q('phone'), id: 'd', prompt: 'Other phone' },
          ],
        },
      ],
    };
    const made = responseCard(
      form,
      't1',
      new Map<string, string | string[]>([
        ['a', ['2026-10-31', '2026-11-02']],
        ['b', '2026-10-31T17:00:00Z[Europe/London]'],
        ['c', '+44 20 7946 0958'],
        ['d', '+1 555 010 0199'],
      ]),
      type,
      3,
    );
    expect(made.fields).toMatchObject({
      title: '+44 20 7946 0958',
      'f-when': ['2026-10-31', '2026-11-02'],
      'f-call': '2026-10-31T17:00:00Z[Europe/London]',
      description: 'Other phone\n+1 555 010 0199',
    });
  });
});
