'use client';

// A search and its filters as one field (docs/specs/004-interface-design/search-and-filters.md), as a board's
// card search reads: the filters are chips inside the box, before the text, so the box always reads as the
// whole query; the control that adds a filter sits inside its right edge, with the clear. Backspace in an empty box
// takes the last filter off. The caller owns what a chip and the filter control mean.
import { useRef, type ReactNode } from 'react';
import { CloseIcon, SearchIcon, Tooltip } from '@liveworkspace/ui';

// A surface's own colours (a Plan board's palette), in place of the app's slate and brand.
export type FilterSearchTone = { border: string; text: string; muted: string; focus: string };

type SearchChip = {
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
  compact = false,
  tone,
  clearLabel = 'Clear Search',
  chipsPlaceholder = 'Search these…',
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
  // The one-row header form (a board's Filter widget): 28 px tall, the chips scrolling sideways rather than wrapping.
  compact?: boolean;
  tone?: FilterSearchTone;
  clearLabel?: string;
  // The words' placeholder once there are chips.
  chipsPlaceholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const filled = query !== '' || chips.length > 0;
  const shell = compact ? 'h-7 rounded-md py-0 pl-2 pr-0.5' : 'rounded-lg py-1 pl-2 pr-1';
  const colours = tone
    ? 'bg-transparent focus-within:ring-2'
    : 'border-slate-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/25 dark:border-slate-700 dark:bg-slate-800';
  // Compact, a chip keeps its one line and the row scrolls; else it may wrap to the box's width.
  const chipWidth = compact ? 'whitespace-nowrap' : 'max-w-full';
  const chipClass = tone
    ? `inline-flex ${chipWidth} shrink-0 items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[12px] ring-1 ring-inset`
    : `inline-flex ${chipWidth} shrink-0 items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2 pr-1 text-[12px] text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-500/30`;
  return (
    <div
      role="search"
      // Named, so two on one page (a board's Filter widget and Find a Card) are told apart.
      aria-label={ariaLabel}
      className={`flex w-full min-w-0 items-center gap-1.5 border transition-colors duration-micro ${shell} ${colours}`}
      style={
        tone
          ? {
              borderColor: filled ? tone.focus : tone.border,
              color: tone.text,
              ['--tw-ring-color' as string]: `${tone.focus}40`,
            }
          : undefined
      }
      // A press on the box's empty space puts the caret in the text.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          input.current?.focus();
        }
      }}
    >
      <span
        aria-hidden
        className={`flex shrink-0 ${tone ? '' : 'text-slate-500 dark:text-slate-400'}`}
        style={tone ? { color: filled ? tone.focus : tone.muted } : undefined}
      >
        <SearchIcon size={compact ? 13 : 14} />
      </span>
      <div
        role="group"
        aria-label="Filters"
        className={`flex min-w-0 flex-1 items-center gap-1 ${compact ? 'flex-nowrap overflow-x-auto [scrollbar-width:none]' : 'flex-wrap'}`}
      >
        {chips.map((chip, i) => (
          <span
            key={chip.key}
            className={chipClass}
            style={
              tone
                ? {
                    color: tone.focus,
                    backgroundColor: `${tone.focus}1f`,
                    ['--tw-ring-color' as string]: `${tone.focus}55`,
                  }
                : undefined
            }
          >
            <span className="font-medium">{chip.field}:</span>
            <span className={`truncate ${compact ? 'max-w-[9rem]' : ''}`}>{chip.value}</span>
            {onRemoveChip ? (
              <Tooltip label={`Remove ${chip.field}: ${chip.value}`}>
                <button
                  type="button"
                  aria-label={`Remove ${chip.field}: ${chip.value}`}
                  className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition ${tone ? 'hover:bg-black/10 dark:hover:bg-white/15' : 'hover:bg-brand-100 dark:hover:bg-brand-500/20'}`}
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
          placeholder={chips.length ? chipsPlaceholder : placeholder}
          className={`min-w-[6rem] flex-1 bg-transparent py-0.5 text-xs outline-none ${tone ? 'placeholder:opacity-60' : 'text-slate-700 placeholder:text-slate-400 dark:text-slate-200'}`}
          style={tone ? { color: tone.text } : undefined}
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
      <div className={`flex shrink-0 items-center gap-0.5 ${compact ? '' : 'self-start'}`}>
        {filled ? (
          <Tooltip label={clearLabel}>
            <button
              type="button"
              aria-label={clearLabel}
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
