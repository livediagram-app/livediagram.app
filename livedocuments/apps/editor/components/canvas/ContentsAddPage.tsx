'use client';

// Contents' Add Page (docs/specs/007-editor/pages-mode.md "Contents"): the footer both of its homes
// (PageContentsPanel, PageContentsSidebar) end on, the canvas's + after the last page
// (AddPageButton) as a wide button: it adds another page like the last (its tooltip says what:
// "Add Slide"), always of the tab's kind ("One kind a tab"). At the page limit it is
// disabled, a Tooltip naming the limit. Docked, the sidebar's Minimise (`end`) sits to its right.
import { MAX_PAGES } from '@livedocuments/document';
import { lucidePlus } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedocuments/ui';
import type { ReactNode } from 'react';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { addAnotherLabel, addPageLabel } from '@/lib/add-page-labels';

const AddIcon = lucideGlyph(lucidePlus, 16);

const BUTTON =
  'flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40';
const IDLE =
  'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';

export function ContentsAddPage({
  contents,
  end,
}: {
  contents: PageContents;
  // Put to Add Page's right in its row: the docked sidebar's Minimise.
  end?: ReactNode;
}) {
  const { canAdd, add, addLike, lastPage, full } = contents;
  // A Viewer has no Add Page; the sidebar's Minimise (`end`) still sits at the foot's right.
  const endOnly = end ? (
    <div className="flex items-center justify-end border-t border-slate-100 p-3 dark:border-slate-800">
      {end}
    </div>
  ) : null;
  if (!canAdd) return endOnly;
  const another = lastPage ? addAnotherLabel(lastPage) : 'Add Page';
  const limit = `A tab holds up to ${MAX_PAGES} pages`;
  const short = addPageLabel(lastPage);
  return (
    <div className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
      <Tooltip label={full ? limit : another}>
        {/* Reads Add Page (Add Slide, Add Card, Add Article: what it adds), with the add icon; what it adds (another page
            like the last) is its tooltip. */}
        <button
          type="button"
          disabled={full || !(addLike ?? add)}
          // Its name, and what the tooltip adds where that says more (the limit, an infographic page).
          aria-label={!full && another === short ? short : `${short}: ${full ? limit : another}`}
          data-contents-add=""
          onClick={() => (addLike ? addLike() : add?.('infographic'))}
          // optical-edges pulls the leading + in by its blank margin, so the icon and label centre by their ink
          // (docs/specs/004-interface-design/optical-alignment.md "A chip is centred as a whole").
          className={`optical-edges ${BUTTON} ${IDLE} min-w-0 flex-1 px-3 py-2`}
        >
          <AddIcon />
          <span className="truncate">{short}</span>
        </button>
      </Tooltip>
      {end}
    </div>
  );
}
