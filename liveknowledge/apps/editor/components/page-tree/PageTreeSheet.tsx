'use client';

// The page tree on a phone (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "On a phone the tree is a sheet
// opened from the top bar"): a Pages button in the top row, and the same tree in the shared bottom sheet, its rows 44px tall.
// Choosing a page closes the sheet.
import { useMemo, useState, type ReactNode } from 'react';
import { NameEditor } from '@liveworkspace/workbench/components/primitives/NameEditor';
import { HoverCard } from '@liveknowledge/ui';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { SearchField } from '@/components/knowledge/SearchField';
import { DescribeToSetUpButton } from '@/components/setup/DescribeToSetUpButton';
import { PageTree, type PageTreeProps } from './PageTree';
import { NewPageButton, type KnowledgebaseHead } from './PageTreeSidebar';
import { PAGE_RENAME_FIELD } from './PageTreeRow';
import { PagesIcon } from './page-tree-icons';

export function PageTreeSheet({
  name,
  onRenameKnowledgebase,
  menu,
  ...tree
}: PageTreeProps & {
  name: string;
  onRenameKnowledgebase?: ((name: string) => void) | undefined;
  // The knowledgebase's menu in the sheet's head (PageTreeSidebar's `menu`); `close` closes the sheet.
  menu?: ((head: KnowledgebaseHead & { close: () => void }) => ReactNode) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const shownName = name.trim() || 'Untitled Knowledgebase';
  const { actions } = tree;
  // Opening a page, or adding one, is what the sheet was for: it closes.
  const sheetActions = useMemo(
    () => ({
      ...actions,
      onSelect: (id: string) => {
        setOpen(false);
        actions.onSelect(id);
      },
      onAdd: (parent?: string) => {
        setOpen(false);
        actions.onAdd(parent);
      },
    }),
    [actions],
  );
  return (
    <>
      <HoverCard title="Pages" description="Opens this knowledgebase's page tree.">
        <button
          type="button"
          aria-label="Pages"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-page-tree-button=""
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-700 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <PagesIcon />
          <span>Pages</span>
        </button>
      </HoverCard>
      {open ? (
        <BottomSheet
          role="dialog"
          aria-label="Pages"
          data-page-tree="sheet"
          onClose={() => setOpen(false)}
          zClassName="z-[var(--z-modal)]"
          flush
        >
          {renaming && onRenameKnowledgebase ? (
            <div className="px-4 pb-1 pt-1">
              <NameEditor
                label="Knowledgebase name"
                initial={name}
                onCommit={(next) => {
                  onRenameKnowledgebase(next);
                  setRenaming(false);
                }}
                onCancel={() => setRenaming(false)}
                className={`${PAGE_RENAME_FIELD} h-11 text-base`}
              />
            </div>
          ) : menu ? (
            // The same menu as the sidebar's head, its button 44 px tall.
            <div className="flex px-2.5 pb-1 pt-1">
              {menu({
                name: shownName,
                onRename: onRenameKnowledgebase ? () => setRenaming(true) : undefined,
                close: () => setOpen(false),
              })}
            </div>
          ) : (
            <p className="truncate px-4 pb-1 pt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {shownName}
            </p>
          )}
          <div className="px-4 pb-1 pt-2">
            <SearchField />
          </div>
          <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Pages
          </p>
          <PageTree {...tree} actions={sheetActions} touch className="px-2 pb-2" />
          {tree.canEdit ? (
            <div className="border-t border-slate-200 p-3 dark:border-slate-800">
              {/* Describe to Set Up, while the knowledgebase is empty (describe-to-set-up.md "The control"): its
                  dialog opens over the page, so the sheet closes. */}
              <DescribeToSetUpButton onOpen={() => setOpen(false)} />
              <NewPageButton tabs={tree.tabs} onAdd={() => sheetActions.onAdd()} />
            </div>
          ) : null}
        </BottomSheet>
      ) : null}
    </>
  );
}
