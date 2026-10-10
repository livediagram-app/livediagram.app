'use client';

// Add a page from the Toolbar layout's strip (docs/specs/007-editor/illustrate-pages.md "Page
// kinds"): in Illustrate mode the strip ends, after a divider, with a + that opens the same
// "Add a page" popover as the + after the last page.
import { useCallback, useRef, useState } from 'react';
import type { PageKind } from '@livediagram/document';
import { lucidePlus } from '@livediagram/icons/lucide';
import { HoverCard, lucideGlyph } from '@livediagram/ui';
import { AddPagePopover } from '@/components/canvas/AddPagePopover';
import { TOOLBAR_CONTROL_PRESSED, TOOLBAR_CONTROL_REST } from '@/components/chrome/toolbar-surface';

const Plus = lucideGlyph(lucidePlus, 16);

export function AddPageStripButton({ onAdd }: { onAdd: (kind: PageKind) => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const getAnchor = useCallback(() => button.current, []);
  return (
    <>
      <HoverCard
        title="Add page"
        description="A new infographic, article, slide or logo page after the last."
      >
        <button
          ref={button}
          type="button"
          aria-label="Add page"
          aria-haspopup="dialog"
          aria-expanded={open}
          // A press on the + itself toggles the popover rather than counting as outside it.
          data-add-page-trigger
          onClick={() => setOpen((o) => !o)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
            open ? TOOLBAR_CONTROL_PRESSED : TOOLBAR_CONTROL_REST
          }`}
        >
          <Plus />
        </button>
      </HoverCard>
      {open ? (
        <AddPagePopover
          getAnchor={getAnchor}
          onAdd={onAdd}
          onClose={(restoreFocus) => {
            setOpen(false);
            if (restoreFocus) button.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
