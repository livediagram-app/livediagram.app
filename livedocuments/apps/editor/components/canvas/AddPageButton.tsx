'use client';

import { PAGE_GAP, type LaidOutPage } from '@livedocuments/document';
import { PlusIcon, Tooltip } from '@livedocuments/ui';
import { addAnotherLabel } from '@/lib/add-page-labels';

// The + on screen (h-9) and the least room it keeps from the last page, px.
const ADD_PAGE_SIZE = 36;
const ADD_PAGE_CLEARANCE = 12;

const ROUND =
  'flex items-center justify-center rounded-full shadow-md ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const IDLE =
  'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100';

// After the last page (docs/specs/007-editor/pages-mode.md "Adding a page"), the +, held at one
// screen size whatever the zoom: it adds another page like the last one (its kind and shape), named
// for what it adds ("Add Another Slide"). A tab holds one kind ("One kind a tab"), so there is no
// choosing another.
export function AddPageButton({
  last,
  zoom,
  onAddLike,
}: {
  // The last page: where the + sits (in the gap after it, level with its middle) and what it adds
  // another of.
  last: Pick<LaidOutPage, 'id' | 'rect' | 'kind'>;
  zoom: number;
  onAddLike: (pageId: string) => void;
}) {
  const lastRight = last.rect.x + last.rect.width;
  const lastMiddle = last.rect.y + last.rect.height / 2;
  // Centred in a gap's width to the right of the last page, level with its middle (a page sized to
  // its content need not sit on the row's axis); zoomed far out (a phone's fit) the gap is narrower
  // than the +, which then keeps clear of the page by ADD_PAGE_CLEARANCE screen px.
  const x = lastRight + Math.max(PAGE_GAP / 2, (ADD_PAGE_SIZE / 2 + ADD_PAGE_CLEARANCE) / zoom);
  const another = addAnotherLabel(last);
  return (
    <div
      // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md).
      data-tour-id="add-page"
      className="pointer-events-auto absolute flex flex-col items-center transition-[left] duration-200 ease-out motion-reduce:transition-none"
      style={{ left: x, top: lastMiddle, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
      // A press here is the +'s, never the canvas's (no marquee, no deselect, no draw).
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
    </div>
  );
}
