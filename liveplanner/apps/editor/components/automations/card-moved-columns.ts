// Card Moved's Card Types (docs/specs/026-plan/automations.md "The rule builder"): From and To list only the columns
// the picked card types use, and changing the types drops a From or To pick no picked type uses. Pure.

import { typeStatusesOf, type AutomationTrigger, type ItemTypeDef } from '@liveplanner/items';

type Column = { status: string; name: string };
type CardMoved = Extract<AutomationTrigger, { kind: 'card_moved' }>;

/** The columns the picked types use, in the plan's column order: every column when none is picked, or when every
 *  picked type is gone (a gone type shows as gone, and the rule needs attention, rather than leaving no column). */
export function cardMovedColumns<C extends Column>(
  types: readonly ItemTypeDef[],
  picked: readonly string[] | undefined,
  columns: readonly C[],
): readonly C[] {
  const live = types.filter((t) => picked?.includes(t.id));
  if (live.length === 0) return columns;
  const all = columns.map((c) => c.status);
  const used = new Set(live.flatMap((t) => typeStatusesOf(t, all)));
  return columns.filter((c) => used.has(c.status));
}

/** `trigger` with its Card Types set to `types` (none: the key left out, any type), each From and To pick the plan
 *  still has that no picked type uses dropped. A column the plan deleted stays, shown gone. */
export function withCardMovedTypes(
  trigger: CardMoved,
  types: string[],
  plan: { types: readonly ItemTypeDef[]; columns: readonly Column[] },
): CardMoved {
  const { types: _, ...rest } = trigger;
  const next: CardMoved = types.length ? { ...rest, types } : rest;
  const offered = new Set(cardMovedColumns(plan.types, types, plan.columns).map((c) => c.status));
  const known = new Set(plan.columns.map((c) => c.status));
  const keep = (s: string) => offered.has(s) || !known.has(s);
  if (next.from) next.from = next.from.filter(keep);
  if (next.to) next.to = next.to.filter(keep);
  return next;
}
