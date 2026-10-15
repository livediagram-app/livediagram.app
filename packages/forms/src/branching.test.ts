import { describe, expect, it } from 'vitest';
import {
  CHECKBOX_TICKED,
  CHECKBOX_UNTICKED,
  ruleChoices,
  ruleQuestion,
  ruleQuestions,
  sectionsShown,
  shownQuestions,
} from './branching';
import { checkResponse } from './answers';
import { publicForm } from './public';
import { readForm } from './read';
import type { FormDefinition } from './model';

// Showing a section only sometimes (docs/specs/030-forms/forms.md "Showing a section only sometimes").

const form: FormDefinition = {
  v: 1,
  heading: 'RSVP',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-come', type: 'single', prompt: 'Coming?', options: ['Yes', 'No'], required: true },
        { id: 'q-name', type: 'short', prompt: 'Name' },
      ],
    },
    {
      id: 's-2',
      title: 'Food',
      showIf: { questionId: 'q-come', anyOf: ['Yes'] },
      questions: [
        { id: 'q-diet', type: 'multi', prompt: 'Diet', options: ['Vegan', 'Halal'] },
        { id: 'q-kids', type: 'checkbox', prompt: 'Bringing children' },
        { id: 'q-food', type: 'short', prompt: 'Allergies', required: true },
      ],
    },
    {
      id: 's-3',
      title: 'Vegan menu',
      showIf: { questionId: 'q-diet', anyOf: ['Vegan'] },
      questions: [{ id: 'q-menu', type: 'short', prompt: 'Starter' }],
    },
    {
      id: 's-4',
      title: 'Children',
      showIf: { questionId: 'q-kids', anyOf: [CHECKBOX_TICKED] },
      questions: [],
    },
    { id: 's-5', title: 'Thanks', questions: [] },
  ],
};

describe('sectionsShown', () => {
  it('shows the first and unruled sections, and a ruled one when its answer matches', () => {
    expect(sectionsShown(form, {})).toEqual([true, false, false, false, true]);
    expect(sectionsShown(form, { 'q-come': 'No' })).toEqual([true, false, false, false, true]);
    expect(
      sectionsShown(form, { 'q-come': 'Yes', 'q-diet': ['Halal', 'Vegan'], 'q-kids': true }),
    ).toEqual([true, true, true, true, true]);
    expect(sectionsShown(form, { 'q-come': 'Yes', 'q-diet': ['Halal'] })).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
  });

  it('never lets a hidden section’s answers decide another', () => {
    expect(sectionsShown(form, { 'q-come': 'No', 'q-diet': ['Vegan'], 'q-kids': true })).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it('shows a section whose rule is broken: its question gone, later, unfit, or none of its answers offered', () => {
    const broken = (rule: { questionId: string; anyOf: string[] }) =>
      sectionsShown(
        {
          sections: [
            form.sections[0]!,
            { id: 's-2', title: '', showIf: rule, questions: [] },
            {
              id: 's-3',
              title: '',
              questions: [{ id: 'q-late', type: 'single', prompt: 'L', options: ['A'] }],
            },
          ],
        },
        {},
      )[1];
    expect(broken({ questionId: 'q-gone', anyOf: ['Yes'] })).toBe(true);
    expect(broken({ questionId: 'q-late', anyOf: ['A'] })).toBe(true);
    expect(broken({ questionId: 'q-name', anyOf: ['Ada'] })).toBe(true);
    expect(broken({ questionId: 'q-come', anyOf: ['Maybe'] })).toBe(true);
  });
});

describe('the questions and answers a rule may use', () => {
  it('lists earlier choice and checkbox questions, and their answers', () => {
    expect(ruleQuestions(form, 0)).toEqual([]);
    expect(ruleQuestions(form, 2).map((q) => q.id)).toEqual(['q-come', 'q-diet', 'q-kids']);
    expect(ruleChoices(form.sections[1]!.questions[1]!)).toEqual([
      CHECKBOX_TICKED,
      CHECKBOX_UNTICKED,
    ]);
    expect(ruleChoices({ id: 'q', type: 'single', prompt: '' })).toEqual([]);
    expect(ruleQuestion(form, 1, form.sections[1]!.showIf!)?.id).toBe('q-come');
    expect(ruleQuestion(form, 1, { questionId: 'q-diet', anyOf: ['Vegan'] })).toBeNull();
  });

  it('reads a Not Ticked rule as an unticked or unanswered box', () => {
    const f = {
      sections: [
        { id: 'a', title: '', questions: [{ id: 'q-k', type: 'checkbox' as const, prompt: 'K' }] },
        {
          id: 'b',
          title: '',
          showIf: { questionId: 'q-k', anyOf: [CHECKBOX_UNTICKED] },
          questions: [],
        },
      ],
    };
    expect(sectionsShown(f, {})[1]).toBe(true);
    expect(sectionsShown(f, { 'q-k': true })[1]).toBe(false);
  });
});

describe('a response with sections that do not show', () => {
  it('checks only what shows and drops a hidden section’s answers', () => {
    expect(shownQuestions(form, { 'q-come': 'No' }).map((q) => q.id)).toEqual(['q-come', 'q-name']);
    const r = checkResponse(form, { answers: { 'q-come': 'No', 'q-diet': ['Vegan'] } });
    expect(r).toEqual({ ok: true, answers: new Map([['q-come', 'No']]) });
    // Shown, its required question is asked.
    expect(checkResponse(form, { answers: { 'q-come': 'Yes' } })).toEqual({
      ok: false,
      errors: { 'q-food': 'required' },
    });
  });
});

describe('a rule as stored', () => {
  it('is read on a later section, its answers cleaned, and dropped when unusable or on the first', () => {
    const read = readForm({
      ...form,
      sections: [
        { ...form.sections[0], showIf: { questionId: 'q-x', anyOf: ['Yes'] } },
        { ...form.sections[1], showIf: { questionId: 'q-come', anyOf: [' Yes ', 'yes', ''] } },
        { ...form.sections[2], showIf: { questionId: 'Bad Id', anyOf: ['Vegan'] } },
        { ...form.sections[3], showIf: { questionId: 'q-kids', anyOf: [] } },
        { ...form.sections[4], showIf: 'q-come' },
      ],
    })!;
    expect(read.sections.map((s) => s.showIf)).toEqual([
      undefined,
      { questionId: 'q-come', anyOf: ['Yes'] },
      undefined,
      undefined,
      undefined,
    ]);
    expect(publicForm(read).sections[1]!.showIf).toEqual({ questionId: 'q-come', anyOf: ['Yes'] });
  });
});
