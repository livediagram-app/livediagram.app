'use client';

// A team's Library tab toolbar, left side (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): All
// and a chip for each kind the library holds, with how many, writing the lens's Opens in (`opens-in:plan`) so the
// address, the Filter field and the list agree; and Sort (Last Changed or Name), kept on this device.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Kind } from '@liveworkspace/index-client';
import { setDimensionValues, type ParsedLens } from '../../lens';
import { appOfKind } from '../../lens/dimensions';
import { AppMark } from '../badges';
import { PortalMenu } from '../../ui/Menu';
import { CaretDownIcon, CheckIcon, SortIcon } from '../../ui/icons';
import { siteOf } from '../../words';
import { LIBRARY_SORTS, type LibrarySort } from './library';

const CHIP =
  'relative touch-target-y inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
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
  const { ref, fade } = useEdgeFade(counts?.length ?? 0);
  if (!counts || counts.length < 2) return null;
  return (
    <div
      ref={ref}
      style={fade}
      role="group"
      aria-label="Show"
      data-team-kinds=""
      className="-my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]"
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
        <KindChip key={kind} kind={kind} count={count} on={only === kind} onPick={pick} />
      ))}
    </div>
  );
}

// Each app's own logo and name, so the chip reads as the app the items open in.
function KindChip({
  kind,
  count,
  on,
  onPick,
}: {
  kind: Kind;
  count: number;
  on: boolean;
  onPick: (kind: Kind | null) => void;
}) {
  const app = appOfKind(kind);
  return (
    <button
      type="button"
      aria-pressed={on}
      data-kind-chip={kind}
      onClick={() => onPick(on ? null : kind)}
      className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF} pl-2`}
    >
      <span aria-hidden className="inline-flex">
        <AppMark app={app} size={16} />
      </span>
      {siteOf(app).name}
      <Count n={count} on={on} />
    </button>
  );
}

// One row that scrolls sideways rather than wrapping: an edge fades while there is more past it, so a chip that
// doesn't fit reads as "scroll for more" and not as cut off.
const FADE = '28px';
function useEdgeFade(dependency: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((was) => (was.start === start && was.end === end ? was : { start, end }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure, dependency]);
  if (!edges.start && !edges.end) return { ref, fade: undefined };
  const mask = `linear-gradient(to right, ${edges.start ? 'transparent' : '#000'}, #000 ${edges.start ? FADE : '0px'}, #000 calc(100% - ${edges.end ? FADE : '0px'}), ${edges.end ? 'transparent' : '#000'})`;
  return { ref, fade: { maskImage: mask, WebkitMaskImage: mask } };
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
