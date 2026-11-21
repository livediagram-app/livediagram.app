// A rule body as an agent writes it (liveworkspace/docs/specs/018-automations/automations.md "Agents"): a tab or a
// person may be named by its id or by its name, as list_rules lists them; the body sent to the api names them by id.
// A name the item lacks is kept as written, so the rule saves and list_rules says it needs attention. Pure.
import { mapRefs } from '@liveworkspace/automations/item';
import { findNamed } from './rule-listing';
import type { ItemRulesList } from './rule-state';

/** `body` with every tab and person it names by name put back to the item's ids; a copy, the input untouched. */
export function namedRuleBody<T>(body: T, list: Pick<ItemRulesList, 'tabs' | 'people'>): T {
  const tabs = list.tabs ?? [];
  const people = list.people ?? [];
  return mapRefs(body, (ref) => {
    if (ref.kind === 'tab') return findNamed(ref.id, tabs)?.id ?? ref.id;
    if (ref.kind === 'person') return findNamed(ref.id, people)?.id ?? ref.id;
    return ref.id;
  });
}
