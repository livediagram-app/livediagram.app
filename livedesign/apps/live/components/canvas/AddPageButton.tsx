'use client';

import { useCallback, useRef, useState } from 'react';
import {
  PAGE_GAP,
  type LaidOutPage,
  type PageKind,
  type WireframeDeviceId,
} from '@livedesign/document';
import { lucideLayoutGrid } from '@livedesign/icons/lucide';
import { lucideGlyph, PlusIcon, Tooltip } from '@livedesign/ui';
import { addAnotherLabel } from '@/lib/add-page-labels';
import { AddPagePopover } from './AddPagePopover';

const ChooseIcon = lucideGlyph(lucideLayoutGrid, 14);

// The + on screen (h-9), the chooser under it (h-7), the gap between, and the least room the pair
// keeps from the last page, px.
const ADD_PAGE_SIZE = 36;
const ADD_PAGE_CLEARANCE = 12;

const ROUND =
  'flex items-center justify-center rounded-full shadow-md ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const IDLE =
  'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100';
const PRESSED = 'bg-brand-700 text-white ring-brand-700 dark:bg-brand-600';

// After the last page (docs/specs/007-editor/pages-mode.md "Adding a page"), two buttons, held at
// one screen size whatever the zoom: the + adds another page like the last one (its kind and shape;
// a wireframe page's device and frame too), named for what it adds ("Add Another Slide"); the
// button under it opens Add a Page (AddPagePopover) to choose a page of any kind.
export function AddPageButton({
  last,
  zoom,
  onAdd,
  onAddLike,
}: {
  // The last page: where the pair sits (in the gap after it, level with its middle) and what the +
  // adds another of.
  last: Pick<LaidOutPage, 'id' | 'rect' | 'kind' | 'device'>;
  zoom: number;
  onAdd: (kind: PageKind, device?: WireframeDeviceId) => void;
  onAddLike: (pageId: string) => void;
}) {
  const lastRight = last.rect.x + last.rect.width;
  const lastMiddle = last.rect.y + last.rect.height / 2;
  // Centred in a gap's width to the right of the last page, level with its middle (a page sized to
  // its content need not sit on the row's axis); zoomed far out (a phone's fit) the gap is narrower
  // than the buttons, which then keep clear of the page by ADD_PAGE_CLEARANCE screen px.
  const x = lastRight + Math.max(PAGE_GAP / 2, (ADD_PAGE_SIZE / 2 + ADD_PAGE_CLEARANCE) / zoom);
  const [open, setOpen] = useState(false);
  const chooser = useRef<HTMLButtonElement>(null);
  const getAnchor = useCallback(() => chooser.current, []);
  const another = addAnotherLabel(last);
  return (
    <div
      // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md): both buttons.
      data-tour-id="add-page"
      className="pointer-events-auto absolute flex flex-col items-center gap-1.5 transition-[left] duration-200 ease-out motion-reduce:transition-none"
      style={{ left: x, top: lastMiddle, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
      // A press here is the buttons', never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={another}>
        <button
          type="button"
          aria-label={another}
          data-add-page-like=""
          onClick={() => onAddLike(last.id)}
          className={`${ROUND} h-9 w-9 ${IDLE}`}
        >
          <PlusIcon />
        </button>
      </Tooltip>
      <Tooltip label="Add a Page of Any Kind">
        <button
          ref={chooser}
          type="button"
          aria-label="Add a Page of Any Kind"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-add-page-trigger
          onClick={() => setOpen((o) => !o)}
          className={`${ROUND} h-7 w-7 ${open ? PRESSED : IDLE}`}
        >
          <ChooseIcon />
        </button>
      </Tooltip>
      {open ? (
        <AddPagePopover
          getAnchor={getAnchor}
          onAdd={onAdd}
          onClose={(restoreFocus) => {
            setOpen(false);
            if (restoreFocus) chooser.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
