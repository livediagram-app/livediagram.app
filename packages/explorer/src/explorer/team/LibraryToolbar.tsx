'use client';

// A team's Library tab toolbar, left side (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): All
// and a chip for each kind the library holds, with how many, writing the lens's Opens in (`opens-in:plan`) so the
// address, the Filter field and the list agree; and Sort (Last Changed or Name), kept on this device.

import { useState } from 'react';
import type { Kind } from '@liveworkspace/index-client';
import { setDimensionValues, type ParsedLens } from '../../lens';
import { PortalMenu } from '../../ui/Menu';
import { CaretDownIcon, CheckIcon, SortIcon } from '../../ui/icons';
import { kindMany } from '../../words';
import { LIBRARY_SORTS, type LibrarySort } from './library';

const CHIP =
  'relative touch-target-y inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
const CHIP_ON =
  'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900';
const CHIP_OFF =
  'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

export function KindChips({
  counts,
  total,
  lens,
  parsed,
  onLens,
  lensContext,
}: {
  /** The kinds the library holds and how many, or null while it isn't known whole. */
  counts: { kind: Kind; count: number }[] | null;
  total: number | null;
  lens: string;
  parsed: ParsedLens;
  onLens: (next: string) => void;
  lensContext: Parameters<typeof setDimensionValues>[3];
}) {
  const chosen = parsed.lens.filters['opens-in'];
  const only = chosen.length === 1 ? chosen[0] : null;
  const pick = (kind: Kind | null) =>
    onLens(setDimensionValues(lens, 'opens-in', kind ? [kind] : [], lensContext));
  if (!counts || counts.length < 2) return null;
  return (
    <div
      role="group"
      aria-label="Show"
      data-team-kinds=""
      className="-my-1 flex min-w-0 gap-1.5 py-1 max-sm:overflow-x-auto max-sm:[scrollbar-width:none] sm:flex-wrap"
    >
      <button
        type="button"
        aria-pressed={chosen.length === 0}
        onClick={() => pick(null)}
        className={`${CHIP} ${chosen.length === 0 ? CHIP_ON : CHIP_OFF}`}
      >
        All
        {total !== null ? <Count n={total} on={chosen.length === 0} /> : null}
      </button>
      {counts.map(({ kind, count }) => (
        <button
          key={kind}
          type="button"
          aria-pressed={only === kind}
          onClick={() => pick(only === kind ? null : kind)}
          className={`${CHIP} ${only === kind ? CHIP_ON : CHIP_OFF}`}
        >
          {kindMany(kind)}
          <Count n={count} on={only === kind} />
        </button>
      ))}
    </div>
  );
}

function Count({ n, on }: { n: number; on: boolean }) {
  return (
    <span
      className={`text-xs tabular-nums ${on ? 'opacity-70' : 'text-slate-500 dark:text-slate-400'}`}
    >
      {n.toLocaleString()}
    </span>
  );
}

export function SortMenu({
  sort,
  onSort,
}: {
  sort: LibrarySort;
  onSort: (sort: LibrarySort) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const label = LIBRARY_SORTS.find((s) => s.id === sort)!.label;
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label={`Sort: ${label}`}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="relative touch-target-y inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <SortIcon />
        <span className="max-sm:hidden">{label}</span>
        <CaretDownIcon />
      </button>
      {anchor ? (
        <PortalMenu anchor={anchor} onClose={() => setAnchor(null)} label="Sort">
          {LIBRARY_SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={s.id === sort}
              tabIndex={-1}
              onClick={() => {
                setAnchor(null);
                onSort(s.id);
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
            >
              <span className="flex w-4 shrink-0 justify-center text-brand-600 dark:text-brand-300">
                {s.id === sort ? <CheckIcon size={14} /> : null}
              </span>
              {s.label}
            </button>
          ))}
        </PortalMenu>
      ) : null}
    </>
  );
}
