'use client';

import type { SettingsUiKit } from '@liveworkspace/settings-ui';
import { DialogCloseButton, Glyph, HoverCard, NoMatches } from '@livediagram/ui';

// What the shared Settings view (@liveworkspace/settings-ui) borrows here: livediagram's glyph,
// close button and empty state, as the apps' own Settings use, and the apps' search box. No help
// links, Sign In link or drawings: those belong to the app's own Settings.
export const APP_SETTINGS_KIT: SettingsUiKit = {
  Glyph,
  SearchInput,
  CloseButton: ({ onClick }) => <DialogCloseButton compact onClick={onClick} />,
  NoMatches,
};

// The apps' search box (each editor's SearchInput): a bordered field with an inline clear button.
function SearchInput({
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
        className="w-full rounded-md border border-slate-200 bg-white py-1 pr-7 pl-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />
      {value ? (
        <HoverCard title="Clear search" description={clearDescription}>
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={clearAriaLabel}
            className="absolute top-1/2 right-1 flex h-5 w-5 -translate-y-1/2 touch-target items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
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
