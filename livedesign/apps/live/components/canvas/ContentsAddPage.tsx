'use client';

// Contents' Add Page (docs/specs/007-editor/pages-mode.md "Contents"): the footer both of its homes
// (PageContentsPanel, PageContentsSidebar) end on, the canvas's + after the last page
// (AddPageButton) as a wide button: it adds another page like the last of the tab's kind (its
// tooltip says what: "Add Logo Page"; a wireframe page's device and frame too), always of
// the tab's kind ("One kind a tab"). On a wireframe tab a square button beside it opens Choose a
// Device (AddScreenPopover) for a screen of another device. At the page limit both are disabled, a
// Tooltip naming the limit. A tab with no kind yet (a blank first page) has no Add Page. Docked, the
// sidebar's Minimise (`end`) sits at the row's right.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { MAX_PAGES } from '@livedesign/design';
import { lucideLayoutGrid, lucidePlus } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { addAnotherLabel, addPageLabel } from '@/lib/add-page-labels';
import { ADD_SCREEN_LABEL } from './AddPageButton';
import { AddScreenPopover } from './AddScreenPopover';

const ChooseIcon = lucideGlyph(lucideLayoutGrid, 16);
const AddIcon = lucideGlyph(lucidePlus, 16);

const BUTTON =
  'flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40';
const IDLE =
  'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';
const PRESSED =
  'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100';

export function ContentsAddPage({
  contents,
  end,
}: {
  contents: PageContents;
  // Put at the row's right: the docked sidebar's Minimise.
  end?: ReactNode;
}) {
  const { canAdd, add, addLike, lastPage, full } = contents;
  const [open, setOpen] = useState(false);
  const chooser = useRef<HTMLButtonElement>(null);
  const getAnchor = useCallback(() => chooser.current, []);
  // A Viewer (or a tab with no kind yet) has no Add Page; the sidebar's Minimise (`end`) still sits
  // at the foot's right.
  const endOnly = end ? (
    <div className="flex items-center justify-end border-t border-slate-100 p-3 dark:border-slate-800">
      {end}
    </div>
  ) : null;
  if (!canAdd || !lastPage) return endOnly;
  const another = addAnotherLabel(lastPage);
  const short = addPageLabel(lastPage);
  const limit = `A tab holds up to ${MAX_PAGES} pages`;
  const screens = lastPage.kind === 'wireframe' && add ? add : undefined;
  return (
    <div className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
      <Tooltip label={full ? limit : another}>
        {/* Reads Add Page, with the add icon; what it adds (another page like the last) is its tooltip, and its
            name says both, so the tooltip repeats the name. */}
        <button
          type="button"
          // Its name, and what the tooltip adds where that says more (a screen's device, the limit).
          aria-label={!full && another === short ? short : `${short}: ${full ? limit : another}`}
          disabled={full || !addLike}
          data-contents-add=""
          onClick={() => addLike?.()}
          className={`${BUTTON} ${IDLE} min-w-0 flex-1 px-3 py-2`}
        >
          <AddIcon />
          <span className="truncate">{short}</span>
        </button>
      </Tooltip>
      {lastPage.kind === 'wireframe' ? (
        <Tooltip label={full ? limit : ADD_SCREEN_LABEL}>
          <button
            ref={chooser}
            type="button"
            aria-label={ADD_SCREEN_LABEL}
            aria-haspopup="dialog"
            aria-expanded={open}
            disabled={full || !screens}
            data-add-page-trigger=""
            data-contents-add-screen=""
            onClick={() => setOpen((o) => !o)}
            className={`${BUTTON} h-[38px] w-[38px] shrink-0 ${open ? PRESSED : IDLE}`}
          >
            <ChooseIcon />
          </button>
        </Tooltip>
      ) : null}
      {open && screens ? (
        <AddScreenPopover
          getAnchor={getAnchor}
          onAddDevice={(device) => screens('wireframe', device)}
          onClose={(restoreFocus) => {
            setOpen(false);
            if (restoreFocus) chooser.current?.focus();
          }}
        />
      ) : null}
      {end}
    </div>
  );
}
