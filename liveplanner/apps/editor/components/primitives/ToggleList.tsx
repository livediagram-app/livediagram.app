'use client';

// A list of things to show or hide, as a card of rows (Publish Roadmap's Columns, Card Types and Fields): a head
// with the group's name, how many are on, and Show All / Hide All; then a row each with its glyph, name and a switch.
// Collapsible (Publish Roadmap keeps one open at a time): closed, the head alone shows, with what is on as a
// line of names. It scales: past eight rows a filter field appears and the rows scroll inside the card, never the dialog.
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Switch, SwitchRow } from '@liveworkspace/ui';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideChevronDown, lucideSearch } from '@liveworkspace/icons/lucide';

const SearchIcon = lucideGlyph(lucideSearch, 14);
const ChevronIcon = lucideGlyph(lucideChevronDown, 16);

// Rows past this get a filter field and an inner scroll.
export const TOGGLE_LIST_FILTER_AT = 8;

export type ToggleRow = {
  id: string;
  label: string;
  icon?: ReactNode;
  // A line under the name.
  detail?: string;
  // Why it can't be turned off just now (the last one shown), shown as its tooltip.
  locked?: string;
};

const LINK =
  'cursor-pointer rounded px-1 text-xs font-medium text-brand-700 transition-colors duration-micro hover:text-brand-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:text-slate-400 disabled:no-underline dark:text-brand-300 dark:hover:text-brand-100 dark:disabled:text-slate-500';

export function ToggleList({
  title,
  hint,
  rows,
  on,
  disabled = false,
  onToggle,
  onAll,
  noun,
  data,
  open = true,
  onOpenChange,
}: {
  title: string;
  hint?: string;
  rows: readonly ToggleRow[];
  on: (id: string) => boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
  // Show All or Hide All; Hide All is offered only where at least one may stay (the caller keeps the first).
  onAll?: (show: boolean) => void;
  // "shown", for "3 of 7 shown".
  noun?: string;
  data?: string;
  // Collapsible when `onOpenChange` is given: its head is a button that opens and closes it.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const filterable = rows.length > TOGGLE_LIST_FILTER_AT;
  const shownRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows;
  }, [rows, query]);
  const onRows = rows.filter((r) => on(r.id));
  const count = onRows.length;
  // What is on, for the closed head: names, then "+N".
  const onNames =
    onRows.length > 3
      ? `${onRows
          .slice(0, 3)
          .map((r) => r.label)
          .join(', ')} +${onRows.length - 3}`
      : onRows.map((r) => r.label).join(', ');
  return (
    <section aria-labelledby={id} data-toggle-list={data} className="flex flex-col gap-1.5">
      {onOpenChange ? (
        <button
          type="button"
          id={id}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => onOpenChange(!open)}
          className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-micro focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
            open
              ? 'border-transparent bg-transparent px-0.5'
              : 'border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/60'
          }`}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {title}
            </span>
            {open ? null : (
              <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {onNames || 'None'}
              </span>
            )}
          </span>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {count}/{rows.length}
          </span>
          <span
            aria-hidden
            className={`shrink-0 text-slate-400 transition-transform duration-short motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          >
            <ChevronIcon />
          </span>
        </button>
      ) : null}
      {open ? (
        <div id={`${id}-body`} className="flex flex-col gap-1.5 motion-safe:animate-fade-in">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {onOpenChange ? null : (
                <h3
                  id={id}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {title}
                </h3>
              )}
              {hint ? (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onOpenChange ? null : (
                <span
                  className="text-xs tabular-nums text-slate-500 dark:text-slate-400"
                  aria-live="polite"
                >
                  {count} of {rows.length} {noun ?? 'on'}
                </span>
              )}
              {onAll ? (
                <>
                  {onOpenChange ? null : (
                    <span aria-hidden className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                  )}
                  <button
                    type="button"
                    className={LINK}
                    disabled={disabled || count === rows.length}
                    onClick={() => onAll(true)}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={LINK}
                    disabled={disabled || count <= 1}
                    onClick={() => onAll(false)}
                  >
                    None
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-slate-700 dark:bg-slate-900">
            {filterable ? (
              <label className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2 text-slate-400 dark:border-slate-800">
                <SearchIcon />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Filter ${title.toLowerCase()}`}
                  aria-label={`Filter ${title.toLowerCase()}`}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </label>
            ) : null}
            <ul
              className={`divide-y divide-slate-100 dark:divide-slate-800 ${filterable ? 'max-h-[264px] overflow-y-auto overscroll-contain' : ''}`}
            >
              {shownRows.map((r) => {
                const checked = on(r.id);
                const locked = checked && r.locked ? r.locked : undefined;
                return (
                  <li key={r.id}>
                    <SwitchRow
                      track="none"
                      checked={checked}
                      disabled={disabled || !!locked}
                      title={locked}
                      onChange={() => onToggle(r.id)}
                      layout="group flex w-full items-center gap-3 text-left"
                      className="px-3.5 py-2.5 text-left transition-colors duration-micro hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default dark:hover:bg-slate-800/60"
                    >
                      {r.icon ? (
                        <span
                          aria-hidden
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-[opacity,filter] duration-micro ${
                            checked ? '' : 'opacity-45 grayscale'
                          }`}
                        >
                          {r.icon}
                        </span>
                      ) : null}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={`truncate text-sm font-medium transition-colors duration-micro ${
                            checked
                              ? 'text-slate-900 dark:text-slate-100'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {r.label}
                        </span>
                        {r.detail ? (
                          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {r.detail}
                          </span>
                        ) : null}
                      </span>
                      <Switch presentational checked={checked} />
                    </SwitchRow>
                  </li>
                );
              })}
              {shownRows.length === 0 ? (
                <li className="px-3.5 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nothing matches “{query.trim()}”.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
