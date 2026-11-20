'use client';

// The page tree as the editor's left sidebar (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page
// tree"): the knowledgebase's name, the pages, and New Page at its foot. It takes the docked sidebar's place in the
// canvas chrome (it is what the page framing and Zoom to Fit measure, `data-contents-sidebar`), joined to the menu box
// above it. Collapsed, it is a narrow rail with the way back.
import { useState, type ReactNode } from 'react';
import { pageAddRefusal } from '@liveknowledge/document';
import { HoverCard } from '@liveknowledge/ui';
import { MenuJoinBand } from '@liveworkspace/workbench/components/canvas/menu-join';
import { NameEditor } from '@liveworkspace/workbench/components/primitives/NameEditor';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { pageTreeRefusalText } from '@/hooks/persistence/page-tree-edits';
import { PageTree, type PageTreeProps } from './PageTree';
import { PAGE_RENAME_FIELD } from './PageTreeRow';
import { AddIcon, CollapseIcon, ExpandIcon } from './page-tree-icons';
import { PAGE_TREE_RAIL_WIDTH, PAGE_TREE_WIDTH } from './page-tree-view';

const SURFACE =
  'pointer-events-auto absolute bottom-0 z-[var(--z-panel)] flex cursor-default flex-col overflow-hidden border-r border-slate-200 bg-slate-50 text-slate-900 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-x-3 motion-safe:starting:opacity-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';
const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';
/** The dashed button that adds a page (the sidebar's foot, the phone sheet's). */
export const NEW_PAGE_BUTTON =
  'optical-edges flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-600 motion-safe:transition-colors motion-safe:duration-micro hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';

/** New Page: adds a top-level page. At the page limit it is disabled and says why. */
export function NewPageButton({ tabs, onAdd }: { tabs: PageTreeProps['tabs']; onAdd: () => void }) {
  const refused = pageAddRefusal(tabs);
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

export type PageTreeSidebarProps = PageTreeProps & {
  // The knowledgebase's name, and its rename where the session may rename it.
  name: string;
  onRenameKnowledgebase?: ((name: string) => void) | undefined;
  collapsed: boolean;
  onSetCollapsed: (collapsed: boolean) => void;
  // Where it starts, in screen px from the canvas's top: below the menu box's row.
  top: number;
  // Joined to the menu box above it: it rises to the canvas's top, its first `top` px the menu box's row.
  joined: boolean;
};

export function PageTreeSidebar({
  name,
  onRenameKnowledgebase,
  collapsed,
  onSetCollapsed,
  top,
  joined,
  ...tree
}: PageTreeSidebarProps) {
  const scale = useUiScale('panels');
  const px = (v: number) => toSurfacePx(v, scale);
  const [renaming, setRenaming] = useState(false);
  const shell = (width: number, rise: boolean, children: ReactNode) => (
    <aside
      aria-label="Pages"
      data-contents-sidebar=""
      data-page-tree={collapsed ? 'rail' : 'open'}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ ...uiScaleStyle(scale), left: 0, top: rise ? 0 : px(top), width }}
      className={`${SURFACE} ${rise ? '' : 'rounded-tr-xl border-t'}`}
    >
      {children}
    </aside>
  );
  if (collapsed) {
    // The rail stands under the menu box, which keeps its own card while nothing is joined to it.
    return shell(
      PAGE_TREE_RAIL_WIDTH,
      false,
      <div className="flex flex-col items-center gap-1 py-2">
        <HoverCard title="Show Pages" description="Opens the page tree.">
          <button
            type="button"
            aria-label="Show Pages"
            aria-expanded={false}
            data-page-tree-expand=""
            onClick={() => onSetCollapsed(false)}
            className={ICON_BUTTON}
          >
            <ExpandIcon />
          </button>
        </HoverCard>
        {tree.canEdit ? (
          <HoverCard
            title="New Page"
            description="Adds a page at the top level of this knowledgebase."
          >
            <button
              type="button"
              aria-label="New Page"
              disabled={pageAddRefusal(tree.tabs) !== null}
              onClick={() => tree.actions.onAdd()}
              className={`${ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <AddIcon />
            </button>
          </HoverCard>
        ) : null}
      </div>,
    );
  }
  const shownName = name.trim() || 'Untitled Knowledgebase';
  return shell(
    PAGE_TREE_WIDTH,
    joined,
    <>
      {joined ? <MenuJoinBand height={px(top)} /> : null}
      <div className="flex min-h-11 items-center gap-1 pl-3 pr-2 pt-2">
        {renaming && onRenameKnowledgebase ? (
          <NameEditor
            label="Knowledgebase name"
            initial={name}
            onCommit={(next) => {
              onRenameKnowledgebase(next);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
            className={`${PAGE_RENAME_FIELD} h-8 text-sm`}
          />
        ) : onRenameKnowledgebase ? (
          <HoverCard
            block
            className="min-w-0 flex-1"
            title={shownName}
            description="Rename this knowledgebase."
          >
            <button
              type="button"
              data-knowledgebase-name=""
              onClick={() => setRenaming(true)}
              className="min-w-0 flex-1 cursor-text truncate rounded-md px-1.5 py-1 text-left text-sm font-semibold text-slate-900 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-200/70 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {shownName}
            </button>
          </HoverCard>
        ) : (
          <p
            data-knowledgebase-name=""
            className="min-w-0 flex-1 truncate px-1.5 py-1 text-sm font-semibold"
          >
            {shownName}
          </p>
        )}
        <HoverCard title="Hide Pages" description="Collapses the page tree to a narrow rail.">
          <button
            type="button"
            aria-label="Hide Pages"
            aria-expanded
            data-page-tree-collapse=""
            onClick={() => onSetCollapsed(true)}
            className={ICON_BUTTON}
          >
            <CollapseIcon />
          </button>
        </HoverCard>
      </div>
      <p className="px-[18px] pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Pages
      </p>
      <PageTree {...tree} className="flex-1 px-1.5 pb-2" />
      {tree.canEdit ? (
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <NewPageButton tabs={tree.tabs} onAdd={() => tree.actions.onAdd()} />
        </div>
      ) : null}
    </>,
  );
}
