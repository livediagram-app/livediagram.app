// A field id as the card shows it, for a refusal that names one (docs/specs/026-plan/items.md "Limits": the editor's
// toast; docs/specs/026-plan/plan-agents.md "Errors that teach": the CLI and the MCP): a custom field's label (a Long
// Text's formatting key named as its field), else the built-in's name as `type` (the change's card type) calls it.
import { typeFieldLabel } from './built-in-field-labels';
import type { ItemTypeDef } from './item-types';
import { customFieldOf } from './type-catalogue';

export function fieldNamer(
  types: readonly ItemTypeDef[],
  type: () => ItemTypeDef | undefined,
): (field: string) => string {
  return (field) => {
    const id = /^f-.+Rich$/.test(field) || field === 'descriptionRich' ? field.slice(0, -4) : field;
    const own = type();
    const custom =
      (own && customFieldOf(own, id)) ?? types.map((t) => customFieldOf(t, id)).find(Boolean);
    return custom ? custom.label : typeFieldLabel(own, id);
  };
}
