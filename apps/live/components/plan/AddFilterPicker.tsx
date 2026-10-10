'use client';

// Add Filter (docs/specs/026-plan/plan-views.md "Card Search"; items.md "Find a card"): a button opening a popover of
// the fields a filter can be added on; picking one shows its values, each with how many cards have it, and picking a
// value adds the filter and closes it. A long list gets a box to narrow it. Drawn over the page (AnchoredPopover),
// so a picker on the zoomed canvas reads at its own size, as menus do.
import { useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  TextInput,
} from '@livediagram/ui';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';

export type FilterField = { id: string; label: string };
export type FilterValue = { key: string; label: string; count: number };

const POPOVER_PX = 260;
// Past this many rows, a box to narrow them.
const NARROW_AT = 8;

const ROW =
  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-slate-700 transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';

export function AddFilterPicker({
  fields,
  valuesOf,
  onPick,
  className = '',
  inBox = false,
}: {
  fields: readonly FilterField[];
  valuesOf: (fieldId: string) => readonly FilterValue[];
  onPick: (fieldId: string, valueKey: string) => void;
  className?: string;
  // Inside a search box's right edge (FilterSearchBox): a quiet button rather than a dashed pill.
  inBox?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [field, setField] = useState<FilterField | null>(null);
  const [query, setQuery] = useState('');
  const close = () => {
    setAnchor(null);
    setField(null);
    setQuery('');
  };
  const values = field ? valuesOf(field.id) : [];
  const q = query.trim().toLowerCase();
  const shownFields = q ? fields.filter((f) => f.label.toLowerCase().includes(q)) : fields;
  const shownValues = q ? values.filter((v) => v.label.toLowerCase().includes(q)) : values;
  const long = (field ? values.length : fields.length) > NARROW_AT;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        className={`inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-slate-600 transition hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-200 ${
          inBox
            ? 'h-6 whitespace-nowrap rounded-md px-1.5 hover:bg-brand-50 dark:hover:bg-brand-500/10'
            : 'rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-600 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
        } ${className}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => (anchor ? close() : setAnchor(e.currentTarget))}
      >
        <PlusIcon size={11} />
        <span className="text-optical-centre">Add Filter</span>
      </button>
      {anchor ? (
        <AnchoredPopover anchor={anchor} name="Add Filter" width={POPOVER_PX} onClose={close}>
          <div
            className="flex max-h-80 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 px-1 pb-1 pt-0.5">
              {field ? (
                <button
                  type="button"
                  aria-label="Back to the fields"
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  onClick={() => {
                    setField(null);
                    setQuery('');
                  }}
                >
                  <ChevronLeftIcon size={14} />
                </button>
              ) : null}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {field ? `${field.label} is` : 'Filter by'}
              </span>
            </div>
            {long ? (
              <div className="relative px-1 pb-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <SearchIcon size={13} />
                </span>
                <TextInput
                  compact
                  aria-label={field ? `Find a ${field.label}` : 'Find a field'}
                  placeholder={field ? `Find a ${field.label.toLowerCase()}` : 'Find a field'}
                  className="pl-7"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            ) : null}
            <ul className="min-h-0 overflow-y-auto overscroll-contain">
              {field
                ? shownValues.map((v) => (
                    <li key={v.key}>
                      <button
                        type="button"
                        className={ROW}
                        onClick={() => {
                          onPick(field.id, v.key);
                          close();
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{v.label}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {v.count}
                        </span>
                      </button>
                    </li>
                  ))
                : shownFields.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={ROW}
                        onClick={() => {
                          setField(f);
                          setQuery('');
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{f.label}</span>
                        <ChevronRightIcon size={12} />
                      </button>
                    </li>
                  ))}
            </ul>
            {(field ? shownValues : shownFields).length === 0 ? (
              <p className="px-2 py-2 text-[12px] text-slate-500 dark:text-slate-400">
                Nothing matches “{query.trim()}”.
              </p>
            ) : null}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
