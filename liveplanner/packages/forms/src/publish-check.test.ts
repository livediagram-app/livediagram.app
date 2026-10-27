import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@liveplanner/items';
import { PUBLISH_PROBLEM_TEXT, publishProblemText, publishProblems } from './publish-check';
import type { FormDefinition } from './model';

// What stops a form being published (docs/specs/030-forms/forms.md "Publishing and the form link").

const type: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'f-sev'],
  custom: [{ id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low'] }],
};

describe('publishProblems', () => {
  it('asks for a question first', () => {
    expect(publishProblems({ sections: [{ id: 's', title: '', questions: [] }] }, type)).toEqual([
      { kind: 'no_questions' },
    ]);
  });

  it('names each unworded question, choice without options, broken mapping and broken rule', () => {
    const form: Pick<FormDefinition, 'sections'> = {
      sections: [
        {
          id: 's-1',
          title: '',
          questions: [
            { id: 'q-a', type: 'short', prompt: '  ' },
            { id: 'q-b', type: 'single', prompt: 'Pick', options: [] },
            { id: 'q-c', type: 'short', prompt: 'Sev', goesTo: { to: 'field', fieldId: 'f-gone' } },
            {
              id: 'q-d',
              type: 'single',
              prompt: 'Ok',
              options: ['Low'],
              goesTo: { to: 'field', fieldId: 'f-sev' },
            },
          ],
        },
        { id: 's-2', title: '', showIf: { questionId: 'q-gone', anyOf: ['X'] }, questions: [] },
      ],
    };
    expect(publishProblems(form, type)).toEqual([
      { kind: 'unworded', questionId: 'q-a' },
      { kind: 'no_options', questionId: 'q-b' },
      { kind: 'broken_mapping', questionId: 'q-c' },
      { kind: 'broken_rule', sectionId: 's-2' },
    ]);
    // With no card type the destination's own check speaks; mappings are not judged.
    expect(publishProblems(form, undefined).map((p) => p.kind)).not.toContain('broken_mapping');
    expect(Object.keys(PUBLISH_PROBLEM_TEXT)).toHaveLength(6);
  });

  it('asks for a required question going to each required field, in a section every response sees', () => {
    const required: ItemTypeDef = {
      ...type,
      fields: ['title', 'status', 'f-sev', 'f-area', 'f-ok'],
      custom: [
        { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low'], required: true },
        { id: 'f-area', label: 'Area', kind: 'text', required: true },
        { id: 'f-ok', label: 'Ok', kind: 'checkbox', required: true },
      ],
    };
    const sev = {
      id: 'q-sev',
      type: 'single' as const,
      prompt: 'Severity',
      options: ['Low'],
      goesTo: { to: 'field' as const, fieldId: 'f-sev' },
    };
    const area = {
      id: 'q-area',
      type: 'short' as const,
      prompt: 'Area',
      required: true as const,
      goesTo: { to: 'field' as const, fieldId: 'f-area' },
    };
    // Severity is asked but not required; Area is required but only in a section shown sometimes.
    const form: Pick<FormDefinition, 'sections'> = {
      sections: [
        { id: 's-1', title: '', questions: [sev] },
        {
          id: 's-2',
          title: '',
          showIf: { questionId: 'q-sev', anyOf: ['Low'] },
          questions: [area],
        },
      ],
    };
    const problems = publishProblems(form, required);
    expect(problems).toEqual([
      { kind: 'required_unasked', fieldId: 'f-sev', field: 'Severity', type: 'Bug' },
      { kind: 'required_unasked', fieldId: 'f-area', field: 'Area', type: 'Bug' },
    ]);
    expect(publishProblemText(problems[0]!)).toBe(
      'Severity is required on Bug cards: add a required question that goes to it.',
    );
    expect(publishProblemText({ kind: 'no_questions' })).toBe(PUBLISH_PROBLEM_TEXT.no_questions);
    const fixed: Pick<FormDefinition, 'sections'> = {
      sections: [{ id: 's-1', title: '', questions: [{ ...sev, required: true }, area] }],
    };
    expect(publishProblems(fixed, required)).toEqual([]);
  });
});
