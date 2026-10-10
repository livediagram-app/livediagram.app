'use client';

// A search and its filters as one field (docs/specs/004-interface-design/search-and-filters.md), as the Community
// gallery's search box reads: the filters are chips inside the box, before the text, so the box always reads as the
// whole query; the control that adds a filter sits inside its right edge, with the clear. Backspace in an empty box
// takes the last filter off. The caller owns what a chip and the filter control mean.
import { useRef, type ReactNode } from 'react';
import { CloseIcon, SearchIcon, Tooltip } from '@livediagram/ui';

export type SearchChip = {
  key: string;
  // "Card Type" and "Project", read "Card Type: Project".
  field: string;
  value: string;
};

export function FilterSearchBox({
  query,
  onQuery,
  chips,
  onRemoveChip,
  onClear,
  addFilter,
  placeholder,
  ariaLabel,
  autoFocus = false,
  onKeyDown,
}: {
  query: string;
  onQuery: (q: string) => void;
  chips: readonly SearchChip[];
  // Absent when the filters cannot change.
  onRemoveChip?: (index: number) => void;
  // Clears the words and every filter.
  onClear: () => void;
  // The control that adds a filter, drawn inside the box's right edge.
  addFilter?: ReactNode;
  placeholder: string;
  ariaLabel: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const filled = query !== '' || chips.length > 0;
  return (
    <div
      role="search"
      className="flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-1 transition-colors duration-micro focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/25 dark:border-slate-700 dark:bg-slate-800"
      // A press on the box's empty space puts the caret in the text.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          input.current?.focus();
        }
      }}
    >
      <SearchIcon size={14} aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400" />
      <div
        role="group"
        aria-label="Filters"
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
      >
        {chips.map((chip, i) => (
          <span
            key={chip.key}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2 pr-1 text-[12px] text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-500/30"
          >
            <span className="font-medium">{chip.field}:</span>
            <span className="truncate">{chip.value}</span>
            {onRemoveChip ? (
              <Tooltip label={`Remove ${chip.field}: ${chip.value}`}>
                <button
                  type="button"
                  aria-label={`Remove ${chip.field}: ${chip.value}`}
                  className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition hover:bg-brand-100 dark:hover:bg-brand-500/20"
                  onClick={() => {
                    onRemoveChip(i);
                    input.current?.focus();
                  }}
                >
                  <CloseIcon size={9} />
                </button>
              </Tooltip>
            ) : null}
          </span>
        ))}
        <input
          ref={input}
          type="text"
          value={query}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          placeholder={chips.length ? 'Search these…' : placeholder}
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && query === '' && chips.length && onRemoveChip) {
              e.preventDefault();
              onRemoveChip(chips.length - 1);
            }
            onKeyDown?.(e);
          }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 self-start">
        {filled ? (
          <Tooltip label="Clear Search">
            <button
              type="button"
              aria-label="Clear Search"
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              onClick={() => {
                onClear();
                input.current?.focus();
              }}
            >
              <CloseIcon size={12} />
            </button>
          </Tooltip>
        ) : null}
        {addFilter}
      </div>
    </div>
  );
}
