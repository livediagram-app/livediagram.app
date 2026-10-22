import { describe, expect, it } from 'vitest';
import { blankQuestion, OPTION_MAX } from '@livedesign/forms';
import { applyQuestionSet, questionFrom } from './form-question';

// An agent's question (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Question input"): made as the builder
// makes one, every setting checked against its type and the builder's limits.
describe('questionFrom', () => {
  it('makes the builder’s question, with the settings given', () => {
    const made = questionFrom(
      { type: 'single', prompt: ' Coming? ', options: ['Yes', 'No'], required: true },
      'q-1',
    );
    expect(made).toEqual({
      ok: true,
      question: {
        id: 'q-1',
        type: 'single',
        prompt: 'Coming?',
        options: ['Yes', 'No'],
        required: true,
      },
    });
    const rating = questionFrom({ type: 'rating', prompt: 'Rate us' }, 'q-2');
    expect(rating.ok && rating.question).toMatchObject({ scale: 5, style: 'stars' });
  });

  it('refuses an unknown type, naming the types', () => {
    const made = questionFrom({ type: 'slider' as never, prompt: 'x' }, 'q');
    expect(made).toMatchObject({ ok: false, code: 'type_unknown' });
    expect(!made.ok && made.message).toContain('short (Short Answer)');
  });

  it('refuses a setting the type does not have, naming the ones it has', () => {
    const made = questionFrom({ type: 'email', prompt: 'Email', options: ['a'] }, 'q');
    expect(made).toMatchObject({ ok: false, code: 'setting_not_for_type' });
    expect(!made.ok && made.message).toContain('placeholder');
  });

  it('keeps the builder’s limits', () => {
    expect(questionFrom({ type: 'short', prompt: '' }, 'q')).toMatchObject({
      code: 'prompt_empty',
    });
    expect(questionFrom({ type: 'short', prompt: 'x'.repeat(201) }, 'q')).toMatchObject({
      code: 'too_long',
    });
    expect(questionFrom({ type: 'single', prompt: 'p', options: ['A', 'a'] }, 'q')).toMatchObject({
      code: 'options_repeat',
    });
    expect(questionFrom({ type: 'single', prompt: 'p', options: [] }, 'q')).toMatchObject({
      code: 'options_none',
    });
    expect(
      questionFrom(
        { type: 'single', prompt: 'p', options: Array.from({ length: 21 }, (_, i) => `O${i}`) },
        'q',
      ),
    ).toMatchObject({ code: 'options_full' });
    expect(questionFrom({ type: 'rating', prompt: 'p', scale: 11 }, 'q')).toMatchObject({
      code: 'scale_out_of_range',
    });
    expect(questionFrom({ type: 'rating', prompt: 'p', lowLabel: 'Meh' }, 'q')).toMatchObject({
      code: 'labels_need_numbers',
    });
    expect(
      questionFrom({ type: 'multi', prompt: 'p', options: ['A', 'B'], max: 3 }, 'q'),
    ).toMatchObject({
      code: 'picks_out_of_range',
    });
    expect(questionFrom({ type: 'number', prompt: 'p', min: 5, max: 1 }, 'q')).toMatchObject({
      code: 'min_over_max',
    });
  });

  it('clears a text setting given empty and a switch given false', () => {
    const q = { ...blankQuestion('short', 'q'), prompt: 'p', help: 'h', required: true as const };
    const set = applyQuestionSet(q, { help: '', required: false });
    expect(set.ok && set.question).toEqual({ id: 'q', type: 'short', prompt: 'p' });
  });
});

describe('the settings each type takes', () => {
  it('reads every setting a type has, and clears what is given empty', () => {
    const rating = questionFrom(
      {
        type: 'rating',
        prompt: 'Rate',
        scale: 10,
        style: 'numbers',
        lowLabel: 'Poor',
        highLabel: 'Great',
      },
      'q',
    );
    expect(rating.ok && rating.question).toMatchObject({
      scale: 10,
      style: 'numbers',
      lowLabel: 'Poor',
      highLabel: 'Great',
    });
    const number = questionFrom(
      { type: 'number', prompt: 'Age', min: 18, max: 99, whole: true, placeholder: '30' },
      'q',
    );
    expect(number.ok && number.question).toMatchObject({
      min: 18,
      max: 99,
      whole: true,
      placeholder: '30',
    });
    const multi = questionFrom(
      { type: 'multi', prompt: 'Pick', options: ['A', 'B', 'C'], min: 1, max: 2, other: true },
      'q',
    );
    expect(multi.ok && multi.question).toMatchObject({ min: 1, max: 2, other: true });
    expect(questionFrom({ type: 'single', prompt: 'P', dropdown: true }, 'q')).toMatchObject({
      ok: true,
    });
  });

  it('names the settings of a type that has none beyond its prompt', () => {
    const made = questionFrom({ type: 'date', prompt: 'When', placeholder: 'x' }, 'q');
    expect(!made.ok && made.message).toContain('none beyond prompt, help and required');
  });

  // The benchmark's Q4: an answer a model wrote, refused at the old 40 characters.
  it('takes an option of a full answer', () => {
    const option = "No, I'm in the process of obtaining work authorisation";
    expect(
      questionFrom({ type: 'single', prompt: 'Right to work?', options: ['Yes', option] }, 'q'),
    ).toMatchObject({ ok: true, question: { options: ['Yes', option] } });
  });

  it('refuses an empty or over-long option, a number that is none, and help past its limit', () => {
    expect(questionFrom({ type: 'single', prompt: 'P', options: ['A', ' '] }, 'q')).toMatchObject({
      code: 'option_empty',
    });
    expect(
      questionFrom({ type: 'single', prompt: 'P', options: ['x'.repeat(OPTION_MAX + 1)] }, 'q'),
    ).toMatchObject({ code: 'too_long' });
    expect(questionFrom({ type: 'number', prompt: 'P', min: Number.NaN }, 'q')).toMatchObject({
      code: 'invalid_value',
    });
    expect(questionFrom({ type: 'short', prompt: 'P', help: 'h'.repeat(501) }, 'q')).toMatchObject({
      code: 'too_long',
    });
    expect(
      questionFrom({ type: 'multi', prompt: 'P', options: ['A'], min: 1.5 }, 'q'),
    ).toMatchObject({
      code: 'picks_out_of_range',
    });
  });

  it('reads a multiple choice with no options as offering none', () => {
    const bare = { id: 'q', type: 'multi' as const, prompt: 'P' };
    expect(applyQuestionSet(bare, { max: 1 })).toMatchObject({ code: 'picks_out_of_range' });
  });
});
