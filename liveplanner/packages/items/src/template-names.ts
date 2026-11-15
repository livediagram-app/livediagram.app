// A card template as an agent names it (docs/specs/026-plan/plan-agents.md "Card templates"): its id, else its name
// with case, spacing and punctuation aside, on the card's type. An unknown one is refused with the type's templates,
// and a template another type holds says which type, so the agent can fix the type rather than guess a name.
import type { CardTemplate } from './card-templates';
import type { ItemTypeDef } from './item-types';
import type { Named } from './plan-names';
import { statusKey } from './status-names';

const unknown = (message: string): { ok: false; code: 'template_unknown'; message: string } => ({
  ok: false,
  code: 'template_unknown',
  message,
});

// The template on `templates` that `name` names, by id or by name.
function find(templates: readonly CardTemplate[], name: string): CardTemplate | undefined {
  const key = statusKey(name);
  return (
    templates.find((t) => t.id === name) ??
    (key ? templates.find((t) => statusKey(t.name) === key) : undefined)
  );
}

// What the type has, as a refusal ends: "Templates: Bug Report, Release." or how to add one.
function hasLine(type: Pick<ItemTypeDef, 'label' | 'templates'>): string {
  const names = (type.templates ?? []).map((t) => t.name);
  return names.length
    ? `Templates: ${names.join(', ')}.`
    : `${type.label} has no templates: add one with change_card_types (addTemplates).`;
}

// `name` on `type`, else refused; `types` names another type that holds it.
export function templateOf(
  type: Pick<ItemTypeDef, 'id' | 'label' | 'templates'>,
  name: string,
  types: readonly Pick<ItemTypeDef, 'id' | 'label' | 'templates'>[] = [],
): Named<{ template: CardTemplate }> {
  const own = find(type.templates ?? [], name);
  if (own) return { ok: true, template: own };
  const holder = types.find((t) => t.id !== type.id && find(t.templates ?? [], name));
  if (holder) {
    const held = find(holder.templates ?? [], name)!;
    return unknown(
      `${held.name} is a ${holder.label} template, not a ${type.label} one: give type "${holder.label}". ${hasLine(type)}`,
    );
  }
  return unknown(`${type.label} has no template "${name}". ${hasLine(type)}`);
}
