'use client';

// Edit Field's reading of the plan (docs/specs/026-plan/item-types.md "Edit Field"): which tiles a field may change
// to (and why not), what a new tile starts with (a Choice's options from the values cards hold), and what the change
// does to those values, counted from the field as the type is saved (its cards hold values of that type, however
// often the draft changed since). Each shape is counted once, by one pass over the plan's cards, and kept until the
// cards change.
import { useMemo } from 'react';
import {
  changesValues,
  fieldCardsOf,
  fieldKindChange,
  fieldValues,
  kindChangeRefusal,
  optionsFromValues,
  withArticle,
  type CustomFieldDef,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
  type KindChangeOutcome,
} from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { hasOptions, presetOf, storedKindOf, type PickKind } from './add-field-kinds';
import { countFieldFilters } from './field-retype-tabs';
import type { NewField } from './AddFieldShape';

// What a change does to the cards, said before Save: how many hold a value, and those cut down or cleared.
export type ValueLoss = {
  held: number;
  trimmed: number;
  cleared: number;
  // The line Shape shows over Save (empty: no line, only `reads`).
  message: string;
  // A built-in's type change: what in the plan stops reading it (fieldRetypeImpact, already cut to its rows shown).
  reads?: readonly string[];
  // Save asks once before saving: values are cut down or cleared, filters come off, or something stops reading it.
  asks: boolean;
};

/** The line counting the filters a type change takes off, or null with none. */
export const filtersMessage = (n: number): string | null =>
  n === 0 ? null : `${n} ${n === 1 ? 'filter' : 'filters'} on it will be removed.`;

/** Values line, then filters line, as one ValueLoss (null when neither says anything). */
export function valueLoss(
  outcome: KindChangeOutcome,
  label: string,
  filters: number,
): ValueLoss | null {
  const lines = [lossMessage(outcome, label), filtersMessage(filters)].filter(Boolean);
  if (lines.length === 0) return null;
  const { held, trimmed, cleared } = outcome;
  return {
    held,
    trimmed,
    cleared,
    message: lines.join(' '),
    asks: trimmed + cleared + filters > 0,
  };
}

// The shape of a tile, as kindChangeRefusal reads it.
export const shapeOf = (pick: PickKind) => ({ kind: storedKindOf(pick), ...presetOf(pick) });

// "a Number", "an Email", but "Several People" as it is.
const asName = (label: string) => (label.startsWith('Several') ? label : withArticle(label));

const cards = (n: number) => (n === 1 ? '1 card has' : `${n} cards have`);

/** The line saying what a change does to the values cards hold, or null when it changes none. */
export function lossMessage(outcome: KindChangeOutcome, label: string): string | null {
  const { held, trimmed, cleared } = outcome;
  if (held === 0) return null;
  const parts: string[] = [];
  if (cleared > 0) parts.push(`${cleared} can’t be kept as ${asName(label)} and will be cleared`);
  if (trimmed > 0)
    parts.push(`${trimmed} will keep only part of ${trimmed === 1 ? 'its value' : 'their values'}`);
  if (parts.length === 0) return `${cards(held)} a value; every one is kept as ${asName(label)}.`;
  return `${cards(held)} a value; ${parts.join(', and ')}.`;
}

// The settings that make a shape: two fields of the same key change the cards' values the same way.
const shapeKey = (f: NewField) =>
  JSON.stringify([
    f.kind,
    f.multiple,
    f.blocks,
    f.timeSpent,
    f.withTime,
    f.calculation,
    f.options,
    f.scale,
  ]);

export type EditFieldPlan = {
  // Why a tile can't be picked for this field, or null.
  refusalOf: (pick: PickKind) => string | null;
  // The options a Choice or Multiple Choice made from this field starts with: its cards' values.
  optionsFor: (pick: PickKind) => string[] | undefined;
  // What saving `field` does to the values (null: nothing changes, or no card holds one).
  lossOf: (field: NewField, pickLabel: string) => ValueLoss | null;
};

/**
 * Edit Field's plan for the type `typeId`'s field `stored` (as the type is saved; undefined for a field new in the
 * draft, which no card holds yet: every tile is open and nothing is lost).
 */
export function useEditFieldPlan(opts: {
  typeId: string | undefined;
  stored: CustomFieldDef | undefined;
  types: readonly ItemTypeDef[];
  items: ReadonlyMap<string, Item> | undefined;
  people: readonly ItemPerson[] | undefined;
  // The plan's tabs, read when a type is first picked (its filters on the field counted once).
  planTabs?: (() => readonly Tab[]) | undefined;
}): EditFieldPlan {
  const { typeId, stored, types, items, people, planTabs } = opts;
  return useMemo(() => {
    const on = typeId && stored ? fieldCardsOf(typeId, stored.id, types) : null;
    const all = items ? [...items.values()] : [];
    const ctx = { people: people ?? [], items };
    // Counted once per shape, until the cards change (a new `items` makes a new plan).
    const counted = new Map<string, KindChangeOutcome>();
    let options: string[] | null = null;
    let filters: number | null = null;
    const filtersOn = (field: string) =>
      (filters ??= planTabs
        ? countFieldFilters(planTabs(), [{ field, builtIn: false, typesAfter: types }])
        : 0);
    return {
      refusalOf: (pick) => (stored ? kindChangeRefusal(stored, shapeOf(pick)) : null),
      optionsFor: (pick) => {
        if (!stored || !on || !hasOptions(storedKindOf(pick))) return undefined;
        options ??= optionsFromValues(stored, fieldValues(all, on), ctx);
        return options.length ? options : undefined;
      },
      lossOf: (field, pickLabel) => {
        if (!stored || !on || !changesValues(stored, field)) return null;
        const key = shapeKey(field);
        let outcome = counted.get(key);
        if (!outcome) {
          outcome = fieldKindChange(stored, field, all, on, ctx);
          counted.set(key, outcome);
        }
        // Only a new kind's filters come off: a Choice keeping its kind with new options keeps them.
        return valueLoss(outcome, pickLabel, field.kind === stored.kind ? 0 : filtersOn(stored.id));
      },
    };
  }, [typeId, stored, types, items, people, planTabs]);
}
