import { describe, expect, it } from 'vitest';
import { blankQuestion } from '@livediagram/forms';
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
