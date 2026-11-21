'use client';

// A connected file's row in the page tree (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the
// sidebar"): its app's logo, its name and an arrow-out mark, standing among the pages as one of them. It is a real
// link once the index has said where it leads (`target="_blank"`, `noopener`), so a press, a middle click and
// Cmd-click open the file in a new browser tab and the page you are on stays. A file that opens nothing is amber,
// with Can't Open and a hover card that says why. Like a page's row it has no handler of its own (PageTree listens
// for every row) and reads its own answer from the store, so an answer arriving renders this row alone.
import { memo, useEffect, useSyncExternalStore } from 'react';
import { AppMark, HoverCard, Tooltip } from '@liveknowledge/ui';
import { appName } from '@liveworkspace/workbench/components/connect/connect-words';
import { REVIEW_DUE_PILL } from '@/components/knowledge/TrustBadge';
import type { ConnectedRowStore } from '@/lib/knowledge/connected-row-store';
import { cantOpenWords } from './connected-rows';
import { ArrowOutIcon, MoreIcon } from './page-tree-icons';
import { INSERT_LINE, QUIET, ROW, ROW_BUTTON, ROW_INSET, ROW_REST } from './page-tree-row-styles';
import { useRowMark, type PageTreeUi } from './page-tree-ui';
import {
  PAGE_TREE_INDENT,
  PAGE_TREE_ROW,
  PAGE_TREE_TOUCH_ROW,
  type PageRow,
} from './page-tree-view';

export type ConnectedTreeRowProps = {
  row: PageRow;
  tabStop: boolean;
  menuOpen: boolean;
  // May change the tree: the row drags.
  canEdit: boolean;
  touch: boolean;
  ui: PageTreeUi;
  store: ConnectedRowStore;
};

function ConnectedTreeRowView({
  row,
  tabStop,
  menuOpen,
  canEdit,
  touch,
  ui,
  store,
}: ConnectedTreeRowProps) {
  const connectionId = row.connectionId!;
  const app = row.app!;
  const mark = useRowMark(ui, row.id);
  const state = useSyncExternalStore(
    store.subscribe,
    () => store.stateOf(connectionId),
    () => store.stateOf(connectionId),
  );
  // Asked once the row is drawn: the store asks each connection once a session, a few at once.
  useEffect(() => {
    store.request(connectionId);
  }, [store, connectionId]);
  const dragging = mark.includes('d');
  const zone = mark.endsWith('before') ? 'before' : mark.endsWith('after') ? 'after' : null;
  const active = menuOpen || mark.startsWith('h') || mark.includes('f');
  const name = row.name || 'Untitled File';
  const indent = ROW_INSET + (row.level - 1) * PAGE_TREE_INDENT;
  const broken = state.kind === 'broken';
  const where = appName(app);
  const label = broken ? `${name}, ${where}, Can't Open` : `${name}, ${where}, opens in a new tab`;
  const control = touch ? 'h-11 w-9' : 'h-6 w-6';
  const menuButton = (
    <button
      type="button"
      tabIndex={-1}
      data-row-action="menu"
      aria-label={`File Options for ${name}`}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      className={`${ROW_BUTTON} ${control} ${active || menuOpen ? '' : QUIET}`}
    >
      <MoreIcon />
    </button>
  );
  const title = (
    <span data-page-title className="min-w-0 truncate">
      {name}
    </span>
  );
  return (
    <a
      role="treeitem"
      aria-label={label}
      aria-level={row.level}
      aria-posinset={row.position}
      aria-setsize={row.siblings}
      aria-selected={false}
      tabIndex={tabStop ? 0 : -1}
      data-page-row={row.id}
      data-connected-row={state.kind}
      {...(state.kind === 'ready' ? { href: state.href, target: '_blank', rel: 'noopener' } : {})}
      draggable={canEdit}
      style={{ paddingLeft: indent, height: touch ? PAGE_TREE_TOUCH_ROW : PAGE_TREE_ROW }}
      className={`${ROW} ${ROW_REST} no-underline ${dragging ? 'opacity-50' : ''}`}
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
          style={{ left: indent }}
        />
      ) : null}
      {/* The chevron's room, so the logo stands where a page's chevron does and the names line up. */}
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center ${touch ? 'w-7' : 'w-5'}`}
      >
        <AppMark app={app} className={`size-4 ${broken ? 'opacity-60' : ''}`} />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1">
        {active && !broken ? <Tooltip label={`${name} in ${where}`}>{title}</Tooltip> : title}
        {broken ? null : (
          <span
            aria-hidden
            data-arrow-out=""
            className={`flex shrink-0 text-slate-400 ${
              active ? 'text-slate-600 dark:text-slate-300' : ''
            }`}
          >
            <ArrowOutIcon />
          </span>
        )}
      </span>
      {broken ? (
        <HoverCard title="Can't Open" description={cantOpenWords(state.reason, app, canEdit)}>
          <span
            data-cant-open=""
            className={`inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium leading-none ${REVIEW_DUE_PILL}`}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            <span className="text-optical-centre">Can&rsquo;t Open</span>
          </span>
        </HoverCard>
      ) : null}
      <span
        data-row-controls
        className={`flex shrink-0 items-center justify-end gap-0.5 ${touch ? 'w-9' : 'w-[50px]'}`}
      >
        {active && !touch ? (
          <HoverCard
            title="File Options"
            description={
              canEdit
                ? 'Open, copy its link, move it or remove it from the sidebar.'
                : 'Open this file or copy its link.'
            }
            disabled={menuOpen}
          >
            {menuButton}
          </HoverCard>
        ) : (
          menuButton
        )}
      </span>
    </a>
  );
}

function sameProps(a: ConnectedTreeRowProps, b: ConnectedTreeRowProps): boolean {
  for (const key of Object.keys(b) as (keyof ConnectedTreeRowProps)[]) {
    if (Object.is(a[key], b[key])) continue;
    if (key !== 'row') return false;
    for (const field of Object.keys(b.row) as (keyof PageRow)[]) {
      if (a.row[field] !== b.row[field]) return false;
    }
  }
  return true;
}

export const ConnectedTreeRow = memo(ConnectedTreeRowView, sameProps);
