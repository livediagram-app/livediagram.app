'use client';

import { ChevronDownIcon } from '@livediagram/ui';
import { DETAILS_COLUMNS, type DetailsColumnId, type DetailsSort } from './details-columns';
import { Tooltip } from '@livediagram/ui';
import { HEADER_ICON, SHOWN_FROM_CLASS } from './details-cells';

// Column widths: the name takes what is left.
const WIDTH: Record<DetailsColumnId, string> = {
  name: '',
  type: 'w-10',
  comments: 'w-12',
  access: 'w-10',
  size: 'w-40',
  created: 'w-40',
  updated: 'w-40',
};

const ALIGN = { start: 'text-left', center: 'text-center', end: 'text-right' } as const;

// An icon column's header names itself in a tooltip; a worded one needs none.
function HeaderButton({
  label,
  iconOnly,
  children,
}: {
  label: string;
  iconOnly: boolean;
  children: React.ReactElement;
}) {
  return iconOnly ? <Tooltip label={label}>{children}</Tooltip> : children;
}

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
          const HeaderIcon = c.iconOnly ? HEADER_ICON[c.id] : undefined;
          const ascending = sort.direction === 'asc';
          return (
            <th
              key={c.id}
              scope="col"
              aria-sort={sorted ? (ascending ? 'ascending' : 'descending') : undefined}
              className={`${WIDTH[c.id]} ${SHOWN_FROM_CLASS[c.shownFrom]} px-1 py-1 font-semibold ${ALIGN[c.align]}`}
            >
              <HeaderButton label={c.label} iconOnly={c.iconOnly}>
                <button
                  type="button"
                  onClick={() => onSort(c.id)}
                  className={`inline-flex items-center gap-1 rounded ${c.iconOnly ? 'px-1' : 'px-2'} py-1 uppercase tracking-wider transition hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${
                    sorted ? 'text-slate-700 dark:text-slate-200' : ''
                  }`}
                >
                  {HeaderIcon ? (
                    <>
                      <HeaderIcon />
                      <span className="sr-only">{c.label}</span>
                    </>
                  ) : (
                    c.label
                  )}
                  {sorted ? (
                    <>
                      <SortArrow ascending={ascending} />
                      <span className="sr-only">
                        {ascending ? ', sorted ascending' : ', sorted descending'}
                      </span>
                    </>
                  ) : null}
                </button>
              </HeaderButton>
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
