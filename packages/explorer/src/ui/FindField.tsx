'use client';

// A small field that narrows the list beside it as the person types (a team's Find a Person, the Image Gallery's
// name search): a magnifier, the words, and a clear button while there are any. Escape clears it too. It filters in
// place and never touches the address, unlike the Explorer's search field (explorer/SearchField.tsx).

import { Tooltip } from '@liveworkspace/ui';
import { CloseIcon, SearchIcon } from './icons';

export function FindField({
  label,
  value,
  onChange,
  className = '',
}: {
  /** Its name and its placeholder ("Find a person"). */
  label: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <label className={`relative flex h-8 min-w-0 items-center ${className}`}>
      <span className="pointer-events-none absolute left-2.5 text-slate-400" aria-hidden>
        <SearchIcon size={14} />
      </span>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            // Clears the field rather than closing whatever holds it.
            e.stopPropagation();
            onChange('');
          }
        }}
        placeholder={label}
        className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <Tooltip label="Clear search">
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="absolute right-1.5 inline-flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={10} />
          </button>
        </Tooltip>
      ) : null}
    </label>
  );
}
