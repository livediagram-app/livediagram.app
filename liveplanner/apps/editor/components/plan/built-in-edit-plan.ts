'use client';

// Edit Field's reading of the plan for a built-in field (docs/specs/026-plan/item-types.md "Edit Field": Built-in
// fields): the tile it opens on, which tiles it may become (and why not), and, for another tile, what moving its values
// to a new custom field does (held, cut down, cleared), how many filters come off, and what in the plan stops reading
// it. Each shape is counted once, by one pass over the plan's cards; the tabs are scanned once, on the first other
// tile picked, never on a render before that.
import { useMemo } from 'react';
import {
  BUILT_IN_KIND_SHAPES,
  builtInCardsOf,
  builtInReader,
  builtInRetypePatches,
  builtInRetypeRefusal,
  fieldRetypeImpact,
  fieldValues,
  impactShown,
  optionsFromValues,
  typeFieldLabel,
  type Item,
  type ItemFieldId,
  type ItemPerson,
  type ItemTypeDef,
  type KindChangeOutcome,
} from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { hasOptions, pickOf, storedKindOf } from './add-field-kinds';
import type { NewField } from './AddFieldShape';
import { lossMessage, filtersMessage, shapeOf, type EditFieldPlan } from './edit-field-values';
import { countFieldFilters, planSurfaces } from './field-retype-tabs';

const NOTHING_READS = 'Nothing else in the plan reads it.';

/** A built-in as Edit Field opens it: the type's name for it, on its own tile (Assignee's Notifies as a Person's). */
export function builtInStartField(
  id: ItemFieldId,
  name: string,
  assigneeNotifies: boolean,
): NewField {
  const shape = BUILT_IN_KIND_SHAPES[id] ?? { kind: 'text' as const };
  return {
    label: name,
    ...shape,
    ...(shape.options ? { options: [...shape.options] } : {}),
    ...(id === 'assignee' && assigneeNotifies ? { notifies: true } : {}),
  };
}

/** Whether `field` is on the built-in's own tile (a rename), not another type. */
export const onOwnTile = (id: ItemFieldId, field: NewField): boolean => {
  const shape = BUILT_IN_KIND_SHAPES[id];
  return !!shape && pickOf(field) === pickOf(shape);
};

// The settings that make a shape, as Edit Field counts them.
const shapeKey = (f: NewField) => JSON.stringify([pickOf(f), f.options, f.scale]);

/**
 * Edit Field's plan for the built-in `id` on the type `typeId` (undefined for a new type: no card holds it, nothing
 * reads it). The catalogue is as stored.
 */
export function useBuiltInEditPlan(opts: {
  id: ItemFieldId;
  typeId: string | undefined;
  types: readonly ItemTypeDef[];
  items: ReadonlyMap<string, Item> | undefined;
  people: readonly ItemPerson[] | undefined;
  planTabs: (() => readonly Tab[]) | undefined;
}): EditFieldPlan {
  const { id, typeId, types, items, people, planTabs } = opts;
  return useMemo(() => {
    const own = BUILT_IN_KIND_SHAPES[id];
    const ownPick = own ? pickOf(own) : undefined;
    const stored = typeId ? types.find((t) => t.id === typeId) : undefined;
    const on = stored?.fields.includes(id) ? builtInCardsOf(stored.id, id, types) : null;
    const all = items ? [...items.values()] : [];
    const ctx = { people: people ?? [], items };
    const counted = new Map<string, KindChangeOutcome>();
    // The tabs' part, read once: its filters on the field and what stops reading it.
    const memo: { scanned?: { filters: number; reads: string[] } } = {};
    const scan = () => {
      if (memo.scanned) return memo.scanned;
      if (!stored || !planTabs) return (memo.scanned = { filters: 0, reads: [] });
      const tabs = planTabs();
      // The catalogue once saved: this type without the built-in.
      const typesAfter = types.map((t) =>
        t.id === stored.id ? { ...t, fields: t.fields.filter((f) => f !== id) } : t,
      );
      const filters = countFieldFilters(tabs, [{ field: id, builtIn: true, typesAfter }]);
      const reads = fieldRetypeImpact({
        field: id,
        name: typeFieldLabel(stored, id),
        typeId: stored.id,
        ...planSurfaces(tabs),
        types,
      });
      return (memo.scanned = { filters, reads });
    };
    return {
      refusalOf: (pick) => (pick === ownPick ? null : builtInRetypeRefusal(id, shapeOf(pick))),
      optionsFor: (pick) => {
        if (!on || !hasOptions(storedKindOf(pick))) return undefined;
        if (own?.options?.length) return [...own.options];
        const options = optionsFromValues(
          own ?? { kind: 'text' },
          fieldValues(all, on, builtInReader(id)),
          ctx,
        );
        return options.length ? options : undefined;
      },
      lossOf: (field: NewField, pickLabel: string) => {
        if (onOwnTile(id, field)) return null;
        const key = shapeKey(field);
        let outcome = counted.get(key);
        if (!outcome) {
          outcome = on
            ? builtInRetypePatches(id, field, id, all, on, ctx)
            : { held: 0, trimmed: 0, cleared: 0, patches: [] };
          counted.set(key, outcome);
        }
        const { filters, reads } = scan();
        const lines = [lossMessage(outcome, pickLabel), filtersMessage(filters)].filter(Boolean);
        return {
          held: outcome.held,
          trimmed: outcome.trimmed,
          cleared: outcome.cleared,
          message: lines.join(' '),
          reads: reads.length ? impactShown(reads) : [NOTHING_READS],
          // Another type always asks: the built-in comes off this type.
          asks: true,
        };
      },
    };
  }, [id, typeId, types, items, people, planTabs]);
}
