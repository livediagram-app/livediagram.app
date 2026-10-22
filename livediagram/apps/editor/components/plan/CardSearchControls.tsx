'use client';

// Card search (docs/specs/026-plan/items.md "Finding a card"): a search by number, title, description or type
// name, and field filters as chips inside the same box (Add Filter at its edge: a field, then a value with its count;
// its clear takes the words and the filters). Shared by the
// Cards panel and Setup Sheet's Plan Cards (docs/specs/029-sheets/sheet.md "Setup Sheet"), so a card is found the
// same way wherever it is looked for.
import { useState, type ReactNode } from 'react';
import {
  CARD_SEARCH_FILTERS_MAX,
  findCards,
  searchCards,
  searchFields,
  searchFilterLabel,
  searchValues,
  typeIn,
  type BoardStatusTypes,
  type CardFinderShow,
  type CardSearchFilter,
  type Item,
  type SwimlaneBy,
} from '@livediagram/items';
import { FilterSearchBox } from '@/components/primitives/FilterSearchBox';
import { AddFilterPicker } from './AddFilterPicker';
import type { PlanContextValue } from './PlanContext';

const filterKey = (f: { by: SwimlaneBy; field?: string | undefined }) =>
  f.by === 'field' ? `field:${f.field}` : f.by;

type Plan = Pick<PlanContextValue, 'items' | 'types' | 'statusNames'>;

export type CardSearch = {
  query: string;
  setQuery: (q: string) => void;
  filters: readonly CardSearchFilter[];
  setFilters: (f: readonly CardSearchFilter[]) => void;
  // The live cards the field filters keep (what counts read), and those the search then finds.
  filtered: Item[];
  found: Item[];
};

// The search's state over `live` (the live cards), narrowed to `show`.
export function useCardSearch(
  plan: Plan,
  live: readonly Item[],
  opts: { show?: CardFinderShow; boardStatuses: BoardStatusTypes },
): CardSearch {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<readonly CardSearchFilter[]>([]);
  const filtered = filters.length
    ? searchCards(live, filters, plan.types, plan.statusNames)
    : [...live];
  const found = findCards(filtered, {
    query,
    show: opts.show ?? 'all',
    boardStatuses: opts.boardStatuses,
    typeLabel: (id: string) => typeIn(plan.types, id).label,
  });
  return { query, setQuery, filters, setFilters, filtered, found };
}

export function CardSearchControls({
  plan,
  live,
  search,
  autoFocus = false,
  children,
}: {
  plan: Plan;
  live: readonly Item[];
  search: CardSearch;
  autoFocus?: boolean;
  // Drawn under the search (the Cards panel's All Cards / Not on a Board).
  children?: ReactNode;
}) {
  const { query, setQuery, filters, setFilters, found } = search;
  // What Add Filter offers: the fields the found cards have (Card Type always among them).
  const filterFields = searchFields(found, filters, plan.types);
  return (
    <>
      {/* The words and the filters as one field: the filters are chips inside the search, Add Filter at its edge. */}
      <FilterSearchBox
        autoFocus={autoFocus}
        ariaLabel="Search cards"
        placeholder="Search by #, title, description or type"
        query={query}
        onQuery={setQuery}
        onKeyDown={(e) => e.stopPropagation()}
        chips={filters.map((f) => {
          const label = searchFilterLabel(f, plan.items.values(), plan.types, plan.statusNames);
          return {
            key: `${f.by}:${f.field ?? ''}:${f.key}`,
            field: label.field,
            value: label.value,
          };
        })}
        onRemoveChip={(i) => setFilters(filters.filter((_, j) => j !== i))}
        onClear={() => {
          setQuery('');
          setFilters([]);
        }}
        addFilter={
          filters.length < CARD_SEARCH_FILTERS_MAX && filterFields.length > 0 ? (
            <AddFilterPicker
              inBox
              fields={filterFields.map((f) => ({ id: filterKey(f), label: f.label }))}
              valuesOf={(id) => {
                const f = filterFields.find((x) => filterKey(x) === id);
                return f ? searchValues(found, f, plan.types, plan.statusNames, [...live]) : [];
              }}
              onPick={(id, key) => {
                const f = filterFields.find((x) => filterKey(x) === id);
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
      {children}
    </>
  );
}
