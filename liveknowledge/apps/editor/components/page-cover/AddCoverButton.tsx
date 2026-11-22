'use client';

// Add Cover, in the meta row after "N min read" (docs/specs/030-knowledgebase/page-surface.md "The cover"): a quiet
// ghost button the row's own size and colour, taking the accent on hover, for whoever may add a cover to a page
// with none. It opens the cover menu.
import { HoverCard } from '@liveknowledge/ui';
import { AddCoverIcon } from './cover-icons';
import { CoverMenu, useCoverMenu } from './CoverMenu';

export function AddCoverButton() {
  const menu = useCoverMenu();
  return (
    <>
      <HoverCard
        title="Add Cover"
        description="Add a picture or a gradient across the top of this page."
        disabled={menu.open}
      >
        <button
          type="button"
          data-add-cover=""
          aria-haspopup="dialog"
          aria-expanded={menu.open}
          onClick={(e) => menu.openFrom(e.currentTarget)}
          // The row's 13 px and slate, its height kept (min-h-7 on the row): the pill's padding is hover room only,
          // pulled back by its negative margin, so the words sit where plain text would.
          className={`-mx-1.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[13px] font-normal leading-5 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:text-slate-400 dark:hover:bg-brand-500/15 dark:hover:text-brand-200 ${
            menu.open ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : ''
          }`}
        >
          <AddCoverIcon />
          Add Cover
        </button>
      </HoverCard>
      <CoverMenu menu={menu} cover={undefined} />
    </>
  );
}
