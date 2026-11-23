'use client';

// Add Icon, in the meta row right after Add Cover (docs/specs/030-knowledgebase/page-surface.md "The page icon"): the
// same quiet ghost button as Add Cover, for whoever may give a page with none an icon, read or edited. It opens the
// icon picker. No tooltip: its words say it (owner 2026-11-23).
import { AddIconIcon } from './page-icon-icons';
import { PageIconPicker, usePageIconPicker } from './PageIconPicker';

export function AddIconButton() {
  const picker = usePageIconPicker();
  return (
    <>
      <button
        type="button"
        data-add-icon=""
        aria-haspopup="dialog"
        aria-expanded={picker.open}
        onClick={(e) => picker.openFrom(e.currentTarget)}
        // Add Cover's look (AddCoverButton): the row's 13 px and slate, hover room pulled back by its margin.
        className={`-mx-1.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[13px] font-normal leading-5 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:text-slate-400 dark:hover:bg-brand-500/15 dark:hover:text-brand-200 ${
          picker.open ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : ''
        }`}
      >
        <AddIconIcon />
        Add Icon
      </button>
      <PageIconPicker picker={picker} icon={undefined} />
    </>
  );
}
