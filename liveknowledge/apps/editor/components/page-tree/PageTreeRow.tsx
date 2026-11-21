'use client';

// One row of the page tree (docs/specs/030-knowledgebase/blueprints/page-tree.md "The sidebar"). Memoised on plain
// props, with no handler of its own: the tree listens once for every row (PageTree), and the row reads its own part
// of the pointer's state from the tree's store (page-tree-ui.ts), so a hover or a drag across 500 rows renders the
// rows it leaves and enters and no others. The row's buttons and its tooltip are mounted only while the row is under
// the pointer, holds focus or has its menu open; their room is always kept, so nothing shifts.
import { memo, type ReactNode } from 'react';
import { HoverCard, Tooltip } from '@liveknowledge/ui';
import { NameEditor } from '@liveworkspace/workbench/components/primitives/NameEditor';
import { TrustBadge } from '@/components/knowledge/TrustBadge';
import type { TrustMark } from '@/lib/knowledge/page-trust';
import { AddIcon, ChevronIcon, MoreIcon } from './page-tree-icons';
import { useRowMark, type PageTreeUi } from './page-tree-ui';
import { useLivePageTitle } from '@/lib/article/live-page-title';
import {
  PAGE_TREE_INDENT,
  PAGE_TREE_ROW,
  PAGE_TREE_TOUCH_ROW,
  type PageRow,
} from './page-tree-view';

// The row's left inset before its first level's indent.
const ROW_INSET = 8;

const ROW =
  'group relative flex w-full shrink-0 cursor-pointer select-none items-center gap-1 rounded-md pr-1 text-[13px] leading-5 outline-none motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 [-webkit-touch-callout:none]';
// The current page: the brand tint (brand-900 on brand-100 is over 4.5:1, page-tree-contrast.test.ts).
const ROW_CURRENT =
  'bg-brand-100 font-medium text-brand-900 dark:bg-brand-500/20 dark:text-brand-100';
// A row's buttons while it is not pointed at: there, but faint, so a long tree stays calm.
const QUIET = 'text-slate-400/70 dark:text-slate-400/60';
const ROW_REST = 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-slate-800';
const ROW_NEST = 'ring-2 ring-inset ring-brand-500';
const ROW_BUTTON =
  'flex shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-300/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100';
// Where a dragged page will land among its siblings: a 2px brand line on that edge of the row.
const INSERT_LINE = 'pointer-events-none absolute right-1 z-10 h-0.5 rounded-full bg-brand-500';

/** The field a page is renamed in, in its row. */
export const PAGE_RENAME_FIELD =
  'h-6 min-w-0 flex-1 rounded bg-white px-1.5 text-[13px] font-medium text-slate-900 outline-none ring-2 ring-brand-400 dark:bg-slate-800 dark:text-slate-100';

export type PageTreeRowProps = {
  row: PageRow;
  current: boolean;
  // The one row the Tab key lands on (roving tabindex).
  tabStop: boolean;
  editing: boolean;
  menuOpen: boolean;
  // May change the tree: the row drags, and shows Add Subpage.
  canEdit: boolean;
  // A tab outside a tab-scoped link's scope: named "Not Shared", and not opened.
  outOfScope: boolean;
  // A touch screen: taller rows, the menu button always there.
  touch: boolean;
  ui: PageTreeUi;
  // Who is on the page, drawn before the row's buttons.
  people?: ReactNode;
  // The page's verified state: a tick or a Review Due pill at the row's right; absent for a page never verified.
  trust?: TrustMark | undefined;
  onRename: (id: string, name: string) => void;
  onRenameDone: () => void;
};

function PageTreeRowView({
  row,
  current,
  tabStop,
  editing,
  menuOpen,
  canEdit,
  outOfScope,
  touch,
  ui,
  people,
  trust,
  onRename,
  onRenameDone,
}: PageTreeRowProps) {
  const mark = useRowMark(ui, row.id);
  const dragging = mark.includes('d');
  const zone = mark.endsWith('before')
    ? 'before'
    : mark.endsWith('after')
      ? 'after'
      : mark.endsWith('inside')
        ? 'inside'
        : null;
  // Under the pointer, holding focus, or its menu open: the row's controls are there.
  const active = menuOpen || mark.startsWith('h') || mark.includes('f');
  // The open page is named from its Title as it is typed (knowledgebases-and-pages.md "Name").
  const live = useLivePageTitle(current);
  const name = outOfScope ? 'Not Shared' : (live ?? row.name) || 'Untitled Page';
  const indent = ROW_INSET + (row.level - 1) * PAGE_TREE_INDENT;
  const hasSubpages = row.subpages > 0;
  const control = touch ? 'h-11 w-9' : 'h-6 w-6';
  const menuButton = (
    <button
      type="button"
      tabIndex={-1}
      data-row-action="menu"
      aria-label={`Page Options for ${name}`}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      className={`${ROW_BUTTON} ${control} ${active || menuOpen ? '' : QUIET}`}
    >
      <MoreIcon />
    </button>
  );
  const addButton = (
    <button
      type="button"
      tabIndex={-1}
      data-row-action="add"
      aria-label={`Add Subpage to ${name}`}
      className={`${ROW_BUTTON} ${control} ${active ? '' : QUIET}`}
    >
      <AddIcon />
    </button>
  );
  return (
    <div
      role="treeitem"
      // The state is part of the row's name: a screen reader hears it with the title.
      aria-label={trust ? `${name}, ${trust === 'verified' ? 'Verified' : 'Review Due'}` : name}
      aria-level={row.level}
      aria-posinset={row.position}
      aria-setsize={row.siblings}
      aria-selected={current}
      aria-current={current ? 'page' : undefined}
      aria-expanded={hasSubpages ? row.open : undefined}
      aria-disabled={outOfScope || undefined}
      tabIndex={tabStop ? 0 : -1}
      data-page-row={row.id}
      data-current={current || undefined}
      draggable={canEdit && !editing && !outOfScope}
      style={{ paddingLeft: indent, height: touch ? PAGE_TREE_TOUCH_ROW : PAGE_TREE_ROW }}
      className={`${ROW} ${current ? ROW_CURRENT : ROW_REST} ${zone === 'inside' ? ROW_NEST : ''} ${
        dragging ? 'opacity-50' : ''
      } ${outOfScope ? 'cursor-default text-slate-500 dark:text-slate-400' : ''}`}
    >
      {zone === 'before' ? (
        <span
          data-insert-line="before"
          className={`${INSERT_LINE} -top-px`}
          style={{ left: indent }}
        />
      ) : null}
      {zone === 'after' ? (
        <span
          data-insert-line="after"
          className={`${INSERT_LINE} -bottom-px`}
          // Dropped after an open page it becomes that page's first subpage: the line starts a level in.
          style={{ left: indent + (row.open ? PAGE_TREE_INDENT : 0) }}
        />
      ) : null}
      {hasSubpages ? (
        <button
          type="button"
          tabIndex={-1}
          data-row-action="toggle"
          aria-label={`${row.open ? 'Collapse' : 'Expand'} ${name}`}
          className={`${ROW_BUTTON} ${touch ? 'h-11 w-7' : 'h-5 w-5'}`}
        >
          <ChevronIcon
            className={`motion-safe:transition-transform motion-safe:duration-micro ${
              row.open ? 'rotate-90' : ''
            }`}
          />
        </button>
      ) : (
        <span aria-hidden className={`shrink-0 ${touch ? 'w-7' : 'w-5'}`} />
      )}
      {editing ? (
        <NameEditor
          label="Page name"
          initial={row.name}
          onCommit={(next) => {
            onRename(row.id, next);
            onRenameDone();
          }}
          onCancel={onRenameDone}
          className={PAGE_RENAME_FIELD}
        />
      ) : active ? (
        // The full title, for a row too narrow to show it.
        <Tooltip label={name}>
          <span data-page-title className="min-w-0 flex-1 truncate">
            {name}
          </span>
        </Tooltip>
      ) : (
        <span data-page-title className="min-w-0 flex-1 truncate">
          {name}
        </span>
      )}
      {trust && !editing && !outOfScope ? <TrustBadge mark={trust} compact /> : null}
      {people}
      {/* The row's buttons: their room is kept whether they are there or not, so a hover moves nothing. */}
      <span
        data-row-controls
        className={`flex shrink-0 items-center justify-end gap-0.5 ${touch ? 'w-9' : 'w-[50px]'}`}
      >
        {editing || outOfScope ? null : touch ? (
          menuButton
        ) : (
          // Always there (owner, 2026-11-21: "always keep the + and ... visible"), quiet until the row is pointed
          // at or current. Their hover cards are drawn on the active row only, so 500 rows carry 1,000 plain buttons
          // and no extra cards.
          <>
            {canEdit ? (
              active ? (
                <HoverCard title="Add Subpage" description="Adds a new page under this one.">
                  {addButton}
                </HoverCard>
              ) : (
                addButton
              )
            ) : null}
            {active ? (
              <HoverCard
                title="Page Options"
                description={
                  canEdit
                    ? 'Rename, move, duplicate or delete this page.'
                    : 'Copy a link to this page.'
                }
                disabled={menuOpen}
              >
                {menuButton}
              </HoverCard>
            ) : (
              menuButton
            )}
          </>
        )}
      </span>
    </div>
  );
}

// The tree reads its rows afresh whenever the list, what is closed or the current page changes, so a row's `row` is
// a new object each time: compared field by field, a row whose page did not change does not render.
function sameRowProps(a: PageTreeRowProps, b: PageTreeRowProps): boolean {
  for (const key of Object.keys(b) as (keyof PageTreeRowProps)[]) {
    if (Object.is(a[key], b[key])) continue;
    if (key !== 'row') return false;
    const [x, y] = [a.row, b.row];
    for (const field of Object.keys(y) as (keyof PageRow)[]) {
      if (x[field] !== y[field]) return false;
    }
  }
  return true;
}

export const PageTreeRow = memo(PageTreeRowView, sameRowProps);
