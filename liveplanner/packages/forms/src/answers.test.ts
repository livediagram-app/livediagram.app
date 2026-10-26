import { describe, expect, it } from 'vitest';
import {
  OTHER_ANSWER,
  answerErrorMessage,
  checkAnswer,
  checkResponse,
  isDateAnswer,
  normaliseLink,
  type AnswerError,
} from './answers';
import type { FormQuestion } from './model';

const Q = (type: FormQuestion['type'], extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id: 'q-1',
  type,
  prompt: 'P',
  ...extra,
});

describe('checkAnswer', () => {
  it('treats empty answers as nothing, or required', () => {
    for (const empty of [undefined, null, '', '  ', [], false]) {
      expect(checkAnswer(Q('short'), empty)).toEqual({});
      expect(checkAnswer(Q('short', { required: true }), empty)).toEqual({ error: 'required' });
    }
    expect(checkAnswer(Q('checkbox', { required: true }), false)).toEqual({ error: 'must_tick' });
  });

  it('checks text lengths', () => {
    expect(checkAnswer(Q('short'), '  hi ')).toEqual({ value: 'hi' });
    expect(checkAnswer(Q('short'), 'x'.repeat(201))).toEqual({ error: 'too_long' });
    expect(checkAnswer(Q('paragraph'), 'x'.repeat(2000))).toEqual({ value: 'x'.repeat(2000) });
    expect(checkAnswer(Q('paragraph'), 'x'.repeat(2001))).toEqual({ error: 'too_long' });
    expect(checkAnswer(Q('short'), 4)).toEqual({ error: 'required' });
  });

  it('checks numbers', () => {
    expect(checkAnswer(Q('number'), '4.5')).toEqual({ value: 4.5 });
    expect(checkAnswer(Q('number'), 3)).toEqual({ value: 3 });
    expect(checkAnswer(Q('number'), 'abc')).toEqual({ error: 'not_a_number' });
    expect(checkAnswer(Q('number'), true)).toEqual({ error: 'not_a_number' });
    expect(checkAnswer(Q('number', { whole: true }), '4.5')).toEqual({ error: 'not_whole' });
    expect(checkAnswer(Q('number', { min: 1 }), 0)).toEqual({ error: 'below_min' });
    expect(checkAnswer(Q('number', { max: 1 }), 2)).toEqual({ error: 'above_max' });
  });

  it('checks emails, links and dates', () => {
    expect(checkAnswer(Q('email'), ' a@b.co ')).toEqual({ value: 'a@b.co' });
    expect(checkAnswer(Q('email'), 'nope')).toEqual({ error: 'not_an_email' });
    expect(checkAnswer(Q('email'), 1)).toEqual({ error: 'not_an_email' });
    expect(checkAnswer(Q('link'), 'example.com/a')).toEqual({ value: 'https://example.com/a' });
    expect(checkAnswer(Q('link'), 'http://example.com')).toEqual({ error: 'not_a_link' });
    expect(checkAnswer(Q('link'), 2)).toEqual({ error: 'not_a_link' });
    expect(checkAnswer(Q('link'), `https://a.co/${'x'.repeat(2048)}`)).toEqual({
      error: 'too_long',
    });
    expect(checkAnswer(Q('date'), '2026-02-28')).toEqual({ value: '2026-02-28' });
    expect(checkAnswer(Q('date'), '2026-02-30')).toEqual({ error: 'not_a_date' });
    expect(checkAnswer(Q('date'), 5)).toEqual({ error: 'not_a_date' });
  });

  it('checks a single choice, with Other', () => {
    const q = Q('single', { options: ['A', 'B'], other: true });
    expect(checkAnswer(q, 'A')).toEqual({ value: 'A' });
    expect(checkAnswer(q, 'C')).toEqual({ error: 'not_an_option' });
    expect(checkAnswer(q, 3)).toEqual({ error: 'not_an_option' });
    expect(checkAnswer(q, OTHER_ANSWER, ' Mine ')).toEqual({ value: 'Mine' });
    expect(checkAnswer(q, OTHER_ANSWER, 3)).toEqual({ error: 'required' });
    expect(checkAnswer(Q('single'), 'A')).toEqual({ error: 'not_an_option' });
    expect(checkAnswer(Q('single', { options: ['A'] }), OTHER_ANSWER, 'x')).toEqual({
      error: 'not_an_option',
    });
  });

  it('checks a multiple choice: order, Other, picks', () => {
    const q = Q('multi', { options: ['A', 'B', 'C'], other: true, min: 2, max: 3 });
    expect(checkAnswer(q, ['C', 'A', 'A'])).toEqual({ value: ['A', 'C'] });
    expect(checkAnswer(q, ['A'])).toEqual({ error: 'too_few' });
    expect(checkAnswer(q, ['A', 'B', 'C', OTHER_ANSWER], 'D')).toEqual({ error: 'too_many' });
    expect(checkAnswer(q, ['A', OTHER_ANSWER], 'D')).toEqual({ value: ['A', 'D'] });
    // An Other repeating a ticked option merges into it before the picks are counted (the owner's call): one pick.
    expect(checkAnswer(q, ['A', OTHER_ANSWER], 'A')).toEqual({ error: 'too_few' });
    expect(checkAnswer({ ...q, min: undefined, max: 2 }, ['A', 'B', OTHER_ANSWER], 'A')).toEqual({
      value: ['A', 'B'],
    });
    expect(checkAnswer({ ...q, min: undefined }, ['A', OTHER_ANSWER], 'A')).toEqual({
      value: ['A'],
    });
    // Other typed as an option that was not ticked counts as that option, never as nothing.
    expect(checkAnswer({ ...q, min: undefined }, [OTHER_ANSWER], 'B')).toEqual({ value: ['B'] });
    expect(checkAnswer({ ...q, min: undefined }, ['C', OTHER_ANSWER], 'A')).toEqual({
      value: ['A', 'C'],
    });
    expect(checkAnswer(q, ['A', OTHER_ANSWER], '')).toEqual({ error: 'required' });
    expect(checkAnswer(q, ['A', 'Z'])).toEqual({ error: 'not_an_option' });
    expect(checkAnswer(q, 'A')).toEqual({ error: 'not_an_option' });
    expect(checkAnswer(q, ['A', 2])).toEqual({ error: 'not_an_option' });
    expect(checkAnswer(Q('multi'), ['A'])).toEqual({ error: 'not_an_option' });
  });

  it('checks ratings and checkboxes', () => {
    expect(checkAnswer(Q('rating'), 5)).toEqual({ value: 5 });
    expect(checkAnswer(Q('rating'), '3')).toEqual({ value: 3 });
    expect(checkAnswer(Q('rating'), 6)).toEqual({ error: 'out_of_scale' });
    expect(checkAnswer(Q('rating'), true)).toEqual({ error: 'out_of_scale' });
    expect(checkAnswer(Q('rating'), [2])).toEqual({ error: 'out_of_scale' });
    expect(checkAnswer(Q('rating'), '2.0')).toEqual({ error: 'out_of_scale' });
    expect(checkAnswer(Q('rating', { scale: 10 }), 10)).toEqual({ value: 10 });
    expect(checkAnswer(Q('checkbox'), true)).toEqual({ value: true });
    expect(checkAnswer(Q('checkbox'), 'yes')).toEqual({ error: 'must_tick' });
  });
});

describe('checkResponse', () => {
  const form = {
    sections: [
      {
        id: 's-1',
        title: '',
        questions: [Q('short', { required: true }), Q('number', { id: 'q-2' })],
      },
    ],
  };

  it('keeps answered questions and drops answers to unknown ids', () => {
    const r = checkResponse(form, { answers: { 'q-1': 'Ada', 'q-9': 'gone' } });
    expect(r).toEqual({ ok: true, answers: new Map([['q-1', 'Ada']]) });
  });

  it('lists every error by question', () => {
    expect(checkResponse(form, { answers: { 'q-2': 'x' } })).toEqual({
      ok: false,
      errors: { 'q-1': 'required', 'q-2': 'not_a_number' },
    });
  });

  it('checks only the questions given (a section, on Next)', () => {
    const r = checkResponse(form, { answers: {} }, [form.sections[0]!.questions[1]!]);
    expect(r.ok).toBe(true);
  });
});

describe('answerErrorMessage', () => {
  it('has copy for every error', () => {
    const errors: AnswerError[] = [
      'required',
      'must_tick',
      'too_long',
      'not_a_number',
      'not_whole',
      'below_min',
      'above_max',
      'not_an_email',
      'not_a_link',
      'not_a_date',
      'not_an_option',
      'too_few',
      'too_many',
      'out_of_scale',
    ];
    for (const e of errors) expect(answerErrorMessage(Q('short'), e)).toBeTruthy();
  });

  it('names the limits', () => {
    expect(answerErrorMessage(Q('short'), 'too_long')).toBe('Keep it under 200 characters');
    expect(answerErrorMessage(Q('paragraph'), 'too_long')).toBe('Keep it under 2,000 characters');
    expect(answerErrorMessage(Q('link'), 'too_long')).toBe('That web address is too long');
    expect(answerErrorMessage(Q('number', { min: 1, max: 10, whole: true }), 'below_min')).toBe(
      'Enter a whole number from 1 to 10',
    );
    expect(answerErrorMessage(Q('number', { min: 1 }), 'below_min')).toBe(
      'Enter a number of 1 or more',
    );
    expect(answerErrorMessage(Q('number', { max: 9 }), 'above_max')).toBe(
      'Enter a number of 9 or less',
    );
    expect(answerErrorMessage(Q('multi', { max: 3 }), 'too_many')).toBe('Pick at most 3');
    expect(answerErrorMessage(Q('multi', { min: 2 }), 'too_few')).toBe('Pick at least 2');
    expect(answerErrorMessage(Q('rating', { scale: 10 }), 'out_of_scale')).toBe(
      'Pick a rating from 1 to 10',
    );
    expect(answerErrorMessage(Q('rating'), 'out_of_scale')).toBe('Pick a rating from 1 to 5');
  });
});

describe('helpers', () => {
  it('isDateAnswer', () => {
    expect(isDateAnswer('2024-02-29')).toBe(true);
    expect(isDateAnswer('2023-02-29')).toBe(false);
    expect(isDateAnswer('29/02/2024')).toBe(false);
  });

  it('normaliseLink', () => {
    expect(normaliseLink('https://a.co')).toBe('https://a.co');
    expect(normaliseLink('mailto:a@b.co')).toBeNull();
    expect(normaliseLink('localhost')).toBeNull();
    expect(normaliseLink('https://exa mple.com')).toBeNull();
  });
});
