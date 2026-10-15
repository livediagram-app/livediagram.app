// Mapping (docs/specs/030-forms/forms.md "Mapping: where an answer goes", blueprint §5): which card fields a
// question's answer may be kept in, and where it goes when its field is gone.
import {
  ratingScaleOf,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemTypeDef,
} from '@livediagram/items';
import { RATING_SCALE_DEFAULT } from './limits';
import type { AnswerTarget, FormDefinition, FormQuestion, QuestionType } from './model';
import { questionsOf } from './model';

// The field kinds each question type may be kept in, best first.
export const MAPPABLE_KINDS: Readonly<Record<QuestionType, readonly CustomFieldKind[]>> = {
  short: ['text', 'longtext'],
  paragraph: ['longtext'],
  number: ['number', 'currency'],
  email: ['email', 'text'],
  link: ['link', 'text'],
  date: ['date'],
  single: ['choice', 'text'],
  multi: ['multichoice', 'longtext'],
  rating: ['rating', 'number'],
  checkbox: ['checkbox'],
};

// The question types whose answer may be a card's title.
export const TITLE_TYPES: readonly QuestionType[] = ['short', 'email', 'number', 'single', 'date'];

// The kind of field New Field makes for a question.
export const NEW_FIELD_KIND: Readonly<Record<QuestionType, CustomFieldKind>> = {
  short: 'text',
  paragraph: 'longtext',
  number: 'number',
  email: 'email',
  link: 'link',
  date: 'date',
  single: 'choice',
  multi: 'multichoice',
  rating: 'rating',
  checkbox: 'checkbox',
};

// Whether `field` can keep `q`'s answer: its kind takes the type, a Rating's scale reaches the question's, and a
// choice field holds every option the question offers (an Other answer would not be one: it is refused).
export function fieldTakes(q: FormQuestion, field: CustomFieldDef): boolean {
  if (!MAPPABLE_KINDS[q.type].includes(field.kind)) return false;
  if (field.kind === 'rating') return ratingScaleOf(field) >= (q.scale ?? RATING_SCALE_DEFAULT);
  if (field.kind === 'choice' || field.kind === 'multichoice') {
    if (q.other) return false;
    const options = new Set((field.options ?? []).map((o) => o.toLowerCase()));
    return (q.options ?? []).every((o) => options.has(o.toLowerCase()));
  }
  return true;
}

export const canGoToTitle = (q: FormQuestion) => TITLE_TYPES.includes(q.type);

export type ResolvedTarget = AnswerTarget & { broken?: true; field?: CustomFieldDef };

// Where `q`'s answer goes on a card of `type`: its `goesTo` while that still resolves, else Description, marked
// broken when it was meant to go elsewhere (the builder says so).
export function effectiveTarget(q: FormQuestion, type: ItemTypeDef | undefined): ResolvedTarget {
  const t = q.goesTo;
  if (!t || t.to === 'description') return { to: 'description' };
  if (t.to === 'title') return canGoToTitle(q) ? t : { to: 'description', broken: true };
  const field = type?.custom?.find((f) => f.id === t.fieldId);
  if (!field || !type!.fields.includes(field.id) || !fieldTakes(q, field))
    return { to: 'description', broken: true };
  return { ...t, field };
}

// The fields of `type` a question could map to, each with the question already using it (if another does).
export function fieldChoices(
  form: Pick<FormDefinition, 'sections'>,
  q: FormQuestion,
  type: ItemTypeDef | undefined,
): { field: CustomFieldDef; takenBy?: FormQuestion }[] {
  const others = questionsOf(form).filter((o) => o.id !== q.id);
  return (type?.custom ?? [])
    .filter((f) => type!.fields.includes(f.id) && fieldTakes(q, f))
    .map((field) => {
      const takenBy = others.find((o) => o.goesTo?.to === 'field' && o.goesTo.fieldId === field.id);
      return takenBy ? { field, takenBy } : { field };
    });
}

// The question already going to Title, other than `q`.
export function titleTakenBy(
  form: Pick<FormDefinition, 'sections'>,
  q?: FormQuestion,
): FormQuestion | undefined {
  return questionsOf(form).find((o) => o.id !== q?.id && o.goesTo?.to === 'title');
}

// The new field New Field "<Prompt>" makes for `q` (its id given by the caller, unique on the type).
export function newFieldFor(q: FormQuestion, id: string, label: string): CustomFieldDef {
  const kind = NEW_FIELD_KIND[q.type];
  const field: CustomFieldDef = { id, label, kind };
  if (kind === 'choice' || kind === 'multichoice')
    return { ...field, options: [...(q.options ?? [])] };
  if (kind === 'rating' && (q.scale ?? RATING_SCALE_DEFAULT) !== RATING_SCALE_DEFAULT)
    return { ...field, scale: q.scale };
  return field;
}
