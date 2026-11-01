'use client';

// The board's Filter widget field (docs/specs/026-plan/board-widgets.md "The Filter widget"): the words and the field
// chips as one search, Find a Card's and Card Search's, in its compact header form and the board's own colours. Add
// Filter lists the fields the board's shown cards offer, then a field's values with their counts among those cards.
import { useMemo } from 'react';
import {
  CARD_SEARCH_FILTERS_MAX,
  searchFields,
  searchFilterLabel,
  searchValues,
  type BoardProjection,
  type CardSearchFilter,
  type Item,
  type ItemTypeDef,
  type QuickFilter,
  type SwimlaneBy,
} from '@liveplanner/items';
import { boardItems } from '@liveplanner/plan-art';
import { FilterSearchBox } from '@liveworkspace/workbench/components/primitives/FilterSearchBox';
import { AddFilterPicker } from '../AddFilterPicker';
import type { PlanPalette } from '../plan-palette';

const filterKey = (f: { by: SwimlaneBy; field?: string | undefined }) =>
  f.by === 'field' ? `field:${f.field}` : f.by;

const NO_FILTERS: readonly CardSearchFilter[] = [];

export function BoardFilterField({
  projection,
  planItems,
  types,
  statusNames,
  palette,
  quick,
  onQuick,
}: {
  // The board as drawn, under every narrowing: what Add Filter offers and counts.
  projection: BoardProjection;
  // Every card of the plan, for a chip's name and a value's count.
  planItems: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusNames?: ReadonlyMap<string, string> | undefined;
  palette: PlanPalette;
  quick: QuickFilter;
  onQuick: (q: QuickFilter) => void;
}) {
  const filters = quick.filters ?? NO_FILTERS;
  const shown = useMemo(() => boardItems(projection), [projection]);
  const fields = useMemo(() => searchFields(shown, filters, types), [shown, filters, types]);
  const chips = useMemo(
    () =>
      filters.map((f) => {
        const label = searchFilterLabel(f, planItems.values(), types, statusNames);
        return { key: `${f.by}:${f.field ?? ''}:${f.key}`, field: label.field, value: label.value };
      }),
    [filters, planItems, types, statusNames],
  );
  const setFilters = (next: readonly CardSearchFilter[]) => {
    const q: QuickFilter = { ...quick };
    if (next.length) q.filters = [...next];
    else delete q.filters;
    onQuick(q);
  };
  return (
    <span className="flex w-72 min-w-0 shrink-0 items-center">
      <FilterSearchBox
        compact
        tone={{
          border: palette.border,
          text: palette.text,
          muted: palette.muted,
          focus: palette.focus,
        }}
        ariaLabel="Filter this board"
        placeholder="Filter cards"
        chipsPlaceholder="Filter these…"
        clearLabel="Clear Filter"
        query={quick.text ?? ''}
        onQuery={(text) => {
          const q: QuickFilter = { ...quick };
          if (text) q.text = text;
          else delete q.text;
          onQuick(q);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        chips={chips}
        onRemoveChip={(i) => setFilters(filters.filter((_, j) => j !== i))}
        onClear={() => {
          const q: QuickFilter = { ...quick };
          delete q.text;
          delete q.filters;
          onQuick(q);
        }}
        addFilter={
          filters.length < CARD_SEARCH_FILTERS_MAX && fields.length > 0 ? (
            <AddFilterPicker
              inBox
              fields={fields.map((f) => ({ id: filterKey(f), label: f.label }))}
              valuesOf={(id) => {
                const f = fields.find((x) => filterKey(x) === id);
                return f ? searchValues(shown, f, types, statusNames, planItems.values()) : [];
              }}
              onPick={(id, key) => {
                const f = fields.find((x) => filterKey(x) === id);
                if (f)
                  setFilters([
                    ...filters,
                    { by: f.by, ...(f.field ? { field: f.field } : {}), key },
                  ]);
              }}
            />
          ) : null
        }
      />
    </span>
  );
}
