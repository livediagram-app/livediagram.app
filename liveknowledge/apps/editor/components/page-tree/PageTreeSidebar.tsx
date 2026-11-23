'use client';

// The page tree as the editor's left sidebar (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page
// tree"): the knowledgebase's name (its menu's button), the pages, and New Page at its foot. It takes the docked sidebar's place in the
// canvas chrome (it is what the page framing and Zoom to Fit measure, `data-contents-sidebar`), joined to the menu box
// above it. Collapsed, it is a narrow rail with the way back; resting the pointer on the rail slides the whole tree out
// over the page until the pointer leaves it (page-surface.md "Sidebars slide"). Every open and close is a slide.
import { PageTreeLimit } from './PageTreeLimit';
import { openPagesMax } from '@/lib/knowledge-tier';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { pageAddRefusal } from '@liveknowledge/document';
import { HoverCard } from '@liveknowledge/ui';
import { MenuJoinBand } from '@liveworkspace/workbench/components/canvas/menu-join';
import { NameEditor } from '@liveworkspace/workbench/components/primitives/NameEditor';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { LabelFilterHeading } from '@/components/page-labels/LabelFilterHeading';
import { PageTree, type PageTreeProps } from './PageTree';
import { AddToSidebar } from './AddToSidebar';
import { PAGE_RENAME_FIELD } from './page-tree-row-styles';
import { AddIcon, CollapseIcon, ExpandIcon } from './page-tree-icons';
import { SearchField } from '@/components/knowledge/SearchField';
import { DescribeToSetUpButton } from '@/components/setup/DescribeToSetUpButton';
import { PAGE_TREE_RAIL_WIDTH, PAGE_TREE_WIDTH } from './page-tree-view';
import { useSlideOut } from '@/lib/ui/use-slide-out';
import { PageTrashRailButton, PageTrashRow } from '@/components/page-trash/PageTrashRow';

/** How long the pointer rests on the rail before the tree slides out, and lingers off it before it slides back (ms). */
export const PEEK_OPEN_MS = 150;
export const PEEK_CLOSE_MS = 300;

const SURFACE =
  'pointer-events-auto absolute bottom-0 z-[var(--z-panel)] flex cursor-default flex-col overflow-hidden border-r border-slate-200 bg-slate-50 text-slate-900 motion-safe:transition-[translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-x-full dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';
const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';
export { NEW_PAGE_BUTTON, NewPageButton } from './AddToSidebar';

/**
 * What the head hands the knowledgebase's menu: the name as shown, and how a rename starts in place (from the name typed
 * at the menu, when the person typed one: KnowledgebaseMenu's typed-rename.ts).
 */
export type KnowledgebaseHead = { name: string; onRename: ((typed?: string) => void) | undefined };

/** A rename under way in the head: `typed` is the name typed at the menu that started it, if any. */
export type HeadRename = { typed?: string | undefined };

export type PageTreeSidebarProps = PageTreeProps & {
  // The knowledgebase's name, and its rename where the session may rename it.
  name: string;
  onRenameKnowledgebase?: ((name: string) => void) | undefined;
  // The knowledgebase's menu in the head, where the editor's store is there to decide its rows (the host,
  // usePageTreeChrome); without one the head is the name alone.
  menu?: ((head: KnowledgebaseHead) => ReactNode) | undefined;
  collapsed: boolean;
  onSetCollapsed: (collapsed: boolean) => void;
  // Where it starts, in screen px from the canvas's top: the menu box's row open, the top row as a rail.
  top: number;
  // Joined to the menu box above it: it rises to the canvas's top, its first `top` px the menu box's row.
  joined: boolean;
  // The knowledgebase's page Trash row, above New Page, where this session may see the Trash.
  trash?: boolean;
};

// The foot's Hide Pages: bordered, as livedocuments' Contents Options beside Add Page.
const FOOT_BUTTON =
  'flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 phone:w-11 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';

export function PageTreeSidebar({
  name,
  onRenameKnowledgebase,
  menu,
  collapsed,
  onSetCollapsed,
  top,
  joined,
  trash = false,
  ...tree
}: PageTreeSidebarProps) {
  const scale = useUiScale('panels');
  const px = (v: number) => toSurfacePx(v, scale);
  const [renaming, setRenaming] = useState<HeadRename | null>(null);
  // Open, the tree slides out to the left before the rail takes its place.
  const open = useSlideOut(!collapsed);
  // The peek: the whole tree over the page while the pointer rests on the rail.
  const [peek, setPeek] = useState(false);
  const peeking = useSlideOut(collapsed && peek);
  const peekRef = useRef<HTMLElement>(null);
  const timer = useRef(0);
  const clearTimer = () => window.clearTimeout(timer.current);
  useEffect(() => clearTimer, []);
  // Opening or folding the tree ends a peek, so the next fold starts from the rail alone.
  const setTreeCollapsed = (next: boolean) => {
    clearTimer();
    setPeek(false);
    onSetCollapsed(next);
  };
  const startPeek = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimer();
    timer.current = window.setTimeout(() => setPeek(true), PEEK_OPEN_MS);
  }, []);
  const endPeek = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimer();
    timer.current = window.setTimeout(() => {
      // A menu opened from the peek (the knowledgebase's, a row's) holds it open until it closes.
      if (peekRef.current?.querySelector('[aria-haspopup][aria-expanded="true"]')) return;
      setPeek(false);
    }, PEEK_CLOSE_MS);
  }, []);
  const shell = (
    width: number,
    rise: boolean,
    children: ReactNode,
    over?: { kind: 'leaving' | 'peek'; leaving: boolean },
    key = 'rail',
  ) => (
    <aside
      key={key}
      ref={over?.kind === 'peek' ? peekRef : undefined}
      aria-label="Pages"
      aria-hidden={over?.kind === 'leaving' ? true : undefined}
      // The framing measures the sidebar the page stands beside, never one sliding over it.
      {...(over ? { 'data-page-tree-over': over.kind } : { 'data-contents-sidebar': '' })}
      data-page-tree={over?.kind === 'peek' ? 'peek' : collapsed && !over ? 'rail' : 'open'}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      {...(over?.kind === 'peek'
        ? { onPointerEnter: clearTimer, onPointerLeave: endPeek }
        : collapsed && !over
          ? { onPointerEnter: startPeek, onPointerLeave: endPeek }
          : {})}
      style={{ ...uiScaleStyle(scale), left: 0, top: rise ? 0 : px(top), width }}
      className={`${SURFACE} ${over ? 'shadow-xl' : ''} ${over?.leaving ? '-translate-x-full' : ''} ${
        over?.kind === 'leaving' ? 'pointer-events-none' : ''
      }`}
    >
      {children}
    </aside>
  );
  // The rail stands under the top row, which the logo and the menu button lead while nothing is joined to it.
  const rail = shell(
    PAGE_TREE_RAIL_WIDTH,
    false,
    <div className="flex flex-col items-center gap-1 py-2">
      <HoverCard title="Show Pages" description="Opens the page tree.">
        <button
          type="button"
          aria-label="Show Pages"
          aria-expanded={false}
          data-page-tree-expand=""
          onClick={() => setTreeCollapsed(false)}
          className={ICON_BUTTON}
        >
          <ExpandIcon />
        </button>
      </HoverCard>
      <SearchField compact />
      {tree.canEdit ? (
        <HoverCard
          title="New Page"
          description="Adds a page at the top level of this knowledgebase."
        >
          <button
            type="button"
            aria-label="New Page"
            disabled={pageAddRefusal(tree.tabs, undefined, openPagesMax()) !== null}
            onClick={() => tree.actions.onAdd()}
            className={`${ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <AddIcon />
          </button>
        </HoverCard>
      ) : null}
      {trash ? <PageTrashRailButton className={ICON_BUTTON} /> : null}
    </div>,
  );
  const shownName = name.trim() || 'Untitled Knowledgebase';
  const body = (mode: 'open' | 'peek', withBand: boolean) => (
    <>
      {withBand ? <MenuJoinBand height={px(top)} /> : null}
      {/* The knowledgebase's name has the row to itself: Hide Pages sits at the sidebar's foot, left of New Page
          (owner 2026-11-21: "so the knowledgebase name can stretch further"). */}
      <div className="flex min-h-11 items-center gap-1 pl-3 pr-3 pt-2">
        {renaming && onRenameKnowledgebase ? (
          <NameEditor
            label="Knowledgebase name"
            initial={name}
            typed={renaming.typed}
            onCommit={(next) => {
              onRenameKnowledgebase(next);
              setRenaming(null);
            }}
            onCancel={() => setRenaming(null)}
            className={`${PAGE_RENAME_FIELD} h-8 text-sm`}
          />
        ) : menu ? (
          // The name is its menu's button (knowledgebases-and-pages.md "The knowledgebase's menu"): Rename is a row.
          menu({
            name: shownName,
            onRename: onRenameKnowledgebase ? (typed) => setRenaming({ typed }) : undefined,
          })
        ) : (
          <p
            data-knowledgebase-name=""
            className="min-w-0 flex-1 truncate px-1.5 py-1 text-sm font-semibold"
          >
            {shownName}
          </p>
        )}
      </div>
      {/* Search the knowledgebase (search-and-ask.md "Search"): the same dialog Cmd or Ctrl K opens. */}
      <div className="px-3 pt-2">
        <SearchField />
      </div>
      {/* The Pages heading, with Filter by Label and its bar (page-surface.md "The label filter"). */}
      <LabelFilterHeading only={tree.only} inset="px-[18px]" top="pt-3" />
      {/* The pages, then the Trash as the list's last item, scrolling together (knowledgebases-and-pages.md "The page
          Trash"); the row draws nothing while the Trash is empty. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2">
        <PageTree {...tree} />
        {trash ? <PageTrashRow /> : null}
      </div>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        {/* Knowledgebase Pages, with Pro on, from 80% of the limit (tiers.md). */}
        <PageTreeLimit tabs={tree.tabs} />
        {/* Describe to Set Up, while the knowledgebase is empty (describe-to-set-up.md "The control"). */}
        {tree.canEdit ? <DescribeToSetUpButton /> : null}
        {/* Hide Pages (or Keep Pages Open while it peeks) is a bordered button at the foot's right, after New Page, as
            livedocuments' Contents Options sits beside Add Page (owner 2026-11-21); a reader has it alone, at the right. */}
        <div data-page-tree-foot-row="" className="flex items-center justify-end gap-1.5">
          {tree.canEdit ? (
            <div className="min-w-0 flex-1">
              <AddToSidebar
                tabs={tree.tabs}
                onAdd={() => tree.actions.onAdd()}
                onConnect={
                  tree.connected?.canConnect ? () => tree.connected?.onConnect() : undefined
                }
              />
            </div>
          ) : null}
          {mode === 'peek' ? (
            <HoverCard
              title="Keep Pages Open"
              description="Keeps the page tree open beside the page."
            >
              <button
                type="button"
                aria-label="Keep Pages Open"
                data-page-tree-pin=""
                onClick={() => setTreeCollapsed(false)}
                className={FOOT_BUTTON}
              >
                <ExpandIcon />
              </button>
            </HoverCard>
          ) : (
            <HoverCard title="Hide Pages" description="Collapses the page tree to a narrow rail.">
              <button
                type="button"
                aria-label="Hide Pages"
                aria-expanded
                data-page-tree-collapse=""
                onClick={() => setTreeCollapsed(true)}
                className={FOOT_BUTTON}
              >
                <CollapseIcon />
              </button>
            </HoverCard>
          )}
        </div>
      </div>
    </>
  );
  // One element for the open tree, whether it stands beside the page or is sliding out over the rail, so folding it
  // away animates it rather than swapping it for a copy.
  return (
    <>
      {!collapsed
        ? shell(PAGE_TREE_WIDTH, joined, body('open', joined), undefined, 'open')
        : open.drawn
          ? shell(
              PAGE_TREE_WIDTH,
              false,
              body('open', false),
              { kind: 'leaving', leaving: open.leaving },
              'open',
            )
          : null}
      {collapsed ? rail : null}
      {peeking.drawn
        ? shell(
            PAGE_TREE_WIDTH,
            false,
            body('peek', false),
            { kind: 'peek', leaving: peeking.leaving },
            'peek',
          )
        : null}
    </>
  );
}
