// What a response makes (docs/specs/030-forms/forms.md "What a response makes", blueprint §6): one card's type and
// fields from a checked response. Pure, so the api makes it and the builder's Preview can show what would be made.
import {
  DESCRIPTION_RICH_FIELD,
  ITEM_DESCRIPTION_MAX,
  ITEM_TITLE_MAX,
  ratingScaleOf,
  type CustomFieldDef,
  type ItemFields,
  type ItemFieldValue,
  type ItemTypeDef,
} from '@livedesign/items';
import type { AnswerValue } from './answers';
import { effectiveTarget } from './mapping';
import { promptOf, questionsOf, type FormDefinition, type FormQuestion } from './model';
import { RATING_SCALE_DEFAULT } from './limits';

// The field a response's card carries, naming its form: `<form tab id>:<response number>`. A plain string, so the
// item store keeps it as any unknown field, and no card face draws it.
export const FROM_FORM_FIELD = 'fromForm';

export function fromFormValue(tabId: string, number: number): string {
  return `${tabId}:${number}`;
}

export function readFromForm(v: unknown): { tabId: string; number: number } | null {
  if (typeof v !== 'string') return null;
  const at = v.lastIndexOf(':');
  const number = Number(v.slice(at + 1));
  if (at < 1 || !Number.isInteger(number) || number < 1) return null;
  return { tabId: v.slice(0, at), number };
}

// An answer as text, as a card's Description and a Text field keep it.
export function answerText(q: FormQuestion, value: AnswerValue): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (q.type === 'rating') return `${value} / ${q.scale ?? RATING_SCALE_DEFAULT}`;
  return String(value);
}

// The title a card takes when no question goes to Title: the form's heading and the response number.
export const numberedTitle = (heading: string, number: number) =>
  `${heading} #${number}`.slice(0, ITEM_TITLE_MAX);

// `value` as `field` keeps it.
function fieldValue(q: FormQuestion, value: AnswerValue, field: CustomFieldDef): ItemFieldValue {
  switch (field.kind) {
    case 'currency':
      return Math.round((value as number) * 100) / 100;
    case 'longtext':
      return Array.isArray(value) ? value.join('\n') : answerText(q, value);
    case 'text':
      return answerText(q, value);
    case 'rating':
      return Math.min(value as number, ratingScaleOf(field));
    default:
      return value;
  }
}

// What a Preview's card is marked with (docs/specs/030-forms/forms.md "Preview"), before its title.
const PREVIEW_TITLE_PREFIX = 'Preview: ';

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

interface ResponseCard {
  type: string;
  fields: ItemFields;
}

// The card a response makes: the destination's type and status, the mapped answers in their fields, the rest in
// Description under their prompts (in form order; unanswered questions left out). A Preview's card (`preview`) is
// made the same way, titled "Preview: …" (its title answer, else the form's heading). `number` is the response number
// it takes; null (a preview of a form with no link to count it) marks it as no response.
export function responseCard(
  form: FormDefinition,
  tabId: string,
  answers: ReadonlyMap<string, AnswerValue>,
  type: ItemTypeDef,
  number: number | null,
  preview = false,
): ResponseCard {
  const fields: ItemFields = {};
  let title: string | undefined;
  let plain = '';
  const runs: { text: string; bold?: true }[] = [];
  for (const q of questionsOf(form)) {
    const value = answers.get(q.id);
    if (value === undefined) continue;
    const target = effectiveTarget(q, type);
    if (target.to === 'title') {
      title = answerText(q, value);
    } else if (target.to === 'field' && target.field) {
      fields[target.field.id] = fieldValue(q, value, target.field);
    } else {
      const block = `${plain ? '\n\n' : ''}`;
      const prompt = promptOf(q);
      const text = answerText(q, value);
      if (block) runs.push({ text: block });
      runs.push({ text: prompt, bold: true });
      runs.push({ text: `\n${text}` });
      plain += `${block}${prompt}\n${text}`;
    }
  }
  const answered = title?.trim();
  fields['title'] = cut(
    preview
      ? `${PREVIEW_TITLE_PREFIX}${answered || form.heading}`
      : answered || (number === null ? form.heading : numberedTitle(form.heading, number)),
    ITEM_TITLE_MAX,
  );
  if (plain) {
    if (plain.length <= ITEM_DESCRIPTION_MAX) {
      fields['description'] = plain;
      fields[DESCRIPTION_RICH_FIELD] = runs;
    } else {
      // Too long to keep whole: the plain text alone, cut.
      fields['description'] = cut(plain, ITEM_DESCRIPTION_MAX);
    }
  }
  if (form.destination) fields['status'] = form.destination.status;
  if (number !== null) fields[FROM_FORM_FIELD] = fromFormValue(tabId, number);
  return { type: type.id, fields };
}
