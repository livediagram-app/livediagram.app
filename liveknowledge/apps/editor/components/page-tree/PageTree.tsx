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
import { runConnectedVerb, runPageVerb } from './page-tree-verbs';
import { useRowLongPress } from './useRowLongPress';
import type { MenuPoint } from '@liveworkspace/workbench/components/primitives/usePortalMenuPlacement';
import {
  dropMove,
  dropZoneOf,
  isTypeAheadKey,
  treeKeyAction,
  typeAheadMatch,
  visiblePageRows,
  TYPE_AHEAD_RESET_MS,
  type DropZone,
  type PageRow,
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
  // Suggested edits waiting, by page (ai-knowledge.md "On the page"), from the newest Page Health read.
  suggestionCounts?: Readonly<Record<string, number>> | undefined;
  inContext: ReadonlySet<string>;
  // Verify: an Editor with an account. The fields: an Editor.
  canVerify: boolean;
  canEditFields: boolean;
  onVerify: (id: string) => void;
  onSetContext: (id: string, on: boolean) => void;
  // Request Approval, from the page's menu (approval.md "Asking").
  canRequestApproval?: (id: string) => boolean;
  onRequestApproval?: (id: string) => void;
  // Watch, Watch This Section and Unwatch, for every signed-in reader (watching.md "Where it shows"): the rows for the
  // page, read when its menu opens, a separator above them when `separated`.
  watchRows?: (id: string, onClose: () => void, separated: boolean) => ReactNode;
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
  // The open menu: its row, its trigger (the row's ... button), and the point a right-click or a long press opened it
  // at (none from the button or a key, when it hangs from the button).
  const [menu, setMenu] = useState<{
    id: string;
    anchor: HTMLElement;
    point?: MenuPoint | undefined;
  } | null>(null);
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

  const openMenu = (id: string, point?: MenuPoint) => {
    const row = tree.current?.querySelector<HTMLElement>(`[data-page-row="${CSS.escape(id)}"]`);
    if (!row) return;
    // At a point, the row itself is the trigger: a row is never re-mounted, while its buttons are as their hover cards
    // come and go, so a press outside it and the focus coming back always find it.
    const button = row.querySelector<HTMLElement>('[data-row-action="menu"]');
    setMenu({ id, anchor: point ? row : (button ?? row), point });
  };
  // A row that may open its menu from a right-click or a long press: on screen, not being renamed, not out of scope.
  const menuable = (id: string) => id !== editingId && !latest.current.isOutOfScope?.(id);

  const onVerb = (verb: PageMenuVerb, id: string) =>
    runPageVerb(verb, id, { ...latest.current, rename: setEditingId });
  const onConnectedVerb = (verb: ConnectedMenuVerb, id: string) =>
    runConnectedVerb(verb, id, latest.current);

  // A long press on a row (a touch screen's right-click) opens its menu at the finger; the click its release sends
  // is the press's, not a tap.
  const longPress = useRowLongPress(
    (target) => rowOf(target) !== null && !actionOf(target) && !inField(target),
    (target, point) => {
      const id = rowOf(target)?.dataset.pageRow;
      if (id && menuable(id)) openMenu(id, point);
    },
  );
  // The row whose menu a key opened: the contextmenu event some browsers send after the menu key or Shift+F10 is
  // that key's, not a right-click at the pointer. Any press clears it.
  const keyMenu = useRef<string | null>(null);
  // Type-ahead: the letters typed on the tree, and when the last one was.
  const typed = useRef({ text: '', at: 0 });
  const shownName = (r: PageRow) =>
    latest.current.isOutOfScope?.(r.id)
      ? 'Not Shared'
      : r.name || (r.connectionId ? 'Untitled File' : 'Untitled Page');

  const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    // The rename field keeps its own menu (paste); empty space is the sidebar's, as before.
    if (inField(e.target)) return;
    const id = rowOf(e.target)?.dataset.pageRow;
    if (!id) return;
    e.preventDefault();
    longPress.cancel();
    if (keyMenu.current === id) return;
    if (menuable(id)) openMenu(id, { x: e.clientX, y: e.clientY });
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (longPress.takeClick()) return e.preventDefault();
    if (inField(e.target)) return;
    const row = rowOf(e.target);
    const id = row?.dataset.pageRow;
    if (!row || !id) return;
    const control = actionOf(e.target)?.dataset.rowAction;
    // A connected file's row is a link: a press on one of its buttons (its "…") is the button's alone, never the
    // link's, so the file does not open under the menu (owner 2026-11-22).
    if (control && row instanceof HTMLAnchorElement) e.preventDefault();
    // A menu a right-click hung on this row takes no outside press from it: any other press on the row closes it.
    if (control !== 'menu') setMenu(null);
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
    if (!action) {
      const at = Date.now();
      const held = at - typed.current.at > TYPE_AHEAD_RESET_MS ? '' : typed.current.text;
      if (!isTypeAheadKey(e.key, held !== '')) return;
      e.preventDefault();
      e.stopPropagation();
      const text = held + e.key;
      typed.current = { text, at };
      const next = typeAheadMatch(now, id, text, shownName);
      if (next && next !== id) focusRow(next);
      return;
    }
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
        keyMenu.current = action.id;
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
    // A drag is not a long press: the hold ends, and a menu it already opened closes for the drag.
    longPress.cancel();
    if (longPress.fired()) setMenu(null);
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
        onContextMenu={onContextMenu}
        onPointerDown={(e) => {
          keyMenu.current = null;
          longPress.onPointerDown(e);
        }}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.cancel}
        onPointerCancel={longPress.cancel}
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
              // Only Review Due shows in the sidebar: no Verified tick and no approval dot (owner 2026-11-21); the page's
              // own meta row and Page Health carry those.
              trust={knowledge?.marks.get(row.id) === 'review-due' ? 'review-due' : undefined}
              // Suggested edits do show (Work Tracker 1362): something waits for an Editor there.
              suggestions={knowledge?.suggestionCounts?.[row.id]}
              onRename={onRename}
              onRenameDone={onRenameDone}
            />
          ),
        )}
      </div>
      {menu && connected && menuRow?.connectionId && menuRow.app ? (
        <ConnectedRowMenu
          anchor={menu.anchor}
          point={menu.point}
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
          point={menu.point}
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
