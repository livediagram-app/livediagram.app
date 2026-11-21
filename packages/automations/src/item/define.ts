// An app's kinds (blueprint item-engine.md "Kinds"): the ones every app has, and its own. Pure.

import { sharedActions } from './actions';
import { sharedConditions } from './conditions';
import { kindsOf, type ItemKinds, type ItemKindsInput } from './kinds';
import { sharedTriggers } from './triggers';
import { sharedValues } from './values';

/** The registry an app's check, sentence, builder, agents' tools and room all read. */
export function defineItemKinds(input: ItemKindsInput): ItemKinds {
  return kindsOf(input, {
    triggers: [...sharedTriggers(input.collab), ...(input.triggers ?? [])],
    conditions: [...sharedConditions(), ...(input.conditions ?? [])],
    actions: [...sharedActions(input.tabTemplates), ...(input.actions ?? [])],
    values: [...sharedValues(input.itemWord), ...(input.values ?? [])],
  });
}
