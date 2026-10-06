'use client';

import { HoverCard, Glyph } from '@livediagram/ui';

// The shared search box: a bordered text input with an inline clear (×)
// button. Used by the Icons + Technology pickers, the palette's Tools tab,
// and the Settings dialog.
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
}) {
  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-activedescendant={activeDescendantId}
        role={listboxId ? 'combobox' : undefined}
        aria-controls={listboxId}
        aria-expanded={listboxId ? true : undefined}
        aria-autocomplete={listboxId ? 'list' : undefined}
        className="w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />
      {value ? (
        <HoverCard title="Clear search" description={clearDescription}>
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={clearAriaLabel}
            // slate-500 / slate-400 rather than a fainter grey: an icon needs 3:1 against the field
            // (WCAG 2.2 1.4.11), and the lighter one was easy to miss.
            className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 touch-target items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
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
