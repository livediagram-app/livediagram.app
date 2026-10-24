'use client';

import { useCallback, useRef, useState } from 'react';
import { PAGE_GAP, type LaidOutPage, type Page, type WireframeDeviceId } from '@livedesign/design';
import { lucideLayoutGrid } from '@livedesign/icons/lucide';
import { lucideGlyph, PlusIcon, Tooltip } from '@livedesign/ui';
import { addAnotherLabel } from '@/lib/add-page-labels';
import { AddScreenPopover } from './AddScreenPopover';

const ChooseIcon = lucideGlyph(lucideLayoutGrid, 14);

// The + on screen (h-9), a wireframe tab's device button under it (h-7), the gap between, and the
// least room they keep from the last page, px.
const ADD_PAGE_SIZE = 36;
const ADD_PAGE_CLEARANCE = 12;

const ROUND =
  'flex items-center justify-center rounded-full shadow-md ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const IDLE =
  'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100';
const PRESSED = 'bg-brand-700 text-white ring-brand-700 dark:bg-brand-600';

export const ADD_SCREEN_LABEL = 'Add a Screen of Another Device';

// After the last page (docs/specs/007-editor/pages-mode.md "Adding a page"), held at one screen size
// whatever the zoom: the + adds another page like the last of the tab's kind (its kind and shape; a
// wireframe page's device and frame too), named for what it adds ("Add Another Logo Page"). A tab
// holds one kind ("One kind a tab"), so there is no choosing another; a wireframe tab's button under
// the + adds a screen of another device (AddScreenPopover).
export function AddPageButton({
  last,
  like,
  zoom,
  onAddLike,
  onAddDevice,
}: {
  // The last page: where the + sits (in the gap after it, level with its middle).
  last: Pick<LaidOutPage, 'rect'>;
  // What the + adds another of: the last page of the tab's kind (lastPageOfTabKind).
  like: Pick<Page, 'id' | 'kind' | 'device'>;
  zoom: number;
  onAddLike: (pageId: string) => void;
  // A wireframe screen in the device chosen; absent where it cannot be added.
  onAddDevice?: (device: WireframeDeviceId) => void;
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
  const another = addAnotherLabel(like);
  const screens = like.kind === 'wireframe' ? onAddDevice : undefined;
  return (
    <div
      // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md).
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
          onClick={() => onAddLike(like.id)}
          className={`${ROUND} h-9 w-9 ${IDLE}`}
        >
          <PlusIcon />
        </button>
      </Tooltip>
      {screens ? (
        <>
          <Tooltip label={ADD_SCREEN_LABEL}>
            <button
              ref={chooser}
              type="button"
              aria-label={ADD_SCREEN_LABEL}
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
            <AddScreenPopover
              getAnchor={getAnchor}
              onAddDevice={screens}
              onClose={(restoreFocus) => {
                setOpen(false);
                if (restoreFocus) chooser.current?.focus();
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
