import { useEditorContext } from '@/app/design/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { LockHolder } from '@/components/canvas/LockedElementMenu';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { track } from '@/lib/telemetry';

// The menu on an element somebody else is holding: where it opens and who holds it.
export type LockedMenuState = {
  elementId: string;
  at: { x: number; y: number };
  holders: LockHolder[];
};

// The Canvas props for selecting and for the menus (EditorCanvasHost): the element, multi-selection and
// canvas context menus, the Explorer's design menu, and the empty-canvas deselect.
export function useMenuCanvasProps({
  setLockedMenu,
  canManageWebhooks,
  setWebhooksOpen,
}: {
  setLockedMenu: (menu: LockedMenuState | null) => void;
  canManageWebhooks: boolean;
  setWebhooksOpen: (open: boolean) => void;
}) {
  const {
    cancelConnect,
    canvasTool,
    designId,
    nameDesign,
    contextMenu,
    exitFormatTool,
    hydrated,
    canShareDesign,
    setSearchOpen,
    setShareDialogOpen,
    setSettingsOpen,
    loadAllTabs,
    isReadOnly,
    lockedByOther,
    newDesign,
    remoteSelectionsByElement,
    selectElement,
    sessionShareCode,
    setContextMenu,
    setEditingId,
    setExportOpen,
    setExportScope,
    setFormatSourceId,
    setMultiSelectedIds,
    setSelectedId,
  } = useEditorContext();
  return {
    currentDesignId: designId,
    currentShareCode: sessionShareCode,
    onRenameCurrentDesign: nameDesign,
    onNewDesign: newDesign,
    explorerMenuActions: {
      // The header's Share gate: the owner, or a joined member of the design's team
      // (docs/specs/013-workspace/folders.md, docs/specs/013-workspace/team-shared-designs.md).
      onShare:
        canShareDesign && hydrated
          ? () => {
              setShareDialogOpen(true);
              track('UI', 'Opened', 'Share');
            }
          : undefined,
      onExport: () => {
        setExportScope('tab');
        setExportOpen(true);
      },
      onWebhooks: canManageWebhooks ? () => setWebhooksOpen(true) : undefined,
      onSearch: () => openSearchWithPrefetch(setSearchOpen, loadAllTabs),
      onOpenSettings: () => {
        setSettingsOpen(true);
        track('UI', 'Opened', 'Settings');
      },
    },
    onDeselect: () => {
      // Clicking empty canvas also cancels an armed arrow-connect, and
      // wraps up the Format tool (restoring the pre-Format tool) so a
      // background click is the quick way out of paint mode (docs/specs/008-canvas/canvas-and-palette.md).
      if (canvasTool === 'format') exitFormatTool();
      cancelConnect();
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setEditingId(null);
      setFormatSourceId(null);
      setContextMenu(null);
    },
    onSelect: selectElement,
    onElementContextMenu: (id, sx, sy) => {
      // Concurrent-selection lock (docs/specs/007-editor/live-app.md): a peer holds this
      // element, so it can't be selected, dragged, or edited; don't
      // pop a dead context menu on it either. Same gate as
      // selectElement. A Participant or a Viewer still opens its own menu there
      // (comments, a link), less Edit Text (docs/specs/008-canvas/element-menu-quick-bar.md).
      //
      // An Editor's one action on a locked element is freeing it, and that gets
      // its own small menu rather than the element's real one, whose every
      // other row would be dead. See LockedElementMenu.
      if (!isReadOnly && lockedByOther(id)) {
        const holders = remoteSelectionsByElement.get(id);
        if (holders?.length) {
          setLockedMenu({ elementId: id, at: { x: sx, y: sy }, holders });
        }
        return;
      }
      // Right-clicking the element that already owns the menu AT THE
      // SAME ANCHOR is a no-op: return the SAME state object so React
      // re-renders nothing. Re-opening would restart the entrance
      // animation and flash the selection popover in the gap, for a
      // gesture that asked for the menu already on screen.
      //
      // The anchor has to be part of that comparison: selectElement
      // runs first and retargets an open menu's elementId in place
      // (keeping the old x / y), so an id-only check would see 'same
      // element' for a right-click on a DIFFERENT one and strand the
      // menu at the previous element's position.
      setContextMenu((cur) =>
        cur && cur.mode === 'element' && cur.elementId === id && cur.x === sx && cur.y === sy
          ? cur
          : { mode: 'element', elementId: id, x: sx, y: sy },
      );
    },
    onMultiContextMenu: isReadOnly
      ? undefined
      : // Right-click on a group / multi-selection always OPENS at the
        // cursor (a direct set, like onElementContextMenu). A toggle here
        // meant a lingering multi menu, which clicking elsewhere doesn't
        // dismiss, since element pointerdown stops propagation, got
        // closed by the next right-click instead of reopening, so the
        // group menu "wouldn't open".
        (sx, sy) => setContextMenu({ mode: 'multi', x: sx, y: sy }),
    onOpenMultiContextMenu: isReadOnly
      ? undefined
      : (sx, sy) =>
          // Toggle: the selection toolbar's ⋯ button closes an
          // already-open multi menu instead of reopening it.
          setContextMenu((cur) =>
            cur && cur.mode === 'multi' ? null : { mode: 'multi', x: sx, y: sy },
          ),
    onOpenElementContextMenu: isReadOnly
      ? undefined
      : (id, sx, sy) =>
          // Ellipsis is a toggle: clicking it while its menu is already
          // open for this element closes it (the ContextMenu ignores the
          // trigger's mousedown so this onClick gets to decide).
          setContextMenu((cur) =>
            cur && cur.mode === 'element' && cur.elementId === id
              ? null
              : { mode: 'element', elementId: id, x: sx, y: sy },
          ),
    onCanvasContextMenu: isReadOnly
      ? undefined
      : (sx, sy) =>
          setContextMenu({
            mode: 'canvas',
            x: sx,
            y: sy,
            // Open upward when the click is in the bottom fifth of the
            // viewport so the canvas menu's categories don't run
            // off-screen (matching the tab menu).
            openUp: sy > window.innerHeight * 0.8,
          }),
    // One gesture, one answer: while the element menu is open the
    // selection popover stands down (see deriveCanvasSelection).
    elementMenuOpen: contextMenu?.mode === 'element',
  } satisfies Partial<CanvasProps>;
}
