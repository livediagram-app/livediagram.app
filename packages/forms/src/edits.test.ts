import { describe, expect, it } from 'vitest';
import { QUESTIONS_MAX, SECTIONS_MAX, questionsOf, type FormDefinition } from './index';
import {
  addQuestion,
  addSection,
  blankQuestion,
  deleteQuestion,
  deleteSection,
  duplicateQuestion,
  findQuestion,
  moveQuestion,
  neighbourOf,
  nextOptionName,
  pastedOptions,
  patchForm,
  placeQuestion,
  questionById,
  setOptions,
  setQuestionType,
  setTarget,
  updateQuestion,
  updateSection,
} from './edits';

// docs/specs/030-forms/forms.md "Building a form": each edit pure, one form in, the next out.

let n = 0;
const newId = (p: 'q' | 's') => `${p}-n${(n += 1)}`;

const form = (): FormDefinition => ({
  v: 1,
  heading: 'Form',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-a', type: 'short', prompt: 'A', goesTo: { to: 'title' } },
        { id: 'q-b', type: 'single', prompt: 'B', options: ['X', 'Y'], other: true },
      ],
    },
    { id: 's-2', title: 'Two', questions: [{ id: 'q-c', type: 'paragraph', prompt: 'C' }] },
  ],
});

const ids = (f: FormDefinition) => f.sections.map((s) => s.questions.map((q) => q.id));

describe('finding', () => {
  it('finds a question by id', () => {
    expect(findQuestion(form(), 'q-c')).toEqual({ section: 1, index: 0 });
    expect(findQuestion(form(), 'nope')).toBeNull();
    expect(questionById(form(), 'q-b')?.prompt).toBe('B');
    expect(questionById(form(), null)).toBeUndefined();
    expect(questionById(form(), 'nope')).toBeUndefined();
  });
});

describe('adding questions', () => {
  it('adds after the selected question, or at the end', () => {
    const after = addQuestion(form(), 'rating', 'q-a', newId);
    expect(ids(after.form)[0]).toEqual(['q-a', after.id, 'q-b']);
    expect(questionById(after.form, after.id)).toMatchObject({
      type: 'rating',
      scale: 5,
      style: 'stars',
    });
    const end = addQuestion(form(), 'multi', null, newId);
    expect(ids(end.form)[1]).toEqual(['q-c', end.id]);
    expect(questionById(end.form, end.id)?.options).toEqual(['Option 1', 'Option 2']);
  });

  it('stops at the question limit', () => {
    const full: FormDefinition = {
      v: 1,
      heading: 'F',
      sections: [
        {
          id: 's',
          title: '',
          questions: Array.from({ length: QUESTIONS_MAX }, (_, i) =>
            blankQuestion('short', `q-${i}`),
          ),
        },
      ],
    };
    expect(addQuestion(full, 'short', null, newId)).toEqual({ form: full, id: null });
    expect(duplicateQuestion(full, 'q-1', newId)).toEqual({ form: full, id: null });
  });

  it('duplicates below, without its mapping', () => {
    const d = duplicateQuestion(form(), 'q-a', newId);
    expect(ids(d.form)[0]).toEqual(['q-a', d.id, 'q-b']);
    expect(questionById(d.form, d.id)).toEqual({ id: d.id, type: 'short', prompt: 'A' });
    const opts = duplicateQuestion(form(), 'q-b', newId);
    expect(questionById(opts.form, opts.id)?.options).toEqual(['X', 'Y']);
    expect(duplicateQuestion(form(), 'nope', newId).id).toBeNull();
  });
});

describe('deleting and moving', () => {
  it('deletes, and names the neighbour to select', () => {
    expect(ids(deleteQuestion(form(), 'q-b'))).toEqual([['q-a'], ['q-c']]);
    expect(deleteQuestion(form(), 'nope')).toEqual(form());
    expect(neighbourOf(form(), 'q-b')).toBe('q-c');
    expect(neighbourOf(form(), 'q-c')).toBe('q-b');
    expect(neighbourOf(form(), 'nope')).toBeNull();
    const one: FormDefinition = {
      v: 1,
      heading: 'F',
      sections: [{ id: 's', title: '', questions: [blankQuestion('short', 'q')] }],
    };
    expect(neighbourOf(one, 'q')).toBeNull();
  });

  it('moves within a section and across its edges', () => {
    expect(ids(moveQuestion(form(), 'q-a', 1))).toEqual([['q-b', 'q-a'], ['q-c']]);
    expect(ids(moveQuestion(form(), 'q-b', 1))).toEqual([['q-a'], ['q-b', 'q-c']]);
    expect(ids(moveQuestion(form(), 'q-c', -1))).toEqual([['q-a', 'q-b', 'q-c'], []]);
    const f = form();
    expect(moveQuestion(f, 'q-a', -1)).toBe(f);
    expect(moveQuestion(f, 'q-c', 1)).toBe(f);
    expect(moveQuestion(f, 'nope', 1)).toBe(f);
  });

  it('places a dragged question', () => {
    expect(ids(placeQuestion(form(), 'q-a', 1, 1))).toEqual([['q-b'], ['q-c', 'q-a']]);
    expect(ids(placeQuestion(form(), 'q-a', 0, 2))).toEqual([['q-b', 'q-a'], ['q-c']]);
    expect(ids(placeQuestion(form(), 'q-c', 0, 0))).toEqual([['q-c', 'q-a', 'q-b'], []]);
    const f = form();
    expect(placeQuestion(f, 'q-a', 0, 0)).toBe(f);
    expect(placeQuestion(f, 'q-a', 0, 1)).toBe(f);
    expect(placeQuestion(f, 'q-a', 5, 0)).toBe(f);
    expect(placeQuestion(f, 'nope', 0, 0)).toBe(f);
  });
});

describe('changing a question', () => {
  it('patches, and a field set to undefined goes', () => {
    const f = updateQuestion(form(), 'q-a', { prompt: 'Name', required: true });
    expect(questionById(f, 'q-a')).toMatchObject({ prompt: 'Name', required: true });
    expect(
      questionById(updateQuestion(f, 'q-a', { required: undefined }), 'q-a'),
    ).not.toHaveProperty('required');
    expect(updateQuestion(form(), 'nope', { prompt: 'x' })).toEqual(form());
  });

  it('changes type, keeping what still fits', () => {
    let f = updateQuestion(form(), 'q-b', { help: 'Pick', required: true });
    f = setQuestionType(f, 'q-b', 'multi');
    expect(questionById(f, 'q-b')).toEqual({
      id: 'q-b',
      type: 'multi',
      prompt: 'B',
      help: 'Pick',
      required: true,
      options: ['X', 'Y'],
      other: true,
    });
    expect(questionById(setQuestionType(form(), 'q-a', 'paragraph'), 'q-a')).not.toHaveProperty(
      'goesTo',
    );
    expect(questionById(setQuestionType(form(), 'q-a', 'email'), 'q-a')?.goesTo).toEqual({
      to: 'title',
    });
    const mapped = setTarget(form(), 'q-c', { to: 'field', fieldId: 'f-x' });
    expect(questionById(setQuestionType(mapped, 'q-c', 'short'), 'q-c')?.goesTo).toEqual({
      to: 'field',
      fieldId: 'f-x',
    });
    const f2 = form();
    expect(setQuestionType(f2, 'q-a', 'short').sections[0]!.questions[0]).toBe(
      f2.sections[0]!.questions[0],
    );
  });

  it('gives Title and a field to one question at most', () => {
    const t = setTarget(form(), 'q-b', { to: 'title' });
    expect(questionsOf(t).map((q) => q.goesTo)).toEqual([undefined, { to: 'title' }, undefined]);
    const a = setTarget(form(), 'q-a', { to: 'field', fieldId: 'f-x' });
    const b = setTarget(a, 'q-c', { to: 'field', fieldId: 'f-x' });
    expect(questionsOf(b).map((q) => q.goesTo)).toEqual([
      undefined,
      undefined,
      { to: 'field', fieldId: 'f-x' },
    ]);
    expect(questionById(setTarget(form(), 'q-a', { to: 'description' }), 'q-a')).not.toHaveProperty(
      'goesTo',
    );
  });
});

describe('options', () => {
  it('sets, names and pastes options', () => {
    expect(questionById(setOptions(form(), 'q-b', ['P']), 'q-b')?.options).toEqual(['P']);
    expect(nextOptionName(['Option 1', 'Option 2'])).toBe('Option 3');
    expect(nextOptionName(['option 3', 'B'])).toBe('Option 4');
    expect(pastedOptions(['A', ''], 1, 'B\nA\n\nC')).toEqual(['A', 'B', 'C']);
    expect(pastedOptions(['A', 'D'], 0, 'B\nC')).toEqual(['A', 'B', 'C', 'D']);
    expect(pastedOptions(['A'], 0, 'one line')).toBeNull();
    const many = Array.from({ length: 19 }, (_, i) => `O${i}`);
    expect(pastedOptions(many, 18, 'x\ny\nz')).toHaveLength(20);
  });
});

describe('sections', () => {
  it('splits a section where you are, or adds one at the end', () => {
    const split = addSection(form(), newId, 'q-a');
    expect(ids(split.form)).toEqual([['q-a'], ['q-b'], ['q-c']]);
    expect(split.form.sections[1]!.id).toBe(split.id);
    const end = addSection(form(), newId, null);
    expect(ids(end.form)).toEqual([['q-a', 'q-b'], ['q-c'], []]);
    const full: FormDefinition = {
      v: 1,
      heading: 'F',
      sections: Array.from({ length: SECTIONS_MAX }, (_, i) => ({
        id: `s-${i}`,
        title: '',
        questions: [],
      })),
    };
    expect(addSection(full, newId, null)).toEqual({ form: full, id: null });
  });

  it('retitles, and removes a section into the one before', () => {
    const f = updateSection(form(), 's-2', { title: 'Later', description: 'More' });
    expect(f.sections[1]).toMatchObject({ title: 'Later', description: 'More' });
    expect(updateSection(f, 's-2', { description: '' }).sections[1]).not.toHaveProperty(
      'description',
    );
    expect(ids(deleteSection(form(), 's-2'))).toEqual([['q-a', 'q-b', 'q-c']]);
    const g = form();
    expect(deleteSection(g, 's-1')).toBe(g);
    expect(deleteSection(g, 'nope')).toBe(g);
  });
});

describe('the form', () => {
  it('patches its settings, an undefined one removed', () => {
    const f = patchForm(form(), { limit: 10, confirmation: 'Ta' });
    expect(f).toMatchObject({ limit: 10, confirmation: 'Ta' });
    expect(patchForm(f, { limit: undefined })).not.toHaveProperty('limit');
  });
});
