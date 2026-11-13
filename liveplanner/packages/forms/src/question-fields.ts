// Fields from a form's questions (docs/specs/030-forms/forms.md "Fields from the form's questions", blueprint §8a): the
// other way from type-questions.ts. The questions whose answer lands in Description for want of a field each get a
// custom field on the card type, made as New Field "<Prompt>" makes one, and are mapped to it. Pure: + New Card Type
// and Add Fields for Questions save the type and commit the form.
import {
  ITEM_TYPE_CUSTOM_MAX,
  newCustomFieldId,
  type CustomFieldDef,
  type ItemTypeDef,
} from '@liveplanner/items';
import { effectiveTarget, newFieldFor } from './mapping';
import { questionsOf, type FormDefinition, type FormQuestion } from './model';

// The longest label New Field gives a field, and the base kept before " 2" on a clash.
const LABEL_MAX = 32;
const LABEL_BASE_MAX = 28;

// A field label from `prompt`, unique among `taken` (case aside): "Answer" for a blank prompt, " 2", " 3" on a clash.
export function newFieldLabel(prompt: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((l) => l.toLowerCase()));
  const base = (prompt.trim() || 'Answer').slice(0, LABEL_MAX);
  let label = base;
  for (let n = 2; used.has(label.toLowerCase()); n += 1)
    label = `${base.slice(0, LABEL_BASE_MAX)} ${n}`;
  return label;
}

// The questions a field could take, in form order: each whose answer goes to Description (unmapped, or a broken
// mapping), but the first Paragraph so going while the type has a Description, which stays the card's body.
export function questionsWantingFields(
  form: Pick<FormDefinition, 'sections'>,
  type: ItemTypeDef,
): FormQuestion[] {
  let body = type.fields.includes('description');
  return questionsOf(form).filter((q) => {
    if (effectiveTarget(q, type).to !== 'description') return false;
    if (body && q.type === 'paragraph') {
      body = false;
      return false;
    }
    return true;
  });
}

// `type` with a field for each question wanting one (up to the type's custom field cap), and `form` with each such
// question mapped to its field; null when no field is added.
export function withQuestionFields(
  form: FormDefinition,
  type: ItemTypeDef,
): { form: FormDefinition; type: ItemTypeDef; added: number } | null {
  const room = ITEM_TYPE_CUSTOM_MAX - (type.custom?.length ?? 0);
  const wanting = questionsWantingFields(form, type).slice(0, Math.max(0, room));
  if (wanting.length === 0) return null;
  const custom: CustomFieldDef[] = [...(type.custom ?? [])];
  const fields = [...type.fields];
  const mapped = new Map<string, string>();
  for (const q of wanting) {
    const label = newFieldLabel(
      q.prompt,
      custom.map((f) => f.label),
    );
    const id = newCustomFieldId(label, [...fields, ...custom.map((f) => f.id)]);
    custom.push(newFieldFor(q, id, label));
    fields.push(id);
    mapped.set(q.id, id);
  }
  return {
    type: { ...type, fields, custom },
    form: {
      ...form,
      sections: form.sections.map((s) => ({
        ...s,
        questions: s.questions.map((q) => {
          const fieldId = mapped.get(q.id);
          return fieldId ? { ...q, goesTo: { to: 'field' as const, fieldId } } : q;
        }),
      })),
    },
    added: wanting.length,
  };
}
