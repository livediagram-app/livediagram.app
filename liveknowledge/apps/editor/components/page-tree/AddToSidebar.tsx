'use client';

// The sidebar's foot (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the sidebar"): New Page,
// and beside it Add to Sidebar, whose menu holds Connect File (a file from another app, which opens in a new browser
// tab); New Page is the button beside it, so the menu does not repeat it (owner 2026-11-21). A menu, for more to come. Without Connect File (offline, no account, a link confined to one page) the foot is New Page
// alone.
import { openPagesMax } from '@/lib/knowledge-tier';
import { useState } from 'react';
import { pageAddRefusal } from '@liveknowledge/document';
import { HoverCard, WorkspaceMark } from '@liveknowledge/ui';
import {
  MenuActionRow,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { pageTreeRefusalText } from '@/hooks/persistence/page-tree-edits';
import { AddIcon, MoreToAddIcon } from './page-tree-icons';
import type { PageTreeProps } from './PageTree';

/** The dashed button that adds a page (the sidebar's foot, the phone sheet's). */
// New Page and its chevron wear the foot's bordered look, as Hide Pages beside them (owner 2026-11-21).
export const NEW_PAGE_BUTTON =
  'optical-edges flex h-[38px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-600 motion-safe:transition-colors motion-safe:duration-micro hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 phone:h-11 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';

/** New Page: adds a top-level page. At the page limit it is disabled and says why. */
export function NewPageButton({ tabs, onAdd }: { tabs: PageTreeProps['tabs']; onAdd: () => void }) {
  const refused = pageAddRefusal(tabs, undefined, openPagesMax());
  return (
    <HoverCard
      block
      title="New Page"
      description={
        refused
          ? pageTreeRefusalText(refused)
          : 'Adds a page at the top level of this knowledgebase.'
      }
    >
      <button
        type="button"
        data-new-page=""
        disabled={refused !== null}
        onClick={onAdd}
        className={NEW_PAGE_BUTTON}
      >
        <AddIcon />
        <span className="truncate">New Page</span>
      </button>
    </HoverCard>
  );
}

// The New Page button's dashed look, square, so the two read as one foot.
const MORE_BUTTON =
  'flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 motion-safe:transition-colors motion-safe:duration-micro hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 aria-expanded:border-brand-300 aria-expanded:bg-brand-50 aria-expanded:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100 dark:aria-expanded:border-brand-400/60 dark:aria-expanded:bg-brand-500/20 dark:aria-expanded:text-brand-100';

export function AddToSidebar({
  tabs,
  onAdd,
  onConnect,
  touch = false,
}: {
  tabs: PageTreeProps['tabs'];
  onAdd: () => void;
  // Connect File, where it is offered; absent, the foot is New Page alone.
  onConnect?: (() => void) | undefined;
  touch?: boolean;
}) {
  // The button the menu hangs from while it is open.
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const open = anchor !== null;
  const setOpen = (_: false) => setAnchor(null);
  if (!onConnect) return <NewPageButton tabs={tabs} onAdd={onAdd} />;
  return (
    <div className="flex items-stretch gap-1.5" data-add-to-sidebar="">
      <div className="min-w-0 flex-1">
        <NewPageButton tabs={tabs} onAdd={onAdd} />
      </div>
      <HoverCard
        title="Add to Sidebar"
        description="A file from another app, opening in a new tab."
        disabled={open}
      >
        <button
          type="button"
          aria-label="Add to Sidebar"
          aria-haspopup="menu"
          aria-expanded={open}
          data-add-to-sidebar-menu=""
          onClick={(e) => setAnchor(open ? null : e.currentTarget)}
          className={`${MORE_BUTTON} ${touch ? 'h-11 w-11' : 'h-full min-h-9 w-9'}`}
        >
          <MoreToAddIcon />
        </button>
      </HoverCard>
      {open ? (
        <PortalMenu
          anchor={anchor}
          placement="above"
          onClose={() => setOpen(false)}
          label="Add to Sidebar"
        >
          <MenuHeader title="Add to Sidebar" />
          <MenuActionRow
            plain
            label="Connect File"
            // liveworkspace's mark: the file comes from another of its apps (owner 2026-11-21).
            icon={<WorkspaceMark className="size-4" />}
            onClick={() => {
              setOpen(false);
              onConnect();
            }}
          />
        </PortalMenu>
      ) : null}
    </div>
  );
}
