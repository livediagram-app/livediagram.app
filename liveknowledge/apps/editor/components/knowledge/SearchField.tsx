'use client';

// The Search field at the head of the page tree (docs/specs/030-knowledgebase/search-and-ask.md "Search"): a press
// opens the search dialog, as Cmd or Ctrl K does. `compact` is the collapsed rail's, an icon alone.
import { HoverCard } from '@liveknowledge/ui';
import { knowledgeSearch } from '@/lib/knowledge/search-open';
import { track } from '@/lib/telemetry';
import { SearchIcon } from './knowledge-icons';

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

const open = () => {
  if (!knowledgeSearch.isOpen()) track('UI', 'Opened', 'KnowledgeSearch');
  knowledgeSearch.open();
};

export function SearchField({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <HoverCard title="Search" description="Search this knowledgebase's pages.">
        <button
          type="button"
          aria-label="Search"
          aria-haspopup="dialog"
          data-knowledge-search-door=""
          onClick={open}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <SearchIcon />
        </button>
      </HoverCard>
    );
  return (
    <button
      type="button"
      aria-label="Search"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      data-knowledge-search-door=""
      onClick={open}
      className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-[13px] text-slate-500 motion-safe:transition-colors motion-safe:duration-micro hover:border-slate-300 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
    >
      <SearchIcon className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">Search</span>
      <kbd
        aria-hidden
        className="shrink-0 rounded border border-slate-200 px-1 font-sans text-[11px] text-slate-500 phone:hidden dark:border-slate-700 dark:text-slate-400"
      >
        {isMac() ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
