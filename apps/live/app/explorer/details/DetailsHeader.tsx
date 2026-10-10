'use client';

import { ChevronDownIcon } from '@livediagram/ui';
import { DETAILS_COLUMNS, type DetailsColumnId, type DetailsSort } from './details-columns';
import { SHOWN_FROM_CLASS } from './details-cells';

// Column widths: the name takes what is left.
const WIDTH: Record<DetailsColumnId, string> = {
  name: '',
  type: 'w-28',
  comments: 'w-24',
  access: 'w-20',
  size: 'w-40',
  created: 'w-40',
  updated: 'w-40',
};

// The sortable header (docs/specs/013-workspace/explorer-details-view.md "Sorting"): every column a
// button; the sorted one carries aria-sort and an arrow.
export function DetailsHeader({
  sort,
  onSort,
}: {
  sort: DetailsSort;
  onSort: (column: DetailsColumnId) => void;
}) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
      <tr>
        {DETAILS_COLUMNS.map((c) => {
          const sorted = sort.column === c.id;
          const ascending = sort.direction === 'asc';
          return (
            <th
              key={c.id}
              scope="col"
              aria-sort={sorted ? (ascending ? 'ascending' : 'descending') : undefined}
              className={`${WIDTH[c.id]} ${SHOWN_FROM_CLASS[c.shownFrom]} px-1 py-1 font-semibold ${
                c.align === 'end' ? 'text-right' : 'text-left'
              }`}
            >
              <button
                type="button"
                onClick={() => onSort(c.id)}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 uppercase tracking-wider transition hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${
                  sorted ? 'text-slate-700 dark:text-slate-200' : ''
                }`}
              >
                {c.label}
                {sorted ? (
                  <>
                    <SortArrow ascending={ascending} />
                    <span className="sr-only">
                      {ascending ? ', sorted ascending' : ', sorted descending'}
                    </span>
                  </>
                ) : null}
              </button>
            </th>
          );
        })}
        <th scope="col" className="w-12">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}

// Down for descending; turned over for ascending.
function SortArrow({ ascending }: { ascending: boolean }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 ${ascending ? 'rotate-180' : ''}`}>
      <ChevronDownIcon />
    </span>
  );
}
