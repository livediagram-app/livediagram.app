import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@liveplanner/items';
import { effectiveTarget } from './mapping';
import { questionsOf, type FormDefinition, type FormQuestion } from './model';
import { newFieldLabel, questionsWantingFields, withQuestionFields } from './question-fields';

// Fields from a form's questions (docs/specs/030-forms/forms.md "Fields from the form's questions").

const base: ItemTypeDef = {
  id: 'intake',
  label: 'Intake',
  newTitle: 'New intake',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'description', 'status'],
};

const formOf = (questions: FormQuestion[]): FormDefinition => ({
  v: 1,
  heading: 'Intake',
  sections: [
    { id: 's-1', title: '', questions: questions.slice(0, 2) },
    { id: 's-2', title: 'More', questions: questions.slice(2) },
  ],
});

const name: FormQuestion = { id: 'q-name', type: 'short', prompt: 'Name', goesTo: { to: 'title' } };
const body: FormQuestion = { id: 'q-body', type: 'paragraph', prompt: 'What happened?' };
const notes: FormQuestion = { id: 'q-notes', type: 'paragraph', prompt: 'Anything else?' };
const team: FormQuestion = {
  id: 'q-team',
  type: 'single',
  prompt: 'Team',
  options: ['Web', 'Apps'],
  required: true,
};
const mood: FormQuestion = { id: 'q-mood', type: 'rating', prompt: 'Mood', scale: 7 };
// Mapped to a field the type lacks (the card type changed): a broken mapping, so it wants a field.
const lost: FormQuestion = {
  id: 'q-lost',
  type: 'date',
  prompt: 'Seen On',
  goesTo: { to: 'field', fieldId: 'f-gone' },
};

describe('newFieldLabel', () => {
  it('takes the prompt, made unique case aside, and Answer for a blank one', () => {
    expect(newFieldLabel('  Team ', [])).toBe('Team');
    expect(newFieldLabel('Team', ['team', 'Team 2'])).toBe('Team 3');
    expect(newFieldLabel('   ', [])).toBe('Answer');
    const long = 'A very long question prompt that runs on and on';
    expect(newFieldLabel(long, [])).toBe(long.slice(0, 32));
    expect(newFieldLabel(long, [long.slice(0, 32)])).toBe(`${long.slice(0, 28)} 2`);
  });
});

describe('questionsWantingFields', () => {
  it('skips Title, a fitting field and the first Paragraph while the type has a Description', () => {
    const type: ItemTypeDef = {
      ...base,
      fields: [...base.fields, 'f-mood'],
      custom: [{ id: 'f-mood', label: 'Mood', kind: 'rating', scale: 10 }],
    };
    const form = formOf([
      name,
      body,
      notes,
      { ...mood, goesTo: { to: 'field', fieldId: 'f-mood' } },
      lost,
    ]);
    expect(questionsWantingFields(form, type).map((q) => q.id)).toEqual(['q-notes', 'q-lost']);
  });

  it('gives every Paragraph a field when the type has no Description', () => {
    const type = { ...base, fields: ['title'] };
    expect(questionsWantingFields(formOf([body, notes]), type).map((q) => q.id)).toEqual([
      'q-body',
      'q-notes',
    ]);
  });
});

describe('withQuestionFields', () => {
  it('adds a New Field per wanting question and maps each, in form order', () => {
    const made = withQuestionFields(formOf([name, body, team, mood, lost, notes]), base)!;
    expect(made.added).toBe(4);
    expect(made.type.custom).toEqual([
      { id: 'f-team', label: 'Team', kind: 'choice', options: ['Web', 'Apps'] },
      { id: 'f-mood', label: 'Mood', kind: 'rating', scale: 7 },
      { id: 'f-seen-on', label: 'Seen On', kind: 'date' },
      { id: 'f-anything-else', label: 'Anything else?', kind: 'longtext' },
    ]);
    expect(made.type.fields).toEqual([
      ...base.fields,
      'f-team',
      'f-mood',
      'f-seen-on',
      'f-anything-else',
    ]);
    // Every answer now fits its field; Title and the body Paragraph are left as they were.
    const targets = questionsOf(made.form).map((q) => effectiveTarget(q, made.type));
    expect(targets.map((t) => (t.to === 'field' ? t.field?.label : t.to))).toEqual([
      'title',
      'description',
      'Team',
      'Mood',
      'Seen On',
      'Anything else?',
    ]);
    expect(targets.some((t) => t.broken)).toBe(false);
    // The field is never Required, whatever the question.
    expect(made.type.custom!.some((f) => f.required)).toBe(false);
  });

  it('makes a clashing label and id unique', () => {
    const type: ItemTypeDef = {
      ...base,
      fields: [...base.fields, 'f-team'],
      custom: [{ id: 'f-team', label: 'Team', kind: 'text' }],
    };
    // Unmapped, so it gets a field of its own; with Other, a Text field (New Field's rule).
    const made = withQuestionFields(formOf([{ ...team, other: true }]), type)!;
    expect(made.type.custom![1]).toEqual({ id: 'f-team-2', label: 'Team 2', kind: 'text' });
    const clash = withQuestionFields(formOf([{ ...team, options: ['Web', 'Apps', 'Ops'] }]), {
      ...type,
      custom: [{ id: 'f-team', label: 'Team', kind: 'choice', options: ['Web'] }],
    })!;
    expect(clash.type.custom![1]).toMatchObject({ id: 'f-team-2', label: 'Team 2' });
  });

  it('stops at the custom field cap, the rest left on Description', () => {
    const full = Array.from({ length: 11 }, (_, i) => ({
      id: `f-x${i}`,
      label: `X${i}`,
      kind: 'person' as const,
    }));
    const type: ItemTypeDef = {
      ...base,
      fields: [...base.fields, ...full.map((f) => f.id)],
      custom: full,
    };
    const made = withQuestionFields(formOf([team, mood]), type)!;
    expect(made.added).toBe(1);
    expect(questionsOf(made.form).map((q) => q.goesTo)).toEqual([
      { to: 'field', fieldId: 'f-team' },
      undefined,
    ]);
    const capped = { ...made.type, custom: [...made.type.custom!, ...full].slice(0, 13) };
    expect(withQuestionFields(formOf([mood]), capped)).toBeNull();
  });

  it('adds nothing when every answer has a place', () => {
    expect(withQuestionFields(formOf([name, body]), base)).toBeNull();
  });
});
