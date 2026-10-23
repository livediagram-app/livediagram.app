'use client';

// Contents' Add Page (docs/specs/007-editor/pages-mode.md "Contents"): the footer both of its homes
// (PageContentsPanel, PageContentsSidebar) end on, the same pair the canvas's + after the last page
// is (AddPageButton): a wide Add Page button that adds another page like the last (its tooltip says
// what: "Add Another Slide"; a wireframe page's device and frame too), and beside it one that opens Add a
// Page (AddPagePopover) to choose a page of any kind. At the page limit both are disabled, a Tooltip
// naming the limit.
import { useCallback, useRef, useState } from 'react';
import { MAX_PAGES } from '@livedesign/design';
import { lucideLayoutGrid, lucidePlus } from '@livedesign/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { addAnotherLabel } from '@/lib/add-page-labels';
import { AddPagePopover } from './AddPagePopover';

const ChooseIcon = lucideGlyph(lucideLayoutGrid, 16);
const AddIcon = lucideGlyph(lucidePlus, 16);

const BUTTON =
  'flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40';
const IDLE =
  'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';
const PRESSED =
  'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100';

export function ContentsAddPage({ contents }: { contents: PageContents }) {
  const { canAdd, add, addLike, lastPage, full } = contents;
  const [open, setOpen] = useState(false);
  const chooser = useRef<HTMLButtonElement>(null);
  const getAnchor = useCallback(() => chooser.current, []);
  if (!canAdd) return null;
  const another = lastPage ? addAnotherLabel(lastPage) : 'Add Page';
  const limit = `A tab holds up to ${MAX_PAGES} pages`;
  // Reads Add Page, with the add icon; what it adds (another page like the last) is its tooltip.
  const like = (
    <button
      type="button"
      disabled={full || !(addLike ?? add)}
      data-contents-add=""
      onClick={() => (addLike ? addLike() : add?.('logo'))}
      className={`${BUTTON} ${IDLE} min-w-0 flex-1 px-3 py-2`}
    >
      <AddIcon />
      <span className="truncate">Add Page</span>
    </button>
  );
  const choose = (
    <button
      ref={chooser}
      type="button"
      aria-label="Add a Page of Any Kind"
      aria-haspopup="dialog"
      aria-expanded={open}
      disabled={full}
      data-add-page-trigger=""
      data-contents-add-any=""
      onClick={() => setOpen((o) => !o)}
      className={`${BUTTON} h-[38px] w-[38px] shrink-0 ${open ? PRESSED : IDLE}`}
    >
      <ChooseIcon />
    </button>
  );
  return (
    <div className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
      <Tooltip label={full ? limit : another}>{like}</Tooltip>
      <Tooltip label={full ? limit : 'Add a Page of Any Kind'}>{choose}</Tooltip>
      {open && add ? (
        <AddPagePopover
          getAnchor={getAnchor}
          onAdd={add}
          onClose={(restoreFocus) => {
            setOpen(false);
            if (restoreFocus) chooser.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
