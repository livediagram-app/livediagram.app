'use client';

import { roleGates } from '@/lib/editor-capabilities';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { pastePointer } from '@liveworkspace/workbench/lib/canvas-pointer';
import { dropThenDisarm } from '@liveworkspace/workbench/lib/palette-drop';
import { canvasSurface, DEFAULT_BACKGROUND_COLOR, spacePattern } from '@livehuddle/document';
import { createStockColourProjector } from '@/lib/stock-colour-projector';
import { useState } from 'react';
import { canManageWebhooks as canManageWebhooksOf } from '@liveworkspace/workbench/lib/can-manage-webhooks';
import { ItemWebhooksDialog } from '@liveworkspace/workbench/components/dialogs/ItemWebhooksDialog';

import { LockedElementMenu } from '@liveworkspace/workbench/components/canvas/LockedElementMenu';

import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { getTheme, resolveTabBackdrop, themeViewMap, type ThemeId } from '@/lib/themes';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsLandscapePhone } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useTimerPieceControls } from '@/lib/timer-piece-controls';
import { CanvasThemeProvider } from '@/components/canvas/CanvasSurfaceContext';
import { useCanvasFormatProps } from '@/components/canvas/useCanvasFormatProps';
import { useCanvasMenuProps, type LockedMenuState } from '@/components/canvas/useCanvasMenuProps';
import { useCanvasWalkProps } from '@/components/canvas/useCanvasWalkProps';

// The Canvas element's wiring, lifted out of EditorView (which carried
// ~500 lines of prop plumbing for it). Reads everything straight from
// EditorContext, the same host pattern as EditorModals /
// EditorContextMenuHost, plus the handful of locals only the Canvas
// props consume (the memoised Explorer list props, the owner-badge
// resolution).
export function EditorCanvasHost() {
  const {
    activeTab,
    activeTabLoadState,

    addAvatar,
    addSticker,
    addImage,
    addLinkCard,
    addShape,
    addSticky,
    dropBoardFile,
    addText,
    anyWelcomeOpen,
    beginDrag,
    pressArmedAction,
    beginEdit,
    beginRoomWalls,
    broadcastCursor,
    canvasPointerRef,
    cancelDrawShape,
    cancelEdit,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,

    confirmIdentity,
    cancelIdentity,

    accountDisplayName,
    accountUserId,
    commitDraw,
    commitRoomWalls,
    commitLabel,
    deleteMultiSelected,
    deleteSelected,
    documentId,
    documentName,
    sessionTabScope,
    participating,
    nameDocument,
    dropPaletteItem,
    duplicateMultiSelected,
    contextMenu,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    turnSelected,
    editCursorAtEnd,
    editingId,
    embedMode,

    exitFormatTool,
    startFormatPainter,
    fitToScreen,
    followLink,
    formatSourceId,
    handleCanvasDoubleClick,
    hydrated,
    identityOnlyScreenOpen,
    imageContext,
    isOwner,
    canShareDocument,
    setSearchOpen,
    setShareDialogOpen,
    setSettingsOpen,
    loadAllTabs,
    facilitator,
    isPinchingRef,
    isReadOnly,
    can,
    livePresence,
    mapPosition,
    narrowMultiSelection,
    newDocument,
    pendingDraw,
    redo,
    peerRows,
    remoteSelectionsByElement,

    retryActiveTabLoad,

    selectElement,
    selectMarquee,
    selfParticipant,
    sessionShareCode,
    followMe,
    tabs,
    setCanvasTool,
    setCanvasThemeTab,
    setContextMenu,
    setEditingId,
    setExportOpen,
    setExportScope,
    setFormatSourceId,
    setLinkPickerOpenForId,
    setMapPosition,
    setMultiSelectedIds,
    setSelectedId,
    deleteElementById,
    setTextAlignSelected,
    setViewportOffset,
    setViewportZoom,
    shiftDupGhostIds,
    snapGuideStore,
    tabSummaries,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    undo,
    userPreferences,
    loadedTabIds,
    applyElementDelta,
  } = useEditorContext();
  // Somebody else is running this session (docs/specs/012-collaboration/facilitator.md). The facilitator verbs
  // below fall away for everybody else, exactly as they do on a read-only
  // surface; the responses beside them stay, because answering is the point.
  const runBlocked = facilitator.sessionToolsBlocked;
  // The canvas's role gates, read from `can` (docs/specs/013-workspace/share-roles.md "Tests").
  const gates = roleGates(can, runBlocked);
  // The Timer and Stopwatch faces run on `can.takePart`, never in an embed (docs/specs/009-elements/timer-and-stopwatch.md
  // "Share roles").
  useTimerPieceControls(can.takePart && !embedMode, applyElementDelta);
  // The facilitator's menu on an element somebody else is holding (docs/specs/007-editor/editor-app.md).
  // Null when closed. Holders are captured at open time rather than re-read on
  // render: if the holder lets go while the menu is up it closes on the next
  // outside click anyway, and a list that emptied underneath would leave a
  // menu with nothing in it.
  const [lockedMenu, setLockedMenu] = useState<LockedMenuState>(null);
  // The canvas paints the backdrop the VIEWER resolves, not blindly the one
  // the tab stores: a tab on the Default theme follows this browser's
  // appearance (docs/specs/007-editor/editor-app.md). Subscribing to the appearance here is what makes the
  // canvas repaint when it changes, resolveViewBackdrop would otherwise read a
  // module store nothing re-renders for.
  const { appearance } = useAppearance();
  const landscapePhone = useIsLandscapePhone();
  // A retired element's placeholder Delete (docs/specs/002-project-scope/not-in-livehuddle.md "Deleting it"):
  // an Editor's alone, read off `can` like every content gate, and the ordinary removal (one undo step).
  const deleteRetired = (id: string) => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (el && can.remove(el)) deleteElementById(id);
  };
  const backdrop = resolveTabBackdrop(activeTab, appearance);
  // Stock colours stored by name are drawn in their version for this canvas, on every tab and in
  // either mode (docs/specs/007-editor/editor-modes.md "One look"). Display only: the projector
  // caches per element, so an unchanged element keeps its identity and the memoised views stay quiet.
  const [projectStockColours] = useState(createStockColourProjector);
  // The document's own Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): offered to a signed-in account that
  // edits the whole space (not a Viewer, a Participant or a one-tab link); the index checks again on every call.
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const canManageWebhooks = canManageWebhooksOf({
    hydrated,
    accountUserId,
    isReadOnly,
    participating,
    sessionTabScope,
  });
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in this viewer's half (docs/specs/011-theme/light-and-dark.md); the map is cached per theme and
  // appearance, so its identity holds and the projector's cache with it.
  const canvasElements = projectStockColours(
    activeTab.elements,
    surface,
    themeViewMap(activeTab.theme, appearance),
    {
      stored: activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
      drawn: backdrop.backgroundColor,
    },
  );
  // Lazy per-tab load gate (docs/specs/006-document/per-tab-storage.md): show a blocking loader / error over
  // the canvas while the active tab's content is still being fetched, so
  // the user never edits a blank placeholder whose autosave would
  // overwrite the real server row. Derived once in useEditorState (it also
  // gates editsBlocked there, so the pointer overlay and the edit lock
  // can't disagree); consumed here for the overlay.
  const tabLoadState = activeTabLoadState;

  // While a label is being edited, ride the element context menu alongside
  // the editor (docs/specs/008-canvas/canvas-and-palette.md), see useEditModeContextMenu.
  useEditModeContextMenu({
    editingId,
    elements: activeTab.elements,
    isReadOnly,
    setContextMenu,
  });

  // The Canvas's props by concern, each read from EditorContext: walking, the menu doors, comments and actions,
  // and the Format panel (useCanvas*Props).
  const walkProps = useCanvasWalkProps(gates);
  const menuProps = useCanvasMenuProps(setLockedMenu);
  const formatProps = useCanvasFormatProps();

  // Object props the canvas boundary compares by identity (docs/specs/008-canvas/canvas-performance.md
  // "The canvas re-renders only for what it shows"): new only when their data changes.
  const activeTheme = getTheme(activeTab.theme);
  return (
    // The tab's theme for faces that dress in it unstored (the image placeholder).
    <CanvasThemeProvider theme={activeTheme}>
      <Canvas
        tabName={activeTab.name}
        tabSummaries={tabSummaries}
        // Portals (docs/specs/009-elements/portal-element.md) can lead to another tab; see Canvas.enterPortal.
        portalTabs={tabs}
        // The Elevator panel's floors not opened yet (docs/specs/009-elements/elevator.md "The panel").
        portalTabsLoaded={loadedTabIds}
        onLoadPortalTabs={() => void loadAllTabs()}
        activeTabId={activeTab.id}
        activeTabLoaded={loadedTabIds.has(activeTab.id)}
        readOnly={isReadOnly}
        takePart={can.takePart}
        accessLevel={can.level}
        alwaysWalks={can.alwaysWalks}
        canShareScreen={gates.shape}
        canMove={can.move}
        canResize={can.resize}
        documentName={documentName}
        // The floor it draws (docs/specs/011-theme/floors.md): a retired diagram pattern a peer on an older build
        // just set reads as its floor, so the canvas never starts an animated backdrop livehuddle no longer offers.
        tabBackgroundPattern={spacePattern(backdrop.backgroundPattern)}
        tabBackgroundColor={backdrop.backgroundColor}
        tabBackgroundOpacity={backdrop.backgroundOpacity ?? 1}
        tabBackgroundPatternScale={activeTab.backgroundPatternScale ?? 1}
        tabPatternColor={backdrop.patternColor}
        tabFont={activeTab.font}
        tabFinish={activeTab.finish}
        mainRef={canvasMainRef}
        isPinchingRef={isPinchingRef}
        setViewportZoom={setViewportZoom}
        onFitToScreen={() => {
          fitToScreen();
          track('Canvas', 'Zoomed', 'Fit');
        }}
        setViewportOffset={setViewportOffset}
        elements={canvasElements}
        projectElement={projectStockColours.one}
        shiftDupGhostIds={shiftDupGhostIds}
        snapGuideStore={snapGuideStore}
        remoteSelectionsByElement={remoteSelectionsByElement}
        peers={peerRows}
        {...walkProps}
        onCanvasPointerMove={(x, y, target) => {
          canvasPointerRef.current = pastePointer(x, y, target ?? null);
          broadcastCursor(x !== null && y !== null ? { x, y } : null);
        }}
        onSelectMarquee={selectMarquee}
        canvasTool={canvasTool}
        onSetCanvasTool={setCanvasTool}
        {...menuProps}
        // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): resolved to a NAME here, where presence lives,
        // so the pill doesn't have to look one up.
        followingName={
          followMe.followingId
            ? (livePresence.find((p) => p.id === followMe.followingId)?.name ?? 'someone')
            : null
        }
        onStopFollowing={followMe.stopFollowing}
        onDuplicateMultiSelected={duplicateMultiSelected}
        onDeleteMultiSelected={deleteMultiSelected}
        onFilterMultiSelected={narrowMultiSelection}
        onExportMultiSelected={() => {
          setExportScope('selection');
          setExportOpen(true);
        }}
        editingId={editingId}
        editCursorAtEnd={editCursorAtEnd}
        formatSourceId={formatSourceId}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddShape={addShape}
        onAddSticker={addSticker}
        onAddLinkCard={addLinkCard}
        onAddAvatar={addAvatar}
        onAddText={addText}
        onAddSticky={addSticky}
        onDropFile={isReadOnly ? undefined : dropBoardFile}
        onAddImage={addImage}
        onBeginRoomWalls={beginRoomWalls}
        pendingDraw={pendingDraw}
        onCommitDraw={commitDraw}
        onCommitRoomWalls={commitRoomWalls}
        settings={userPreferences}
        onCancelDraw={cancelDrawShape}
        onUndo={undo}
        onRedo={redo}
        mapPosition={mapPosition}
        onMoveMap={(x, y) =>
          // Equality-guarded so a drag tick that resolves to the same spot
          // doesn't spin the render loop (max update depth).
          setMapPosition((p) => (p && p.x === x && p.y === y ? p : { x, y }))
        }
        onResetMap={() => setMapPosition((p) => (p === null ? p : null))}
        userPreferences={userPreferences}
        {...formatProps}
        // Bottom-dock Theme & canvas button (docs/specs/011-theme/canvas-and-theme-dialog.md): opens the
        // CanvasThemeDialog on its home, the Looks and the Fine-tune rows.
        onOpenCanvasTheme={
          isReadOnly || embedMode
            ? undefined
            : () => {
                setCanvasThemeTab('looks');
                track('UI', 'Opened', 'ThemePicker');
              }
        }
        // No Tidy Up button: Auto Layout is not in livehuddle (docs/specs/008-canvas/layout-cleanup.md).
        currentDocumentId={documentId}
        currentShareCode={sessionShareCode}
        onRenameCurrentDocument={nameDocument}
        onNewDocument={newDocument}
        explorerMenuActions={{
          // The header's Share gate: the owner, or a joined member of the document's team
          // (docs/specs/013-workspace/folders.md, docs/specs/013-workspace/team-shared-documents.md).
          onShare:
            canShareDocument && hydrated
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
        }}
        onDeselect={() => {
          // Clicking empty canvas wraps up the Format tool (restoring the pre-Format tool) so a
          // background click is the quick way out of paint mode (docs/specs/008-canvas/canvas-and-palette.md).
          if (canvasTool === 'format') exitFormatTool();
          setSelectedId(null);
          setMultiSelectedIds(new Set());
          setEditingId(null);
          setFormatSourceId(null);
          setContextMenu(null);
        }}
        onSelect={selectElement}
        onBeginDrag={beginDrag}
        onPressArmedAction={pressArmedAction}
        onBeginEdit={beginEdit}
        onCommitLabel={commitLabel}
        onDeleteRetired={isReadOnly ? undefined : deleteRetired}
        onCancelEdit={cancelEdit}
        onShiftSelect={toggleInMultiSelect}
        onExitFormatTool={exitFormatTool}
        onStartFormatPainter={isReadOnly ? undefined : startFormatPainter}
        onSetTextAlign={setTextAlignSelected}
        onFollowLink={followLink}
        onEditLink={isReadOnly ? undefined : setLinkPickerOpenForId}
        imageContext={imageContext}
        // The visitor name prompt shows for EVERYONE, view-role visitors included: it only writes their own
        // participant row, so there's no 403, and they should set a name before others see them in presence.
        showIdentityPrompt={identityOnlyScreenOpen}
        hydrated={hydrated}
        // Visitor on someone else's document + signed in → lock the
        // identity input to their account name. Owner branch never
        // shows the identity prompt so `lockedName` is moot there;
        // pure guests pass null and keep the editable name field.
        identityLockedName={!isOwner && accountUserId ? accountDisplayName : null}
        welcomeOpen={anyWelcomeOpen}
        selfParticipant={selfParticipant}
        onConfirmIdentity={confirmIdentity}
        onCancelIdentity={cancelIdentity}
        tabThemeId={(activeTab.theme as ThemeId | undefined) ?? 'brand'}

        onToggleAspectLock={toggleAspectLockSelected}
        onDropPalette={dropThenDisarm(dropPaletteItem, cancelDrawShape)}
        onDeleteSelected={deleteSelected}
        // One gesture, one answer: while the element menu is open the
        // selection popover stands down (see deriveCanvasSelection).
        elementMenuOpen={contextMenu?.mode === 'element'}
        onDuplicateSelected={duplicateSelected}
        onBringSelectedToFront={stackSelectedFront}
        onTurnSelected={turnSelected}
        onSendSelectedToBack={stackSelectedBack}
        onCanvasDoubleClick={handleCanvasDoubleClick}
        tabLoadState={tabLoadState}
        onRetryTabLoad={retryActiveTabLoad}
        // Embeds (docs/specs/013-workspace/embeds.md) hide every floating panel and badge.
        chromeAway={embedMode}
        // A phone held sideways has no Explorer at all (docs/specs/007-editor/editor-app.md "A phone
        // held sideways"): too short for it, and no way to bring it back; turn the phone upright.
        explorerHidden={landscapePhone}
      />
      {lockedMenu ? (
        <LockedElementMenu
          at={lockedMenu.at}
          holders={lockedMenu.holders}
          onRelease={(presenceId) =>
            facilitator.releaseSelectionLock(presenceId, lockedMenu.elementId)
          }
          onClose={() => setLockedMenu(null)}
        />
      ) : null}
      {documentId !== null && (
        <ItemWebhooksDialog
          open={webhooksOpen}
          onClose={() => setWebhooksOpen(false)}
          itemId={documentId}
          app="livehuddle"
          title={documentName}
          shareCode={sessionShareCode}
        />
      )}
    </CanvasThemeProvider>
  );
}
