import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MenuTreeContext, Portal, useControlMenu } from '@liveworkspace/ui';
import { useReposition } from '../../hooks/canvas/useReposition';
import { useMenuDismiss } from '../../hooks/ui/useMenuDismiss';
import { useIsMobileViewport } from '../../hooks/ui/useIsMobileViewport';
import { clampToViewport } from '../../lib/clamp-to-viewport';
import { BottomSheet } from '../primitives/BottomSheet';
import { ConfirmPopover } from '../primitives/ConfirmPopover';
import { MenuGroupSeparator } from '../primitives/PortalMenu';
import type { ConnectedTabMenu } from '../connect/tab-connection';
import { AddTabToFolderDialog } from './TabFolderDialog';
import type { TabFolderListProps } from './TabFolderList';
import {
  ConnectedTabMenuRows,
  TabMenuRows,
  TabMenuToolbar,
  sideBySideOf,
  tabMenuWords,
  type TabMenuCanvas,
  type TabMenuSplit,
  type TabMenuWords,
} from './tab-menu-rows';

export type { TabMenuCanvas, TabMenuSplit, TabMenuWords } from './tab-menu-rows';

// Where the canvas right-click / footer-button menu opens. `openUp` grows it upward from y rather than down.
export type TabMenuPoint = { x: number; y: number; openUp?: boolean };

// The one tab menu every editor binds (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"):
// the tab's verbs, its folder and copy-to pickers, and the app's own rows, from a tab's ⋯ or the canvas right-click.
export type TabMenuProps = {
  // Placed EITHER above an anchor button (the tab's ⋯) OR at a screen point (the canvas right-click).
  anchor?: HTMLButtonElement | null;
  point?: TabMenuPoint;
  // Paste, from the tab's ⋯ as a toolbar icon and from the canvas as a labelled row.
  canvas?: TabMenuCanvas;
  onClose: () => void;
  // What the app calls one tab and what holds its tabs.
  words: TabMenuWords;
  // The editor's side by side state; absent outside an editor.
  split?: TabMenuSplit | null;
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onImport: () => void;
  onExport: () => void;
  onDelete: () => void;
  canDelete: boolean;
  canClearContent: boolean;
  // A locked tab greys Delete and (unless `canImport` says otherwise) Import. The lock button shows only where the
  // app locks tabs (`onToggleLock`).
  locked?: boolean;
  onToggleLock?: () => void;
  // Whether Import has anything to press; absent, the lock decides.
  canImport?: boolean;
  importLabel?: string;
  // Delete asks nothing (undo brings a tab back), except for what an undo cannot take back: then this warning, in a
  // confirm anchored to Delete.
  deleteWarning?: string | undefined;
  // Organise in Tab Folder (docs/specs/006-*/tab-folders.md in each editor): the row shows with `onMoveToFolder`.
  folders?: TabFolderListProps['folders'];
  currentFolder?: string | null;
  onMoveToFolder?: TabFolderListProps['onMoveToFolder'];
  onRemoveFromFolder?: () => void;
  onSetFolderColour?: TabFolderListProps['onSetFolderColour'];
  // Add to Another <Noun>: the app's label and its picker, drawn in place of the menu.
  copyTo?: { label: string; disabled: boolean; picker: (close: () => void) => ReactNode };
  // A connected tab gets its own short menu; `renameConnected` false where its name always follows its file.
  connected?: ConnectedTabMenu | undefined;
  renameConnected?: boolean;
  // The app's own rows: a group of its own after the organise rows, rows after Export, rows on a connected tab's
  // menu, and a lone row that replaces the whole menu (a session that may do only that).
  ownGroup?: ReactNode;
  fileRows?: ReactNode;
  connectedRows?: ReactNode;
  only?: ReactNode;
  toolbar?: 'grouped' | 'spread';
};

// The props an editor's tab bar passes straight through its binding (each editor's components/chrome/TabMenu.tsx);
// the binding adds its words, its split view, its copy-to picker and its own rows.
export type TabMenuBindingProps = Omit<
  TabMenuProps,
  | 'words'
  | 'split'
  | 'copyTo'
  | 'ownGroup'
  | 'fileRows'
  | 'connectedRows'
  | 'only'
  | 'toolbar'
  | 'renameConnected'
  | 'importLabel'
>;

// The copy-to picker's inputs, as every editor's tab bar hands them over.
export type TabMenuCopyToProps = {
  // Viewer identity for the picker's thumbnail fetches.
  selfId: string;
  otherDocuments: { id: string; name: string; savedAt?: number }[];
  onCopyTo: (targetDocumentId: string) => void;
};

// A folder action an app leaves out does nothing.
const noop = () => {};

export function TabMenu({
  anchor,
  point,
  canvas,
  onClose,
  words: appWords,
  split,
  onRename,
  onDuplicate,
  onClearContent,
  onImport,
  onExport,
  onDelete,
  canDelete,
  canClearContent,
  locked = false,
  onToggleLock,
  canImport,
  importLabel = 'Import',
  deleteWarning,
  folders = [],
  currentFolder = null,
  onMoveToFolder,
  onRemoveFromFolder,
  onSetFolderColour,
  copyTo,
  connected,
  renameConnected = true,
  ownGroup,
  fileRows,
  connectedRows,
  only,
  toolbar = 'grouped',
}: TabMenuProps) {
  const words = tabMenuWords(appWords);
  // The menu lists the verbs; the two organise pickers open as centred modals in place of the anchored box, so they
  // get room. While one is up the box unmounts (`ref` goes null), which disarms the outside-press dismisser below;
  // the modal owns its own dismissal and closes the whole menu with it.
  const [view, setView] = useState<'actions' | 'copyTo' | 'folder'>('actions');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteRow, setDeleteRow] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  // A control menu (docs/specs/004-interface-design/menus.md): Escape, focus in when the keyboard opened it, focus
  // back to the tab's ⋯ on close.
  const { attach, element, tree, surfaceProps } = useControlMenu({
    onClose,
    trigger: anchor ?? null,
    label: point ? 'Canvas menu' : words.menuLabel,
  });
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      attach(el);
    },
    [attach],
  );
  const phone = useIsMobileViewport();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  // At the given point, or above the anchor right-aligned to it, measured each time the menu opens.
  const reposition = useCallback(() => {
    if (point) {
      setPos({ left: point.x, top: point.y });
      return;
    }
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ left: r.right, top: r.top });
  }, [anchor, point]);
  useReposition(reposition);

  // Nudge the box back on-screen when it overflows an edge, again whenever its box changes (a menu that fitted when
  // it appeared can grow), so it slides to stay on screen rather than growing out of it. A phone's sheet is docked,
  // not placed: nothing to clamp.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !pos || phone) return;
    const clamp = () => {
      const next = clampToViewport(node.getBoundingClientRect(), adjust);
      if (next.x !== adjust.x || next.y !== adjust.y) setAdjust(next);
    };
    clamp();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(clamp);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pos, adjust, phone, element]);

  // Closing on an outside press (the canvas included), a wheel scroll or the window losing focus
  // (docs/specs/008-canvas/canvas-and-palette.md, Tab menu "Closing"). Escape closes it through useControlMenu.
  useMenuDismiss(ref, onClose, anchor);

  // Dismissing a picker dismisses the menu. Focus goes back to the tab's ⋯: the row that opened the picker left with
  // the anchored box, so the dialog had nothing to hand focus back to.
  const closePicker = () => {
    onClose();
    if (anchor?.isConnected) anchor.focus({ preventScroll: true });
  };
  if (view === 'copyTo' && copyTo) return <>{copyTo.picker(closePicker)}</>;
  if (view === 'folder' && onMoveToFolder) {
    return (
      <AddTabToFolderDialog
        folders={folders}
        currentFolder={currentFolder}
        onMoveToFolder={onMoveToFolder}
        onRemoveFromFolder={onRemoveFromFolder ?? noop}
        onSetFolderColour={onSetFolderColour ?? noop}
        onClose={closePicker}
      />
    );
  }

  const onOrganise = onMoveToFolder ? () => setView('folder') : null;
  const deleteTab = () => {
    if (deleteWarning) {
      setConfirmingDelete(true);
      return;
    }
    onDelete();
    onClose();
  };

  // The menu's rows, the same in the anchored box and in a phone's bottom sheet.
  const body =
    only !== undefined ? (
      only
    ) : connected ? (
      <ConnectedTabMenuRows
        words={words}
        connected={connected}
        onRename={renameConnected ? onRename : null}
        onOrganise={onOrganise}
        connectedRows={connectedRows}
        canDelete={canDelete}
        onDelete={onDelete}
        onClose={onClose}
      />
    ) : (
      <>
        <TabMenuToolbar
          words={words}
          spread={toolbar === 'spread'}
          paste={canvas && !point ? canvas : null}
          sideBySide={sideBySideOf(split)}
          locked={locked}
          onToggleLock={onToggleLock}
          canDelete={canDelete}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={deleteTab}
          onClose={onClose}
          deleteRowRef={setDeleteRow}
        />
        {/* Separator under the toolbar, isolating the quick verbs from the rows below. */}
        <MenuGroupSeparator />
        <TabMenuRows
          pasteRow={canvas && point ? canvas : null}
          onClose={onClose}
          onOrganise={onOrganise}
          copyTo={
            copyTo
              ? { label: copyTo.label, disabled: copyTo.disabled, onOpen: () => setView('copyTo') }
              : null
          }
          ownGroup={ownGroup}
          importLabel={importLabel}
          canImport={canImport ?? !locked}
          onImport={onImport}
          onExport={onExport}
          fileRows={fileRows}
          canClearContent={canClearContent}
          onClearContent={onClearContent}
        />
      </>
    );

  // Delete's confirm, anchored to its button group, rendered so the outside-press handler treats it as inside.
  const confirm =
    confirmingDelete && deleteRow ? (
      <ConfirmPopover
        anchor={deleteRow}
        message={words.confirmDelete}
        warning={deleteWarning}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
          onClose();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    ) : null;

  // A phone gets the menu as a bottom sheet (docs/specs/007-editor/editor-app.md "Menus are bottom sheets on a
  // phone" in each editor): the dismissers above reach it through `ref`.
  if (phone) {
    return (
      <>
        <BottomSheet
          ref={setRef}
          {...surfaceProps}
          data-tour-id="tab-menu"
          onContextMenu={(e) => e.preventDefault()}
          onClose={onClose}
          zClassName="z-[var(--z-modal)]"
        >
          <MenuTreeContext.Provider value={tree}>{body}</MenuTreeContext.Provider>
        </BottomSheet>
        {confirm ? <Portal>{confirm}</Portal> : null}
      </>
    );
  }

  if (!pos) return null;

  return (
    <Portal>
      <div
        ref={setRef}
        {...surfaceProps}
        data-tour-id="tab-menu"
        onContextMenu={(e) => e.preventDefault()}
        // lvd-menu-stagger cascades the direct children in one at a time, the element context menu's falling-stack
        // entrance; animate-fade-in matches its whole-menu fade (each editor's globals.css).
        className="lvd-menu-stagger animate-fade-in fixed z-[var(--z-modal)] flex w-56 outline-none flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{
          // Anchor mode pins the menu's right edge to the ⋯ and grows up-left; point mode pins its top-left to the
          // cursor and grows down (or up, with openUp).
          left: pos.left + adjust.x,
          top: pos.top + adjust.y,
          transform: point
            ? point.openUp
              ? 'translate(0, calc(-100% - 4px))'
              : 'none'
            : 'translate(-100%, calc(-100% - 4px))',
        }}
      >
        <MenuTreeContext.Provider value={tree}>{body}</MenuTreeContext.Provider>
      </div>
      {confirm}
    </Portal>
  );
}
