'use client';

import { useCallback, useRef, useState } from 'react';
import { ILLUSTRATE_PAGE_GAP, type PageKind } from '@livediagram/document';
import { PlusIcon, Tooltip } from '@livediagram/ui';
import { AddPagePopover } from './AddPagePopover';

// The button's size on screen (h-9) and the least room it keeps from the last page, px.
const ADD_PAGE_SIZE = 36;
const ADD_PAGE_CLEARANCE = 12;

// The + after the last page (docs/specs/007-editor/illustrate-pages.md "Adding a page"): opens
// "Add a page" (AddPagePopover) to choose the kind. Held at one screen size whatever the zoom.
export function AddPageButton({
  lastRight,
  zoom,
  onAdd,
}: {
  // The last page's right edge, in canvas px.
  lastRight: number;
  zoom: number;
  onAdd: (kind: PageKind) => void;
}) {
  // Centred in a gap's width to the right of the last page, on the row's axis; zoomed far out (a
  // phone's fit) the gap is narrower than the button, which then keeps clear of the page by
  // ADD_PAGE_CLEARANCE screen px rather than covering its edge.
  const x =
    lastRight + Math.max(ILLUSTRATE_PAGE_GAP / 2, (ADD_PAGE_SIZE / 2 + ADD_PAGE_CLEARANCE) / zoom);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const getAnchor = useCallback(() => button.current, []);
  return (
    <div
      className="pointer-events-auto absolute transition-[left] duration-200 ease-out motion-reduce:transition-none"
      style={{ left: x, top: 0, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
      // A press here is the button's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="Add Page">
        <button
          ref={button}
          type="button"
          aria-label="Add Page"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-add-page-trigger
          onClick={() => setOpen((o) => !o)}
          className={`flex h-9 w-9 items-center justify-center rounded-full shadow-md ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
            open
              ? 'bg-brand-600 text-white ring-brand-600 dark:bg-brand-600'
              : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100'
          }`}
        >
          <PlusIcon />
        </button>
      </Tooltip>
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
    </div>
  );
}
