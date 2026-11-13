// Questions from a card type's fields (docs/specs/030-forms/forms.md "Questions from the card type's fields",
// blueprint §8a): the fields a respondent can fill, each as a question already mapped to it. Pure: the builder adds
// them when a card type is picked on an empty form, or on Add Questions for {Type}'s Fields.
import {
  RISK_OPTIONS,
  isNewerField,
  isTimedRange,
  ratingScaleOf,
  typeFieldLabel,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemTypeDef,
} from '@liveplanner/items';
import { PROMPT_MAX, QUESTIONS_MAX, RATING_SCALE_MAX, RATING_SCALE_MIN } from './limits';
import { effectiveTarget, titleTakenBy } from './mapping';
import { questionsOf, type FormDefinition, type FormQuestion, type QuestionType } from './model';
import { readOptions } from './read';

// The question each custom kind becomes; a kind missing here is one a respondent cannot sensibly fill (Person,
// Labels, Colour, Checklist, Image, Comments, Votes, Percent, Duration, Link to Card, Calculated).
export const TYPE_QUESTION_KINDS: Partial<Record<CustomFieldKind, QuestionType>> = {
  text: 'short',
  longtext: 'paragraph',
  number: 'number',
  currency: 'number',
  email: 'email',
  phone: 'phone',
  link: 'link',
  date: 'date',
  datetime: 'datetime',
  daterange: 'daterange',
  choice: 'single',
  // A Choice question of the four levels, in order (docs/specs/026-plan/item-types.md "Risk").
  risk: 'single',
  multichoice: 'multi',
  rating: 'rating',
  checkbox: 'checkbox',
};

export type TypeQuestionField =
  { kind: 'title' } | { kind: 'description' } | { kind: 'field'; field: CustomFieldDef };

// The fields of `type` a form can ask for, in order: Title, Description (when the type has it), then each custom
// field of a kind in the table, in the type's field order.
export function typeQuestionFields(type: ItemTypeDef): TypeQuestionField[] {
  const out: TypeQuestionField[] = [{ kind: 'title' }];
  if (type.fields.includes('description')) out.push({ kind: 'description' });
  for (const id of type.fields) {
    const field = type.custom?.find((f) => f.id === id);
    if (!field || isNewerField(field) || !TYPE_QUESTION_KINDS[field.kind]) continue;
    out.push({ kind: 'field', field });
  }
  return out;
}

// The question a field becomes (its id given by the caller), mapped to it: its kind, options, scale and Include Time
// are the field's, so the mapping always fits (fieldTakes).
export function questionFromField(
  f: TypeQuestionField,
  type: ItemTypeDef,
  id: string,
): FormQuestion {
  if (f.kind === 'title')
    return { id, type: 'short', prompt: typeFieldLabel(type, 'title'), goesTo: { to: 'title' } };
  if (f.kind === 'description')
    return { id, type: 'paragraph', prompt: typeFieldLabel(type, 'description') };
  const { field } = f;
  const qType = TYPE_QUESTION_KINDS[field.kind]!;
  const q: FormQuestion = {
    id,
    type: qType,
    prompt: field.label.trim().slice(0, PROMPT_MAX),
    goesTo: { to: 'field', fieldId: field.id },
  };
  if (field.required) q.required = true;
  if (qType === 'single' || qType === 'multi')
    q.options = readOptions(field.kind === 'risk' ? RISK_OPTIONS : field.options);
  if (qType === 'rating') {
    q.scale = Math.min(RATING_SCALE_MAX, Math.max(RATING_SCALE_MIN, ratingScaleOf(field)));
    q.style = 'stars';
  }
  if (qType === 'daterange' && isTimedRange(field)) q.withTime = true;
  return q;
}

// The fields no question asks yet: Title while none goes to Title, Description while no answer lands there, and each
// custom field no question reaches and the destination does not set automatically.
export function typeQuestionsToAdd(
  form: Pick<FormDefinition, 'sections' | 'destination'>,
  type: ItemTypeDef,
): TypeQuestionField[] {
  const questions = questionsOf(form);
  const targets = questions.map((q) => effectiveTarget(q, type));
  const fixed = form.destination?.fixed ?? {};
  return typeQuestionFields(type).filter((f) => {
    if (f.kind === 'title') return !titleTakenBy(form);
    if (f.kind === 'description') return !targets.some((t) => t.to === 'description');
    if (Object.prototype.hasOwnProperty.call(fixed, f.field.id)) return false;
    return !targets.some((t) => t.to === 'field' && t.fieldId === f.field.id);
  });
}

// `form` with a question for each field no question asks yet, at the end of its last section (within QUESTIONS_MAX);
// the same form when there is none to add.
export function withTypeQuestions(
  form: FormDefinition,
  type: ItemTypeDef,
  newId: () => string,
): FormDefinition {
  const room = QUESTIONS_MAX - questionsOf(form).length;
  const made = typeQuestionsToAdd(form, type)
    .slice(0, Math.max(0, room))
    .map((f) => questionFromField(f, type, newId()));
  if (made.length === 0) return form;
  const last = form.sections.length - 1;
  return {
    ...form,
    sections: form.sections.map((s, i) =>
      i === last ? { ...s, questions: [...s.questions, ...made] } : s,
    ),
  };
}
