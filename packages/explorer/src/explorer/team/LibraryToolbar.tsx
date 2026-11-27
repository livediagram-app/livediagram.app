'use client';

// A team's Library tab toolbar, left side (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): All
// and a chip for each kind the library holds, with how many, writing the lens's Opens in (`opens-in:plan`) so the
// address, the Filter field and the list agree; and Sort (Last Changed or Name), kept on this device.

import { useState } from 'react';
import type { Kind } from '@liveworkspace/index-client';
import { setDimensionValues, type ParsedLens } from '../../lens';
import { appOfKind } from '../../lens/dimensions';
import { AppMark } from '../badges';
import { FilterChip, FilterChipRow } from '../FilterChips';
import { PortalMenu } from '../../ui/Menu';
import { CaretDownIcon, CheckIcon, SortIcon } from '../../ui/icons';
import { siteOf } from '../../words';
import { LIBRARY_SORTS, type LibrarySort } from './library';

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
    <FilterChipRow label="Show" size={counts.length} data-team-kinds="">
      <FilterChip on={chosen.length === 0} onClick={() => pick(null)} label="All" count={total} />
      {counts.map(({ kind, count }) => {
        const app = appOfKind(kind);
        const on = only === kind;
        return (
          // Each app's own logo and name, so the chip reads as the app the items open in.
          <FilterChip
            key={kind}
            on={on}
            data-kind-chip={kind}
            onClick={() => pick(on ? null : kind)}
            logo={<AppMark app={app} size={16} />}
            label={siteOf(app).name}
            count={count}
          />
        );
      })}
    </FilterChipRow>
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
