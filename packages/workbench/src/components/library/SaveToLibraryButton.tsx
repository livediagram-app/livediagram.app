'use client';

// Save to Library on the selection toolbar (liveworkspace/docs/specs/006-media/libraries.md "Who may do what"): beside
// Duplicate, in the toolbar's own button style. Nothing in an editor without the Library. The click copies the
// selection to the origin (the editor's `draft`) and opens the Save dialog.

import { HoverCard } from '@liveworkspace/ui';
import { useLibrary, type LibrarySaveDraft } from './LibraryProvider';
import { SaveToLibraryIcon } from './library-icons';

export function SaveToLibraryButton({
  draft,
  className,
  iconSize = 16,
  multiple = false,
  onOpened,
}: {
  // The selection as a saved item, or null when it can't be saved.
  draft: () => LibrarySaveDraft | null;
  // The toolbar's button classes.
  className: string;
  iconSize?: number;
  // A marquee selection's toolbar, which names the selection in its label.
  multiple?: boolean;
  // After the dialog opens (a menu closes itself).
  onOpened?: () => void;
}) {
  const library = useLibrary();
  if (!library) return null;
  return (
    <HoverCard
      title="Save to Library"
      description={
        multiple
          ? 'Keep these to place in any document, in every app, for you or your team.'
          : 'Keep this to place in any document, in every app, for you or your team.'
      }
    >
      <button
        type="button"
        aria-label={multiple ? 'Save selected elements to Library' : 'Save to Library'}
        aria-haspopup="dialog"
        onClick={() => {
          const next = draft();
          if (next) library.requestSave(next);
          onOpened?.();
        }}
        className={className}
      >
        <SaveToLibraryIcon size={iconSize} />
      </button>
    </HoverCard>
  );
}
