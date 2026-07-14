'use client';

import { Tooltip } from '@/components/primitives/Tooltip';

// The palette's shared search box: the bordered text input with the inline
// clear (×) button, used by the Icons + Technology pickers and the Tools
// tab. One home (extracted on the third copy, per the reuse principle) so
// every palette search surface stays pixel-identical.
export function PaletteSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearAriaLabel,
  clearDescription,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
  clearAriaLabel: string;
  // Tooltip body for the clear button, e.g. "Clear the icon search query."
  clearDescription: string;
}) {
  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />
      {value ? (
        <Tooltip title="Clear search" description={clearDescription}>
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={clearAriaLabel}
            className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M3 3 L9 9 M9 3 L3 9" />
            </svg>
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
