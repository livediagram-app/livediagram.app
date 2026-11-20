// A board form's responses, read back from the project's cards (docs/specs/030-forms/forms.md "The Summary"): every
// card a response to this Form tab made (`fromForm`), oldest first, each read where its answers went. Pure.
import {
  FROM_FORM_FIELD,
  cardAnswers,
  readFromForm,
  type FormDefinition,
  type ResponseAnswers,
} from '@liveplanner/forms';
import type { Item, ItemTypeDef } from '@liveplanner/items';

export function cardResponses(
  form: FormDefinition,
  tabId: string,
  items: Iterable<Item>,
  types: readonly ItemTypeDef[],
): ResponseAnswers[] {
  const typeOf = new Map(types.map((t) => [t.id, t]));
  const rules = form.destination?.typeRules ?? [];
  const found: { number: number; answers: ResponseAnswers }[] = [];
  for (const item of items) {
    const from = readFromForm(item.fields[FROM_FORM_FIELD]);
    if (!from || from.tabId !== tabId) continue;
    // A card of a rule's type was made by that rule: its answers went where the rule maps them.
    const rule = rules.find((r) => r.typeId === item.type);
    found.push({
      number: from.number,
      answers: cardAnswers(form, item.fields, typeOf.get(item.type), rule),
    });
  }
  return found.sort((a, b) => a.number - b.number).map((r) => r.answers);
}

// Whether the Form tab offers its Summary (forms.md "The Summary", who sees it): it reads the tab the responses are
// on, so it is there for anyone who reaches that tab, whatever their role (it changes nothing), and not for a
// session through a share link to this one Form tab (`tabScope`), which does not.
export function summaryOffered(
  destTab: { id: string } | null | undefined,
  tabScope: string | null,
) {
  return !!destTab && tabScope === null;
}
