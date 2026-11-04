// Filters on a field whose type changed (docs/specs/026-plan/item-types.md "Edit Field": Filters on the field): a
// filter keeps a value written for the old type and could match nothing without saying so, so the change takes it
// off. A board's saved filters and a view's filters are stored; a quick filter is each person's own and is left. A
// custom field's filters always come off; a built-in's only where no type that place covers holds it any more.
// Pure: the editor walks its tabs with these (field-retype-tabs.ts).
import { boardAddTypes, type PlanBoardSetup } from './board';
import type { CardSearchFilter } from './card-search';
import type { ItemTypeDef } from './item-types';
import type { SavedBoardFilter } from './saved-filters';

export interface FieldRetypeTarget {
  // The field whose type changes, by id.
  field: string;
  // A built-in field (it stays on the types that keep it).
  builtIn: boolean;
  // The catalogue once the change is made.
  typesAfter: readonly ItemTypeDef[];
}

// The grouping a built-in field is filtered by, beside `by: 'field'`.
const BUILT_IN_GROUPING: Readonly<Record<string, CardSearchFilter['by']>> = {
  assignee: 'assignee',
  priority: 'priority',
};

/** Whether a filter clause names the field (by its id, or a built-in by its own grouping). */
export function clauseNamesField(clause: CardSearchFilter, field: string): boolean {
  if (clause.by === 'field') return clause.field === field;
  return BUILT_IN_GROUPING[field] === clause.by;
}

// Whether the field's filters come off a place covering `types`: a custom field's always; a built-in's when none
// of them holds it any more.
const comesOff = (target: FieldRetypeTarget, types: readonly ItemTypeDef[]) =>
  !target.builtIn || !types.some((t) => t.fields.includes(target.field));

// A saved filter left with nothing to narrow by.
function isEmptySavedFilter(f: SavedBoardFilter): boolean {
  return (
    !f.text?.trim() &&
    !f.mine &&
    !f.filters?.length &&
    f.person === undefined &&
    f.type === undefined &&
    f.priority === undefined &&
    f.due === undefined
  );
}

// One saved filter without the field's clauses (its chips, and the Assignee's person, the Priority's priority and
// the Due Date's window), and how many came off.
function savedWithout(
  f: SavedBoardFilter,
  field: string,
): { next: SavedBoardFilter; removed: number } {
  let removed = 0;
  let next = f;
  if (f.filters?.some((c) => clauseNamesField(c, field))) {
    const kept = f.filters.filter((c) => !clauseNamesField(c, field));
    removed += f.filters.length - kept.length;
    const { filters: _gone, ...rest } = next;
    next = kept.length ? { ...rest, filters: kept } : rest;
  }
  const key =
    field === 'assignee'
      ? 'person'
      : field === 'priority'
        ? 'priority'
        : field === 'due'
          ? 'due'
          : null;
  if (key && next[key] !== undefined) {
    const { [key]: _gone, ...rest } = next;
    next = rest;
    removed += 1;
  }
  return { next, removed };
}

/** A board's set-up with the field's saved filter clauses off (a saved filter left empty removed whole). */
export function boardWithoutFieldFilters(
  setup: PlanBoardSetup,
  target: FieldRetypeTarget,
): { setup: PlanBoardSetup; removed: number } {
  const saved = setup.savedFilters;
  if (!saved?.length || !comesOff(target, boardAddTypes(setup, target.typesAfter)))
    return { setup, removed: 0 };
  let removed = 0;
  const kept: SavedBoardFilter[] = [];
  for (const f of saved) {
    const out = savedWithout(f, target.field);
    removed += out.removed;
    if (!out.removed || !isEmptySavedFilter(out.next)) kept.push(out.next);
  }
  if (!removed) return { setup, removed: 0 };
  const { savedFilters: _gone, ...rest } = setup;
  return { setup: kept.length ? { ...rest, savedFilters: kept } : rest, removed };
}

/** A view's settings with the field's filters off (`filters` absent when none is left). */
export function viewWithoutFieldFilters<
  T extends { filters?: CardSearchFilter[]; types?: string[] },
>(settings: T, target: FieldRetypeTarget): { settings: T; removed: number } {
  const filters = settings.filters;
  if (!filters?.some((c) => clauseNamesField(c, target.field))) return { settings, removed: 0 };
  const shown = settings.types?.length
    ? target.typesAfter.filter((t) => settings.types!.includes(t.id))
    : target.typesAfter;
  if (!comesOff(target, shown)) return { settings, removed: 0 };
  const kept = filters.filter((c) => !clauseNamesField(c, target.field));
  const { filters: _gone, ...rest } = settings;
  return {
    settings: (kept.length ? { ...rest, filters: kept } : rest) as T,
    removed: filters.length - kept.length,
  };
}
