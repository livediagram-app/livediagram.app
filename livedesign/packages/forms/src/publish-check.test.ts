import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@livedesign/items';
import { PUBLISH_PROBLEM_TEXT, publishProblems } from './publish-check';
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
    expect(Object.keys(PUBLISH_PROBLEM_TEXT)).toHaveLength(5);
  });
});
