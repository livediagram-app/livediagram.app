'use client';

// The Toolbar strip's Library (liveworkspace/docs/specs/006-media/libraries.md "The Library sits beside Search"): an
// icon-only button at the strip's far right, just before Search, not a category. The Library is the person's own
// (saved shapes, images, their teams'), so it stands apart from the app's catalogue. It opens the Library's body in
// the strip's popover, as Search opens its own; each app hands in the Library's icon and body.
import type { ReactNode } from 'react';
import { HoverCard } from '@liveworkspace/ui';
import { TOOLBAR_TRIGGER_TONE } from './PaletteDropdown';

/** Marks the button and the popover, for the popover's outside-press check. */
export const TOOLBAR_LIBRARY_SELECTOR = '[data-toolbar-library], [data-toolbar-library-button]';

export function ToolbarLibraryButton({
  open,
  onToggle,
  icon,
  description = 'Your saved items and your teams’, in every app.',
}: {
  open: boolean;
  onToggle: (button: HTMLElement) => void;
  icon: ReactNode;
  description?: string;
}) {
  // No hover card while open: it would sit over the popover it names. Switched off rather than left out, so the
  // button is not remounted as it opens and Escape hands focus back to it.
  return (
    <HoverCard disabled={open} title="Library" description={description}>
      <button
        type="button"
        data-toolbar-library-button=""
        aria-label="Library"
        aria-expanded={open}
        onClick={(e) => onToggle(e.currentTarget)}
        // A square the size of a tile, as Search's is.
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition [&_svg]:size-4 ${
          open
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
            : TOOLBAR_TRIGGER_TONE
        }`}
      >
        {icon}
      </button>
    </HoverCard>
  );
}
