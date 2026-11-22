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
import { APPROVAL_MARK_LABEL, type ApprovalMark } from '@/lib/knowledge/approval-view';
import { AddIcon, ChevronIcon, MoreIcon } from './page-tree-icons';
import { useRowMark, type PageTreeUi } from './page-tree-ui';
import { useLivePageTitle } from '@/lib/article/live-page-title';
import { pageIconOfKey } from '@liveknowledge/document';
import { PageIconGlyph } from '@/components/page-icon/PageIconGlyph';
import {
  INSERT_LINE,
  PAGE_RENAME_FIELD,
  QUIET,
  ROW,
  ROW_BUTTON,
  ROW_CURRENT,
  ROW_INSET,
  ROW_NEST,
  ROW_REST,
} from './page-tree-row-styles';
import {
  PAGE_TREE_INDENT,
  PAGE_TREE_ROW,
  PAGE_TREE_TOUCH_ROW,
  type PageRow,
} from './page-tree-view';

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
  // Pending Approval or Rejected: a 6 px dot after the title (approval.md "Where it shows").
  approval?: ApprovalMark | undefined;
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
  approval,
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
  const icon = outOfScope ? undefined : pageIconOfKey(row.icon);
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
      aria-label={[
        name,
        ...(trust ? [trust === 'verified' ? 'Verified' : 'Review Due'] : []),
        ...(approval ? [APPROVAL_MARK_LABEL[approval]] : []),
      ].join(', ')}
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
      {icon ? <PageIconGlyph icon={icon} size={16} className="mr-1.5" /> : null}
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
      {approval && !editing && !outOfScope ? (
        <span
          aria-hidden
          // Named in the row's own label for a screen reader; the meta row's pill says it in words.
          data-approval-dot={approval}
          className={`size-1.5 shrink-0 rounded-full ${approval === 'pending' ? 'bg-violet-500 dark:bg-violet-400' : 'bg-rose-500 dark:bg-rose-400'}`}
        />
      ) : null}
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
