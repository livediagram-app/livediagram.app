// Starting a card from a card template (docs/specs/026-plan/item-types.md "Where a card is added, its templates are
// offered"): the Add a Card menu's choices (each type, then its templates), the new card a choice makes, and the quiet
// line under a template's name. Pure, so the menu, the chips and New {Type} share one reading.
import {
  cardTemplateFields,
  isRichFieldKey,
  typeFieldLabel,
  type CardTemplate,
  type ItemFields,
  type ItemTypeDef,
} from '@liveplanner/items';

// What Add a Card hands its caller: the type, the fields the card starts with (its place's are set over them) and the
// template it was started from, if any.
export type NewCard = { type: string; fields: ItemFields; template?: string };

// One row of the Add a Card menu: a type (a blank card) or one of its templates.
export type AddCardChoice = { id: string; type: ItemTypeDef; template?: CardTemplate };

// A template row's id: its type's and its own, `::` never occurring in either.
const choiceId = (type: ItemTypeDef, template: CardTemplate) => `${type.id}::${template.id}`;

export const hasTemplates = (type: Pick<ItemTypeDef, 'templates'>): boolean =>
  (type.templates?.length ?? 0) > 0;

// Each type in order, its templates straight after it.
export function addCardChoices(types: readonly ItemTypeDef[]): AddCardChoice[] {
  const out: AddCardChoice[] = [];
  for (const type of types) {
    out.push({ id: type.id, type });
    for (const template of type.templates ?? [])
      out.push({ id: choiceId(type, template), type, template });
  }
  return out;
}

// The card a choice adds: the type's new-card title, under the template's values for the fields its type offers.
export function newCardOf(type: ItemTypeDef, template?: CardTemplate): NewCard {
  if (!template) return { type: type.id, fields: { title: type.newTitle } };
  return {
    type: type.id,
    fields: { title: type.newTitle, ...cardTemplateFields(type, template) },
    template: template.id,
  };
}

// The fields a template fills, once each and in the type's order, by the names its cards show ("Title, Description,
// Checklist"), or "Starts blank".
export function templateSummary(type: ItemTypeDef, template: CardTemplate): string {
  const filled = new Set(
    Object.keys(cardTemplateFields(type, template)).map((k) =>
      isRichFieldKey(k) ? k.slice(0, -'Rich'.length) : k,
    ),
  );
  const names = type.fields
    .filter((f) => filled.has(f))
    .map((f) => type.custom?.find((c) => c.id === f)?.label ?? typeFieldLabel(type, f));
  return names.length ? names.join(', ') : 'Starts blank';
}
