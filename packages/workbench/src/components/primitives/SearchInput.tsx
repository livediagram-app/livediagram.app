'use client';

import { HoverCard, Glyph, SearchIcon } from '@liveworkspace/ui';

// The box's two sizes: `md` the compact panel field it always was; `lg` a thumb's field on a phone (a filter row's,
// 40px tall with 14px text and a leading search mark, the brand focus ring the Select and the other fields wear).
const FIELD = {
  md: 'w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  lg: 'h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-[14px] text-slate-800 placeholder:text-slate-500 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-brand-500/20',
} as const;

// The shared search box: a bordered text input with an inline clear (×)
// button. Used by the Icons + Technology pickers, the palette's Tools tab,
// the Settings dialog and Plan's Cards panel.
//
// It lived in components/palette as PaletteSearchInput until Settings needed
// one too. Nothing about it was ever palette-specific: the caller supplies
// every label and owns what the keys MEAN, so it moved here rather than
// being copied, which is what its own "extracted on the third copy" note was
// warning against.
export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearAriaLabel,
  clearDescription,
  onKeyDown,
  activeDescendantId,
  listboxId,
  autoFocus,
  size = 'md',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
  clearAriaLabel: string;
  // HoverCard body for the clear button, e.g. "Clear the icon search query."
  clearDescription: string;
  // Optional keyboard passthrough. The box stays generic, what Arrow / Enter
  // MEAN belongs to whichever results list is underneath, so the caller owns
  // it (docs/specs/010-palette/palette-top-level-categories.md: the Favourites search walks its results this way).
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // The id of the currently walked result, for screen readers: focus stays in
  // the box while the highlight moves, which is the combobox pattern.
  activeDescendantId?: string;
  // The results list this box drives, when it is always shown beneath it: the box becomes a
  // combobox controlling that listbox (the whiteboard's More shapes search).
  listboxId?: string;
  // Focus the box on mount (a popover whose first job is the search, like Plan's Cards panel).
  autoFocus?: boolean;
  size?: keyof typeof FIELD;
}) {
  return (
    <div className="relative flex-1">
      {size === 'lg' ? (
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
        />
      ) : null}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-activedescendant={activeDescendantId}
        role={listboxId ? 'combobox' : undefined}
        aria-controls={listboxId}
        aria-expanded={listboxId ? true : undefined}
        aria-autocomplete={listboxId ? 'list' : undefined}
        className={FIELD[size]}
      />
      {value ? (
        <HoverCard title="Clear search" description={clearDescription}>
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={clearAriaLabel}
            // slate-500 / slate-400 rather than a fainter grey: an icon needs 3:1 against the field
            // (WCAG 2.2 1.4.11), and the lighter one was easy to miss.
            className={`absolute top-1/2 flex -translate-y-1/2 cursor-pointer touch-target items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${size === 'lg' ? 'right-2 h-6 w-6' : 'right-1 h-5 w-5'}`}
          >
            <Glyph size={14} units={12} strokeLinejoin="miter">
              <path d="M3 3 L9 9 M9 3 L3 9" />
            </Glyph>
          </button>
        </HoverCard>
      ) : null}
    </div>
  );
}
