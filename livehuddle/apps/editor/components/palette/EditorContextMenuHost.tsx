'use client';

import { useCallback } from 'react';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { EMPTY_SELECTION, type Selection } from '@liveworkspace/workbench/lib/selection-store';
import dynamic from 'next/dynamic';
import { track } from '@/lib/telemetry';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { roomNameEditable } from './RoomNameField';

// Lazy like the other heavy editor chrome: the menu's chunk loads on the
// first right-click, not with the page.
const EditorContextMenu = dynamic(
  () => import('@/components/palette/EditorContextMenu').then((m) => m.EditorContextMenu),
  { ssr: false },
);

// A Participant's or Viewer's menu, loaded on its first right-click too.
const ReadOnlyElementMenuHost = dynamic(
  () => import('./ReadOnlyElementMenuHost').then((m) => m.ReadOnlyElementMenuHost),
  { ssr: false },
);

// The element / multi-selection context menu's wiring, lifted out of
// EditorView (which carried ~100 lines of prop plumbing for it). Reads
// everything straight from EditorContext — the same host pattern as
// EditorModals / EditorAnchoredPopovers — and resolves the selection
// member set the menu's multi variant acts on.
export function EditorContextMenuHost() {
  const {
    contextMenu,
    activeTab,
    isReadOnly,
    closeContextMenu,
    setContextMenu,
    openLinkPicker,
    imageContext,
    removeImageFromElement,
    applyElementLink,
    toggleAspectLockSelected,
    setChairFacingSelected,
    setRoomDoorSelected,
    setRoomWallsSelected,
    setRoomFloorSelected,
    setRoomFloorColourSelected,
    setPieceTypeSelected,
    setStageSelected,
    setPadReceptionistSelected,
    setScreenSourceSelected,
    setJukeboxSourceSelected,
    applyElementDelta,
    can,
    setPortalTargetSelected,
    setPortalNameSelected,
    createLinkedPortal,
    tabs,
    resetAspectRatioSelected,
    setSizeSelected,
    commitLabel,
  } = useEditorContext();
  // The selection the menu acts on, read from the store while a menu is open: a closed menu never
  // renders for a selection change (docs/specs/008-canvas/blueprints/selection-store.md).
  const menuOpen = !!contextMenu && contextMenu.mode !== 'canvas' && !isReadOnly;
  const { selectedId, multiSelectedIds } = useSelectionOf(
    useCallback((sel: Selection) => (menuOpen ? sel : EMPTY_SELECTION), [menuOpen]),
  );

  // A Participant or a Viewer gets its own short menu, holding only what its role may do
  // (ReadOnlyElementMenuHost), so nothing below needs a second `isReadOnly` guard: everything past
  // this line is running for an editor by construction.
  if (isReadOnly) return contextMenu?.mode === 'element' ? <ReadOnlyElementMenuHost /> : null;
  if (!contextMenu || contextMenu.mode === 'canvas') return null;

  // Selection-context-menu member resolution (right-click a multi-selection):
  // the marquee set when one is active, else the clicked element.
  const ctxSelectedEl = selectedId
    ? (activeTab.elements.find((e) => e.id === selectedId) ?? null)
    : null;
  const ctxMemberIds =
    multiSelectedIds.size > 0 ? [...multiSelectedIds] : ctxSelectedEl ? [ctxSelectedEl.id] : [];
  // An Arcade Machine's Clear High Scores (docs/specs/009-elements/social-pieces.md "Clearing"): one delta, the room's
  // like a posted score, so nobody's undo brings the table back.
  // A Room's Name section, where this session may rename it (share-roles.md "rename ... Space elements").
  const menuTarget =
    contextMenu.mode === 'element'
      ? activeTab.elements.find((e) => e.id === contextMenu.elementId)
      : undefined;
  const renamesRoom = !!menuTarget && roomNameEditable(can, menuTarget);
  const clearArcadeScores = (elementId: string) => {
    applyElementDelta(elementId, { kind: 'arcade-clear' });
    track('Element', 'Changed', 'Arcade-machine');
  };

  return (
    <EditorContextMenu
      // Remount when the menu changes target: a right-click on a DIFFERENT
      // element should read as a new menu — it closes and animates in at the
      // new sticky, rather than sliding across fully-formed. Re-targeting the
      // same element keeps the key (and the state object), so that case stays
      // a true no-op with no animation restart. The id only changes on the
      // right-button RELEASE, so the entrance never fires under a held button.
      key={contextMenu.mode === 'element' ? contextMenu.elementId : contextMenu.mode}
      menu={contextMenu}
      onOpenTools={() =>
        setContextMenu((cur) => (cur?.mode === 'element' ? { ...cur, tools: true } : cur))
      }
      elements={activeTab.elements}
      onClose={closeContextMenu}
      onLinkElement={openLinkPicker}
      onOpenImagePicker={(id) => imageContext?.onOpenPicker?.(id)}
      onRemoveImage={removeImageFromElement}
      onChoosePosterPicture={
        imageContext?.posterPicker ? (id) => imageContext.onOpenPicker?.(id) : undefined
      }
      onRemoveLink={() => applyElementLink(null)}
      onToggleAspectLock={toggleAspectLockSelected}
      onSetChairFacing={setChairFacingSelected}
      onRenameRoom={renamesRoom ? commitLabel : undefined}
      onSetRoomDoor={setRoomDoorSelected}
      onSetRoomWalls={setRoomWallsSelected}
      onSetRoomFloor={setRoomFloorSelected}
      onSetRoomFloorColour={setRoomFloorColourSelected}
      onSetPieceType={setPieceTypeSelected}
      onSetStage={setStageSelected}
      onSetPadReceptionist={setPadReceptionistSelected}
      onSetScreenSource={setScreenSourceSelected}
      onSetJukeboxSource={setJukeboxSourceSelected}
      onClearArcadeScores={can.level === 'edit' ? clearArcadeScores : undefined}
      onSetPortalTarget={setPortalTargetSelected}
      onSetPortalName={setPortalNameSelected}
      onCreateLinkedPortal={createLinkedPortal}
      tabs={tabs}
      activeTabId={activeTab.id}
      onResetAspectRatio={resetAspectRatioSelected}
      onSetSize={setSizeSelected}
      selectionElements={ctxMemberIds
        .map((id) => activeTab.elements.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => e != null)}
    />
  );
}
