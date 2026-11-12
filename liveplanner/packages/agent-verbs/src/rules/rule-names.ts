// A rule body as an agent writes it, named as the board shows things (docs/specs/026-plan/automations.md "Agents and
// the CLI", "The rule body"): items' namedRuleBody over the plan and the rules list this call read.
import { namedRuleBody as named } from '@liveplanner/items';
import type { RulesState } from './rule-state';

/** `body` with what it names by name put back to the plan's ids; a copy, the input untouched. */
export function namedRuleBody<T>(body: T, state: RulesState): T {
  return named(body, {
    statuses: state.plan.statuses,
    types: state.plan.types,
    people: state.list.people ?? [],
    tabs: state.plan.tabs ?? [],
  });
}
