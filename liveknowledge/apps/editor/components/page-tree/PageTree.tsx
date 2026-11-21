'use client';

// The page tree's list (docs/specs/030-knowledgebase/blueprints/page-tree.md "The sidebar"): the rows on screen as a
// real tree (role `tree`, roving tabindex, the arrow keys), the row menu, the inline rename and the drag that
// reorders or nests. It listens once for every row (a click, a key, a hover, a drag are read off the row the event
// came from), so its rows carry no handlers and stay memoised. The same list is the sidebar's and the phone sheet's.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { pageMoveRefusal, withPageMoved, type PageMove } from '@liveknowledge/document';
import { PageTreeRow } from './PageTreeRow';
import { ConnectedTreeRow } from './ConnectedTreeRow';
import { ConnectedRowMenu, type ConnectedMenuVerb } from './ConnectedRowMenu';
import type { PageTreeConnected } from './connected-rows';
import type { TrustMark } from '@/lib/knowledge/page-trust';
import type { ApprovalMark } from '@/lib/knowledge/approval-view';
import { PageTreeRowMenu, type PageMenuVerb } from './PageTreeRowMenu';
import { createPageTreeUi } from './page-tree-ui';
import {
  dropMove,
  dropZoneOf,
  treeKeyAction,
  visiblePageRows,
  type DropZone,
  type TreeTab,
} from './page-tree-view';

export type PageTreeActions = {
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAdd: (parent?: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, to: PageMove) => void;
  onStep: (id: string, by: -1 | 1) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onCopyLink: (id: string) => void;
};

export type PageTreeProps = {
  tabs: readonly TreeTab[];
  activeId: string;
  // The pages a person has closed, and what a chevron does about it.
  closed: ReadonlySet<string>;
  onSetOpen: (id: string, open: boolean) => void;
  // May change the tree (an Editor): the verbs, the drag and the rename. Without it the tree is read and followed.
  canEdit: boolean;
  touch?: boolean;
  isOutOfScope?: ((id: string) => boolean) | undefined;
  // Who is on a page, drawn in its row; null for a page nobody is on.
  people?: ((id: string) => ReactNode) | undefined;
  // Bumped to rename the current page in place (the command palette's Rename Page).
  renameNonce?: number;
  actions: PageTreeActions;
  // Each page's verified state and what may be done about it (verification.md); absent, the tree shows none.
  knowledge?: PageTreeKnowledge | undefined;
  // The connected files among the pages (links-and-embeds.md "Connected files in the sidebar"); absent, a connected
  // row is drawn as a page.
  connected?: PageTreeConnected | undefined;
  className?: string;
};

/** What the tree shows and offers of its pages' knowledge (docs/specs/030-knowledgebase/verification.md): the tick
 *  or pill in a row, and Verify and Always in Context in its menu. Read from the tab list, one pass for the whole
 *  tree, never a request a row. */
export type PageTreeKnowledge = {
  marks: ReadonlyMap<string, TrustMark>;
  // A page Pending Approval or Rejected: a dot after its title (approval.md "Where it shows").
  approvalMarks?: ReadonlyMap<string, ApprovalMark>;
  inContext: ReadonlySet<string>;
  // Verify: an Editor with an account. The fields: an Editor.
  canVerify: boolean;
  canEditFields: boolean;
  onVerify: (id: string) => void;
  onSetContext: (id: string, on: boolean) => void;
};

const rowOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? target.closest<HTMLElement>('[data-page-row]') : null;
const actionOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? target.closest<HTMLElement>('[data-row-action]') : null;
// A press inside the rename field or a control is not a press on the row.
const inField = (target: EventTarget | null) =>
  target instanceof Element && target.closest('input, textarea, [contenteditable="true"]') !== null;

export function PageTree({
  tabs,
  activeId,
  closed,
  onSetOpen,
  canEdit,
  touch = false,
  isOutOfScope,
  people,
  renameNonce = 0,
  actions,
  knowledge,
  connected,
  className = '',
}: PageTreeProps) {
  // Read once per change of the list or of what is closed, never per row.
  const rows = useMemo(() => visiblePageRows(tabs, closed, activeId), [tabs, closed, activeId]);
  const [ui] = useState(createPageTreeUi);
  const tree = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  // The row the Tab key lands on: the last one focused while it is on screen, else the current page, else the first.
  const [stopId, setStopId] = useState<string | null>(null);
  const tabStop =
    (stopId && rows.some((r) => r.id === stopId) ? stopId : null) ??
    (rows.some((r) => r.id === activeId) ? activeId : (rows[0]?.id ?? null));

  // The handlers read the newest props when they run, so they (and the rows they are handed to) keep their identity.
  const latest = useRef({
    rows,
    tabs,
    actions,
    canEdit,
    onSetOpen,
    isOutOfScope,
    knowledge,
    connected,
  });
  useEffect(() => {
    latest.current = {
      rows,
      tabs,
      actions,
      canEdit,
      onSetOpen,
      isOutOfScope,
      knowledge,
      connected,
    };
  });
  // A connected row: pressed, it opens its file in a new tab, never as the open page.
  const connectedId = (id: string) =>
    latest.current.connected && latest.current.rows.some((r) => r.id === id && r.connectionId)
      ? latest.current.connected
      : null;

  // The command palette's Rename Page: each bump opens the current page's field once. The value the tree mounts
  // with is no request.
  const [seenRename, setSeenRename] = useState(renameNonce);
  if (renameNonce !== seenRename) {
    setSeenRename(renameNonce);
    if (canEdit) setEditingId(activeId);
  }

  const focusRow = useCallback((id: string) => {
    const el = tree.current?.querySelector<HTMLElement>(`[data-page-row="${CSS.escape(id)}"]`);
    el?.focus();
    // jsdom has no layout; a browser brings the row into the list's view.
    el?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const onRename = useCallback((id: string, name: string) => {
    latest.current.actions.onRename(id, name);
  }, []);
  const onRenameDone = useCallback(() => setEditingId(null), []);

  const openMenu = (id: string) => {
    const row = tree.current?.querySelector<HTMLElement>(`[data-page-row="${CSS.escape(id)}"]`);
    if (!row) return;
    setMenu({ id, anchor: row.querySelector<HTMLElement>('[data-row-action="menu"]') ?? row });
  };

  const onVerb = (verb: PageMenuVerb, id: string) => {
    const { actions: act, onSetOpen: setOpen, knowledge: know, connected: link } = latest.current;
    switch (verb) {
      case 'connect-here':
        // The new row shows: its page opens.
        setOpen(id, true);
        return link?.onConnect(id);
      case 'verify':
        return know?.onVerify(id);
      case 'context':
        return know?.onSetContext(id, !know.inContext.has(id));
      case 'rename':
        return setEditingId(id);
      case 'add':
        // The new subpage shows: its parent opens.
        setOpen(id, true);
        return act.onAdd(id);
      case 'duplicate':
        return act.onDuplicate(id);
      case 'copy-link':
        return act.onCopyLink(id);
      case 'up':
        return act.onStep(id, -1);
      case 'down':
        return act.onStep(id, 1);
      case 'indent':
        return act.onIndent(id);
      case 'outdent':
        return act.onOutdent(id);
      case 'delete':
        return act.onDelete(id);
    }
  };

  const onConnectedVerb = (verb: ConnectedMenuVerb, id: string) => {
    const { actions: act, connected: link } = latest.current;
    switch (verb) {
      case 'open':
        return link?.onOpen(id);
      case 'copy-link':
        return link?.onCopyLink(id);
      case 'connect-again':
        return link?.onConnectAgain(id);
      case 'remove':
        return link?.onRemove(id);
      case 'up':
        return act.onStep(id, -1);
      case 'down':
        return act.onStep(id, 1);
      case 'indent':
        return act.onIndent(id);
      case 'outdent':
        return act.onOutdent(id);
    }
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (inField(e.target)) return;
    const row = rowOf(e.target);
    const id = row?.dataset.pageRow;
    if (!row || !id) return;
    const control = actionOf(e.target)?.dataset.rowAction;
    const { rows: now, actions: act, onSetOpen: setOpen, isOutOfScope: outside } = latest.current;
    if (control === 'toggle') {
      const at = now.find((r) => r.id === id);
      if (at) setOpen(id, !at.open);
      return;
    }
    if (control === 'add') return onVerb('add', id);
    if (control === 'menu') {
      setMenu((open) => (open?.id === id ? null : { id, anchor: actionOf(e.target) ?? row }));
      return;
    }
    if (outside?.(id)) return;
    const link = connectedId(id);
    if (link) {
      // Its address known, the row is a link and the browser opens it (a new tab, or what a modifier asks for);
      // not yet known, the tree asks for it and opens it.
      if (!(row instanceof HTMLAnchorElement && row.href)) {
        e.preventDefault();
        link.onOpen(id);
      }
      return;
    }
    act.onSelect(id);
  };

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!latest.current.canEdit || inField(e.target) || actionOf(e.target)) return;
    const id = rowOf(e.target)?.dataset.pageRow;
    if (id && !latest.current.isOutOfScope?.(id) && !connectedId(id)) setEditingId(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Keys typed in the rename field, or on a row's button, are theirs.
    if (inField(e.target) || e.altKey || e.metaKey || e.ctrlKey) return;
    const id = rowOf(e.target)?.dataset.pageRow;
    if (!id || (e.target as HTMLElement).dataset.pageRow !== id) return;
    const {
      rows: now,
      actions: act,
      onSetOpen: setOpen,
      canEdit: may,
      isOutOfScope: outside,
    } = latest.current;
    const action = treeKeyAction(now, id, e.key, e.shiftKey);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    switch (action.kind) {
      case 'focus':
        return focusRow(action.id);
      case 'open':
        return setOpen(action.id, true);
      case 'close':
        return setOpen(action.id, false);
      case 'select': {
        if (outside?.(action.id)) return;
        const link = connectedId(action.id);
        if (link) link.onOpen(action.id);
        else act.onSelect(action.id);
        return;
      }
      case 'rename':
        if (may && !outside?.(action.id)) setEditingId(action.id);
        return;
      case 'menu':
        return openMenu(action.id);
    }
  };

  // The drag (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Move"): a row dropped on another's edge
  // reorders, on the row itself nests. What the pointer is over, and whether the tree takes it, is worked out once
  // per row and zone it enters, not per pointer move.
  const over = useRef<{ id: string; zone: DropZone; allowed: boolean } | null>(null);
  const endDrag = () => {
    over.current = null;
    ui.drag(null);
    ui.drop(null);
  };
  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    const id = rowOf(e.target)?.dataset.pageRow;
    if (!id || !latest.current.canEdit) return e.preventDefault();
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    ui.drag(id);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    const dragged = ui.draggedId();
    const row = rowOf(e.target);
    const id = row?.dataset.pageRow;
    if (!dragged || !row || !id) return;
    const box = row.getBoundingClientRect();
    const zone = dropZoneOf(e.clientY - box.top, box.height);
    let at = over.current;
    if (!at || at.id !== id || at.zone !== zone) {
      const { rows: now, tabs: list } = latest.current;
      const move = dropMove(now, id, zone);
      // Never into its own subtree, never past the deepest level, and not where it already is.
      const allowed =
        !!move &&
        !pageMoveRefusal(list, dragged, move) &&
        withPageMoved(list, dragged, move) !== null;
      at = { id, zone, allowed };
      over.current = at;
      ui.drop(allowed ? { id, zone } : null);
    }
    if (!at.allowed) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Out of the list altogether: no row is the target.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    over.current = null;
    ui.drop(null);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const dragged = ui.draggedId();
    const at = ui.dropAt();
    endDrag();
    if (!dragged || !at) return;
    e.preventDefault();
    const { rows: now, actions: act, onSetOpen: setOpen } = latest.current;
    const move = dropMove(now, at.id, at.zone);
    if (!move) return;
    // Dropped on a page, it shows there: the page opens.
    if (at.zone === 'inside') setOpen(at.id, true);
    act.onMove(dragged, move);
  };

  const menuRow = menu ? rows.find((r) => r.id === menu.id) : undefined;
  return (
    <>
      <div
        ref={tree}
        role="tree"
        aria-label="Pages"
        data-page-tree-list=""
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        onPointerOver={(e) => ui.hover(rowOf(e.target)?.dataset.pageRow ?? null)}
        onPointerLeave={() => ui.hover(null)}
        onFocus={(e) => {
          const id = rowOf(e.target)?.dataset.pageRow ?? null;
          ui.focus(id);
          if (id) setStopId(id);
        }}
        onBlur={(e) => {
          if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
          ui.focus(null);
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={endDrag}
        className={`flex min-h-0 flex-col gap-px overflow-y-auto overscroll-contain ${className}`}
      >
        {rows.map((row) =>
          row.connectionId && connected ? (
            <ConnectedTreeRow
              key={row.id}
              row={row}
              tabStop={row.id === tabStop}
              menuOpen={menu?.id === row.id}
              canEdit={canEdit}
              touch={touch}
              ui={ui}
              store={connected.store}
            />
          ) : (
            <PageTreeRow
              key={row.id}
              row={row}
              current={row.id === activeId}
              tabStop={row.id === tabStop}
              editing={row.id === editingId}
              menuOpen={menu?.id === row.id}
              canEdit={canEdit}
              outOfScope={isOutOfScope?.(row.id) ?? false}
              touch={touch}
              ui={ui}
              people={people?.(row.id)}
              trust={knowledge?.marks.get(row.id)}
              approval={knowledge?.approvalMarks?.get(row.id)}
              onRename={onRename}
              onRenameDone={onRenameDone}
            />
          ),
        )}
      </div>
      {menu && connected && menuRow?.connectionId && menuRow.app ? (
        <ConnectedRowMenu
          anchor={menu.anchor}
          tabs={tabs}
          id={menu.id}
          app={menuRow.app}
          state={connected.store.stateOf(menuRow.connectionId)}
          canEdit={canEdit}
          onVerb={onConnectedVerb}
          onClose={() => setMenu(null)}
        />
      ) : menu ? (
        <PageTreeRowMenu
          anchor={menu.anchor}
          tabs={tabs}
          id={menu.id}
          canEdit={canEdit}
          knowledge={knowledge}
          canConnect={connected?.canConnect ?? false}
          onVerb={onVerb}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </>
  );
}
