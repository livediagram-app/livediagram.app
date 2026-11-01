import { PencilIcon, TrashIcon } from '@/components/primitives/explorer-icons';
import { useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useReposition } from '@liveworkspace/workbench/hooks/canvas/useReposition';
import { useMenuDismiss } from '@liveworkspace/workbench/hooks/ui/useMenuDismiss';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { clampToViewport } from '@liveworkspace/workbench/lib/clamp-to-viewport';
import { FileExportIcon, FileImportIcon } from '@/components/palette/palette-icons';
import {
  ClearIcon,
  FolderMenuIcon,
  MoveIcon,
  TabLockIcon,
} from '@/components/chrome/tab-bar-icons';
import {
  MenuActionRow,
  MenuGroupSeparator,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import {
  MenuToolbar,
  MenuToolButton,
} from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { PasteMenuIcon } from '@/components/palette/context-menu-icons';
import {
  AddTabToDocumentDialog,
  AddTabToFolderDialog,
} from '@/components/dialogs/TabOrganiseDialogs';
import type { CanvasMenuActions, CanvasMenuTarget } from './TabBar';
import {
  DuplicateIcon,
  MenuTreeContext,
  SideBySideIcon,
  useControlMenu,
  Portal,
} from '@livediagram/ui';
import { useSplitViewContext } from '@/components/split/SplitViewContext';

// The unified tab / canvas portal menu (actions, copy-to-document, and
// folder sub-views). Extracted from TabBar.tsx, where it had grown into a
// ~520-line component buried in the file. Pure prop-based component.
export function PortalMenu({
  anchor,
  point,
  canvas,
  onClose,
  onRename,
  onDuplicate,
  onClearContent,
  onImport,
  onExport,
  onCopyTo,
  onToggleLock,
  locked,
  selfId,
  otherDocuments,
  folderNames,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onDelete,
  canClearContent,
  canDelete,
}: {
  // Positioned EITHER above an anchor button (tab ellipsis) OR at a screen
  // point (canvas right-click / footer button). Exactly one is provided.
  anchor?: HTMLButtonElement | null;
  point?: CanvasMenuTarget;
  // When set, the canvas sections (theme / background / add element) render
  // below the tab-management sections, turning the tab menu into the merged
  // canvas right-click menu.
  canvas?: CanvasMenuActions;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onImport: () => void;
  onExport: () => void;
  onCopyTo: (targetDocumentId: string) => void;
  onToggleLock: () => void;
  locked: boolean;
  // Viewer identity for the Add to Document dialog's thumbnail fetches.
  selfId: string;
  otherDocuments: { id: string; name: string; savedAt?: number }[];
  folderNames: string[];
  currentFolder: string | null;
  onMoveToFolder: (folderName: string) => void;
  onRemoveFromFolder: () => void;
  onDelete: () => void;
  canDelete: boolean;
  canClearContent: boolean;
}) {
  // The menu itself lists the verbs (Rename, Duplicate, Clear…); the two
  // organise pickers — "copyTo" (docs/specs/006-document/tab-document-many-to-many.md, link the tab into another
  // document) and "folder" (docs/specs/006-document/tab-folders.md, file the tab into a tab-bar folder) —
  // open as proper centred MODALS in place of the anchored box, so they
  // get room instead of squeezing into the menu. While a modal is up the
  // anchored box unmounts (`ref` goes null), which conveniently disarms
  // the outside-click dismisser below; the modal owns its own dismissal
  // and closes the whole menu with it.
  const [view, setView] = useState<'actions' | 'copyTo' | 'folder'>('actions');
  // Delete asks nothing: undo brings a tab back.
  const ref = useRef<HTMLDivElement | null>(null);
  // A control menu (docs/specs/004-interface-design/menus.md): Escape, focus in when the keyboard
  // opened it, focus back to the tab's ⋯ (or wherever it was) on close.
  const { attach, element, tree, surfaceProps } = useControlMenu({
    onClose,
    trigger: anchor ?? null,
    label: point ? 'Canvas menu' : 'Tab menu',
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

  // Position at the given point (canvas right-click / footer button) or, for
  // the tab ellipsis, above the anchor button right-aligned to it. Measured
  // each time the menu opens so it stays attached even after layout shifts.
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

  // After the menu mounts, nudge it back on-screen if it overflows any
  // edge (e.g. Tab 1 is near the left and the menu opens left of its
  // anchor). Also re-runs when `view` flips: the "Add to another
  // document" submenu is wider (w-56 vs w-44) and taller (destination
  // list + Back row), so without a fresh measurement the box could
  // overflow the bottom or left edges of the viewport with stale
  // adjust state carried over from the actions view.
  useLayoutEffect(() => {
    const node = ref.current;
    // A phone's sheet is docked, not placed: nothing to clamp, and the nudge it would never apply
    // made this effect set state in a loop.
    if (!node || !pos || phone) return;
    const clamp = () => {
      const next = clampToViewport(node.getBoundingClientRect(), adjust);
      if (next.x !== adjust.x || next.y !== adjust.y) setAdjust(next);
    };
    clamp();
    // The menu changes height after it opens (a category unfolds, a view
    // swaps), and a menu that fitted when it appeared can then run off the
    // bottom of the screen. Re-clamp whenever its box changes, so it slides
    // up to stay on screen rather than growing out of it.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(clamp);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pos, adjust, phone, element]);

  // Closing on an outside press (the canvas included), a wheel scroll or the window losing focus, the
  // same hook for every editor (docs/specs/008-canvas/canvas-and-palette.md, Tab menu "Closing").
  useMenuDismiss(ref, onClose, anchor);
  // Escape closes it through useControlMenu above.

  // Open this (the active) tab side by side, or close the split when one is showing; absent where a
  // split can't open (a phone, a lone tab, no editor around the menu).
  const split = useSplitViewContext();
  const sideBySide = !split?.available
    ? null
    : split.pair
      ? { closing: true, run: split.close }
      : split.canOpen(split.activeId)
        ? { closing: false, run: () => split.open(split.activeId, 'Menu') }
        : null;

  // Modal pickers replace the anchored box entirely (see the `view` note
  // above); dismissing them dismisses the menu. Focus goes back to the tab's ⋯: the row that opened the picker left
  // with the anchored box, so the dialog had nothing to hand focus back to and it fell to the page.
  const closePicker = () => {
    onClose();
    if (anchor?.isConnected) anchor.focus({ preventScroll: true });
  };
  if (view === 'copyTo') {
    return (
      <AddTabToDocumentDialog
        ownerId={selfId}
        otherDocuments={otherDocuments}
        onPick={onCopyTo}
        onClose={closePicker}
      />
    );
  }
  if (view === 'folder') {
    return (
      <AddTabToFolderDialog
        folderNames={folderNames}
        currentFolder={currentFolder}
        onMoveToFolder={onMoveToFolder}
        onRemoveFromFolder={onRemoveFromFolder}
        onClose={closePicker}
      />
    );
  }

  // The menu's rows, the same in the anchored box and in a phone's bottom sheet.
  const body = (
    <>
      {view === 'actions' ? (
        <>
          {/* Quick actions: the verbs reached for most often, as a compact
            icon row so they're one glance away. The rest of the menu
            groups the verbose / destructive actions into sections. */}
          <MenuToolbar>
            <MenuToolButton
              icon={<PencilIcon />}
              label="Rename"
              description="Rename this tab."
              onClick={onRename}
            />
            <MenuToolButton
              icon={<DuplicateIcon />}
              label="Duplicate"
              description="Create a copy of this tab in this canvas."
              onClick={onDuplicate}
            />
            {/* Paste in the tab ⋯ menu: one tab verb among several, so an
              icon. Opened from an empty-canvas right-click (`point`) it
              is a labelled row below instead (docs/specs/008-canvas/canvas-and-palette.md). Greyed, not
              hidden, when the buffer is empty. */}
            {canvas && !point ? (
              <MenuToolButton
                icon={<PasteMenuIcon />}
                label="Paste"
                description={
                  canvas.canPaste ? 'Paste what you copied onto this tab.' : 'Nothing to paste yet.'
                }
                onClick={() => {
                  canvas.onPaste();
                  onClose();
                }}
                disabled={!canvas.canPaste}
              />
            ) : null}
            {/* Side by side (docs/specs/007-editor/split-view.md): the menu's way to what dragging the
              pill to the right does, for a keyboard or a trackpad that would rather not drag. */}
            {sideBySide ? (
              <MenuToolButton
                icon={<SideBySideIcon />}
                label={sideBySide.closing ? 'Close Side by Side' : 'Side by Side'}
                description={
                  sideBySide.closing
                    ? 'Go back to one tab: this one, across the whole window.'
                    : 'Show this tab on the right, beside the tab you were on. Or drag its pill to the right edge.'
                }
                onClick={() => {
                  sideBySide.run();
                  onClose();
                }}
                active={sideBySide.closing}
              />
            ) : null}
            {/* Lock and Delete sit together at the right edge, apart from
              the everyday verbs: both change what the tab will let you
              do next rather than doing something to it. */}
            <div className="ml-auto flex items-center gap-0.5">
              <MenuToolButton
                icon={<TabLockIcon />}
                label={locked ? 'Unlock Tab' : 'Lock Tab'}
                description={locked ? 'Make this tab editable again.' : 'Make this tab read-only.'}
                onClick={onToggleLock}
                active={locked}
              />
              <MenuToolButton
                icon={<TrashIcon />}
                label="Delete"
                description={
                  locked ? 'This tab is locked. Unlock it before deleting.' : 'Delete this tab.'
                }
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                disabled={!canDelete || locked}
              />
            </div>
          </MenuToolbar>
          {/* Separator under the toolbar, isolating the quick verbs from the rows below. */}
          <MenuGroupSeparator />
          {/* The empty-canvas right-click is usually "put what I copied
            HERE", so there Paste leads the menu as a labelled row
            (docs/specs/008-canvas/canvas-and-palette.md "Canvas menu: Paste"). */}
          {canvas && point ? (
            <>
              <div data-testid="canvas-paste-row">
                <MenuActionRow
                  plain
                  icon={<PasteMenuIcon />}
                  label="Paste"
                  disabled={!canvas.canPaste}
                  onClick={() => {
                    canvas.onPaste();
                    onClose();
                  }}
                />
              </div>
              <MenuGroupSeparator />
            </>
          ) : null}
          {/* The rest as full-width rows, no categories: the menu is short enough to show it
            all (docs/specs/007-editor/editor-app.md "Tab menu"). Separators part the related groups:
            where the tab lives and what is on it. */}
          <MenuActionRow
            plain
            icon={<FolderMenuIcon />}
            label="Organise in Tab Folder"
            onClick={() => setView('folder')}
          />
          <MenuActionRow
            plain
            icon={<MoveIcon />}
            label="Add to Another Canvas"
            onClick={() => setView('copyTo')}
            disabled={otherDocuments.length === 0}
          />
          <MenuGroupSeparator />
          <MenuActionRow
            plain
            icon={<FileImportIcon />}
            label="Import"
            onClick={onImport}
            disabled={locked}
          />
          <MenuActionRow plain icon={<FileExportIcon />} label="Export" onClick={onExport} />
          <MenuActionRow
            plain
            icon={<ClearIcon />}
            label="Clear"
            onClick={onClearContent}
            disabled={!canClearContent}
          />
        </>
      ) : null}
    </>
  );
  // A phone gets the menu as a bottom sheet (docs/specs/007-editor/editor-app.md "Menus are bottom
  // sheets on a phone"), as the element menu does: the dismissers above reach it through `ref`.
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
        // lvd-menu-stagger cascades the direct children (toolbar + category
        // sections) in one at a time for the same falling-stack entrance the
        // element context menu uses (ContextMenu.tsx); animate-fade-in matches
        // its whole-menu fade. See globals.css.
        className="lvd-menu-stagger animate-fade-in fixed z-[var(--z-modal)] flex w-56 outline-none flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{
          // adjust nudges the box back on-screen when it would overflow an edge.
          // Anchor mode pins the menu's right edge to the ellipsis button and
          // grows up-left; point mode pins its top-left to the cursor and grows
          // down (or up from the footer button, which passes openUp).
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
    </Portal>
  );
}
