'use client';

import { PARTICIPANT_CANVAS_TOOLS } from '@/components/palette/palette-layouts';
import { roleGates } from '@/lib/editor-capabilities';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { pastePointer } from '@liveworkspace/workbench/lib/canvas-pointer';
import { dropThenDisarm } from '@liveworkspace/workbench/lib/palette-drop';
import { describeOne } from '@/lib/element-names';
import {
  canvasSurface,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BUTTON_MODE,
  PEN_INK,
  spacePattern,
} from '@livehuddle/document';
import { createStockColourProjector } from '@/lib/stock-colour-projector';
import { drawnArrowAsShown } from '@/lib/drawn-arrow-preview';
import { useState } from 'react';

import { elementMenuAnchor } from '@liveworkspace/workbench/lib/context-menu-anchor';
import {
  LockedElementMenu,
  type LockHolder,
} from '@liveworkspace/workbench/components/canvas/LockedElementMenu';

import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { getTheme, resolveTabBackdrop, themeViewMap, type ThemeId } from '@/lib/themes';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsLandscapePhone } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useTimerPieceControls } from '@/lib/timer-piece-controls';
import { CanvasThemeProvider } from '@/components/canvas/CanvasSurfaceContext';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Canvas element's wiring, lifted out of EditorView (which carried
// ~500 lines of prop plumbing for it). Reads everything straight from
// EditorContext — the same host pattern as EditorModals /
// EditorContextMenuHost — plus the handful of locals only the Canvas
// props consume (the memoised Explorer list props, the owner-badge
// resolution).
export function EditorCanvasHost() {
  const {
    activeTab,
    activeTabLoadState,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatPanelPosition,
    setFormatPanelPosition,

    addAnnotation,
    addArrow,
    addAvatar,
    beginArrowBend,
    beginArrowScale,
    addSticker,
    addImage,
    addLinkCard,
    addShape,
    addSticky,
    dropBoardFile,
    addText,
    anyWelcomeOpen,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
    beginArrowTranslate,
    beginDrag,
    pressArmedAction,
    beginEdit,
    beginEndpointDrag,
    beginFreehand,
    beginHighlighter,
    beginShapePen,
    beginPolygon,
    beginRoomWalls,
    broadcastAvatar,
    broadcastAvatarPush,
    broadcastAvatarSay,
    toggleDoor,
    broadcastCallSignal,
    callsRoom,
    avatarShove,
    walkIn,
    avatarAtRef,
    pressFocusButton,
    broadcastCursor,
    canvasPointerRef,
    cancelConnect,
    cancelDrawShape,
    cancelEdit,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,
    participantsByTab,
    keepWalkingTo,

    confirmIdentity,
    cancelIdentity,

    accountDisplayName,
    accountUserId,
    actionRows,
    commentRows,
    commentsPanelPosition,
    commitDraw,
    commitFreehand,
    commitPolygon,
    commitRoomWalls,
    commitPath,
    commitPathEdit,
    styleNewElement,
    commitLabel,
    deleteCurvePoint,
    deleteMultiSelected,
    deleteSelected,
    documentId,
    documentName,
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
    lockedByOther,
    mapPosition,
    narrowMultiSelection,
    newDocument,
    openActionPopover,
    completeAction,
    reopenAction,
    openComments,
    openNote,
    pendingDraw,
    redo,
    remoteAvatarRows,
    remoteCursorRows,
    remoteSelectionsByElement,

    retryActiveTabLoad,

    selectElement,
    selectMarquee,
    selfParticipant,
    sessionShareCode,
    exitAvatarTool,
    pressModeButton,
    followMe,
    tabs,
    setCanvasTool,
    setCanvasThemeTab,
    setCommentsPanelPosition,
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
    drag,
    loadedTabIds,
    applyElementDelta,
  } = useEditorContext();
  // A pointer note's tip handle (docs/specs/009-elements/pointer-note.md).
  // A free arrow's frame stands down while a handle reshapes it (arrow-bending.md).
  const reshapingArrowId =
    drag &&
    (drag.kind === 'arrow-bend' ||
      drag.kind === 'arrow-curve' ||
      drag.kind === 'arrow-elbow' ||
      drag.kind === 'arrow-endpoint')
      ? drag.arrowId
      : null;

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
  const [lockedMenu, setLockedMenu] = useState<{
    elementId: string;
    at: { x: number; y: number };
    holders: LockHolder[];
  } | null>(null);
  // The canvas paints the backdrop the VIEWER resolves, not blindly the one
  // the tab stores: a tab on the Default theme follows this browser's
  // appearance (docs/specs/007-editor/editor-app.md). Subscribing to the appearance here is what makes the
  // canvas repaint when it changes — resolveViewBackdrop would otherwise read a
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
  // the editor (docs/specs/008-canvas/canvas-and-palette.md) — see useEditModeContextMenu.
  useEditModeContextMenu({
    editingId,
    elements: activeTab.elements,
    isReadOnly,
    setContextMenu,
  });

  // The element the format brush is loaded from (docs/specs/010-palette/stickers.md), for the panel's
  // preview. Resolved here rather than in the panel so the panel stays a
  // renderer and never reaches into the tab.
  const formatSource = formatSourceId
    ? (activeTab.elements.find((el) => el.id === formatSourceId) ?? null)
    : null;

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
        whiteboardInk={PEN_INK[surface]}
        previewDrawnArrow={(intent, startX, startY, endX, endY) =>
          drawnArrowAsShown(intent, startX, startY, endX, endY, {
            elements: activeTab.elements,
            theme: activeTheme,
            styleNewElement,
            surface,
          })
        }
        shiftDupGhostIds={shiftDupGhostIds}
        snapGuideStore={snapGuideStore}
        remoteSelectionsByElement={remoteSelectionsByElement}
        remoteCursors={remoteCursorRows}
        remoteAvatars={remoteAvatarRows}
        onAvatarPresence={broadcastAvatar}
        // Who could see a character standing still: alone, its heartbeat rests (docs/specs/008-canvas/avatar-mode.md).
        avatarPeers={livePresence.length}
        // Avatar mode (docs/specs/008-canvas/avatar-mode.md): clicking a peer's character walks over and
        // shoves it; their own client decides what to do with the request.
        onAvatarPush={broadcastAvatarPush}
        // A walking click on a Door next to you swings it (docs/specs/008-canvas/avatar-mode.md "Clicking a piece").
        onToggleDoor={toggleDoor}
        onAvatarSay={broadcastAvatarSay}
        // Proximity audio (docs/specs/012-collaboration/proximity-audio.md): only with a room to talk in.
        onCallSignal={callsRoom ? broadcastCallSignal : undefined}
        avatarShove={avatarShove}
        walkIn={walkIn}
        avatarAtRef={avatarAtRef}
        // An Editor's alone: a Participant and a Viewer are always walking (docs/specs/013-workspace/share-roles.md
        // "Always walking").
        walkToggle={!embedMode && !can.alwaysWalks}
        // Bring Focus (docs/specs/012-collaboration/bring-focus.md) moves everyone's view, so it is running the
        // session: an Editor's (docs/specs/013-workspace/share-roles.md), and the facilitator's while somebody holds the
        // baton (docs/specs/012-collaboration/facilitator.md): "everybody look here" is the same act as "everybody
        // stop and listen". Undefined renders the face inert, which is what a
        // read-only surface already gets.
        onPressFocusButton={gates.run ? pressFocusButton : undefined}
        onCanvasPointerMove={(x, y, target) => {
          canvasPointerRef.current = pastePointer(x, y, target ?? null);
          broadcastCursor(x !== null && y !== null ? { x, y } : null);
        }}
        onSelectMarquee={selectMarquee}
        canvasTool={canvasTool}
        onSetCanvasTool={setCanvasTool}
        onExitAvatarMode={exitAvatarTool}
        // Mode button (docs/specs/009-elements/mode-button.md): pressing one is exactly picking that mode from
        // the palette, so it goes through the same setter — telemetry, the
        // selection clear, and the empty-canvas guard all included. Pressing it
        // again, while already in that mode, hands you back your previous one.
        // A read-only session presses only the modes it has (PARTICIPANT_CANVAS_TOOLS, docs/specs/013-workspace/share-roles.md).
        // Avatar Pad (docs/specs/009-elements/avatar-pad.md "Pressing it"): every role may walk, so a press is the
        // Avatar pick for anyone; the canvas has already told the walk which pad to start on.
        onPressAvatarPad={() => pressModeButton('avatar')}
        // The Directory's Walk There and a ride's arrival (docs/specs/009-elements/directory.md, elevator.md): the
        // Avatar pick for anyone, only when not already walking (the pick toggles).
        onEnterAvatarMode={() => {
          if (canvasTool !== 'avatar') pressModeButton('avatar');
        }}
        tabPresence={participantsByTab}
        // Travel (a Portal, an Elevator, the Directory's Go) switches tab without ending Avatar mode
        // (docs/specs/008-canvas/avatar-mode.md "Changing tab").
        onTravelToTab={(tabId) => {
          keepWalkingTo(tabId);
          followLink({ kind: 'tab', tabId });
        }}
        // A Participant's and a Viewer's buttons are inert faces: they are always walking, so none can switch them.
        onPressModeButton={
          can.alwaysWalks
            ? undefined
            : (element) => {
                const mode = element.mode ?? DEFAULT_BUTTON_MODE;
                if (isReadOnly && !PARTICIPANT_CANVAS_TOOLS.includes(mode)) return;
                pressModeButton(mode);
              }
        }
        // The `…` on a Behaviours element's face (docs/specs/008-canvas/canvas-and-palette.md). Anchored from the
        // ELEMENT's rect, not the trigger's, so it lands exactly where a
        // right-click on the same element would — one menu, one position,
        // whichever way you asked for it.
        onOpenElementSettings={
          isReadOnly
            ? undefined
            : (elementId) => {
                const node = document.querySelector(elementSelector(elementId));
                if (!(node instanceof HTMLElement)) return;
                const { x, y } = elementMenuAnchor(node.getBoundingClientRect());
                setContextMenu({ mode: 'element', elementId, x, y });
              }
        }
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
        onAddAnnotation={addAnnotation}
        onAddLinkCard={addLinkCard}
        onAddAvatar={addAvatar}
        onAddText={addText}
        onAddSticky={addSticky}
        onDropFile={isReadOnly ? undefined : dropBoardFile}
        onAddImage={addImage}
        onAddArrow={addArrow}
        reshapingArrowId={reshapingArrowId}
        onBeginFreehand={beginFreehand}
        onBeginHighlighter={beginHighlighter}
        onBeginShapePen={beginShapePen}
        onBeginPolygon={beginPolygon}
        onBeginRoomWalls={beginRoomWalls}
        pendingDraw={pendingDraw}
        onCommitDraw={commitDraw}
        onCommitFreehand={commitFreehand}
        onCommitPolygon={commitPolygon}
        onCommitRoomWalls={commitRoomWalls}
        onCommitPath={commitPath}
        onCommitPathEdit={commitPathEdit}
        onDressPath={styleNewElement}
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
        formatConfig={formatConfig}
        onToggleFormatGroup={onToggleFormatGroup}
        onSetFormatMode={onSetFormatMode}
        // What the brush holds, described for the panel's preview (docs/specs/010-palette/stickers.md):
        // the loaded element's name and the three colours the swatch draws.
        formatBrushSource={
          formatSource
            ? {
                name: describeOne(formatSource),
                fill: 'fillColor' in formatSource ? formatSource.fillColor : undefined,
                stroke: 'strokeColor' in formatSource ? formatSource.strokeColor : undefined,
                textColor: 'textColor' in formatSource ? formatSource.textColor : undefined,
              }
            : null
        }
        formatPanelPosition={formatPanelPosition}
        onMoveFormatPanel={(x, y) => setFormatPanelPosition({ x, y })}
        onResetFormatPanel={() => setFormatPanelPosition(null)}

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
        // No Tidy Up button: it was Diagram mode's (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button").
        commentRows={commentRows}
        commentsPanelPosition={commentsPanelPosition}
        onMoveCommentsPanel={(x, y) => setCommentsPanelPosition({ x, y })}
        onResetCommentsPanel={() => setCommentsPanelPosition(null)}
        onOpenCommentsForElement={(id) => {
          setSelectedId(id);
          openComments(id);
        }}
        actionRows={actionRows}
        onOpenActionForElement={(id) => {
          setSelectedId(id);
          openActionPopover(id);
        }}
        onToggleActionDone={
          isReadOnly
            ? undefined
            : (id, done, actionId) =>
                done ? completeAction(id, actionId) : reopenAction(id, actionId)
        }
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
          onSearch: () => openSearchWithPrefetch(setSearchOpen, loadAllTabs),
          onOpenSettings: () => {
            setSettingsOpen(true);
            track('UI', 'Opened', 'Settings');
          },
        }}
        onDeselect={() => {
          // Clicking empty canvas also cancels an armed arrow-connect, and
          // wraps up the Format tool — restoring the pre-Format tool — so a
          // background click is the quick way out of paint mode (docs/specs/008-canvas/canvas-and-palette.md).
          if (canvasTool === 'format') exitFormatTool();
          cancelConnect();
          setSelectedId(null);
          setMultiSelectedIds(new Set());
          setEditingId(null);
          setFormatSourceId(null);
          setContextMenu(null);
        }}
        onSelect={selectElement}
        onElementContextMenu={(id, sx, sy) => {
          // Concurrent-selection lock (docs/specs/007-editor/editor-app.md): a peer holds this
          // element, so it can't be selected, dragged, or edited — don't
          // pop a dead context menu on it either. Same gate as
          // selectElement. A Participant or a Viewer still opens its own menu there
          // (comments, a link), less Edit Text (docs/specs/008-canvas/element-menu-quick-bar.md).
          //
          // The one exception is whoever is running the session
          // (docs/specs/012-collaboration/facilitator.md): for them a locked element has exactly one
          // available action, freeing it, and that gets its own small menu
          // rather than the element's real one, whose every other row
          // would be dead. See LockedElementMenu.
          if (!isReadOnly && lockedByOther(id)) {
            const holders = remoteSelectionsByElement.get(id);
            if (facilitator.canReleaseSelectionLock && holders?.length) {
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
        }}
        onMultiContextMenu={
          isReadOnly
            ? undefined
            : // Right-click on a group / multi-selection always OPENS at the
              // cursor (a direct set, like onElementContextMenu). A toggle here
              // meant a lingering multi menu — which clicking elsewhere doesn't
              // dismiss, since element pointerdown stops propagation — got
              // closed by the next right-click instead of reopening, so the
              // group menu "wouldn't open".
              (sx, sy) => setContextMenu({ mode: 'multi', x: sx, y: sy })
        }
        onOpenMultiContextMenu={
          isReadOnly
            ? undefined
            : (sx, sy) =>
                // Toggle: the selection toolbar's ⋯ button closes an
                // already-open multi menu instead of reopening it.
                setContextMenu((cur) =>
                  cur && cur.mode === 'multi' ? null : { mode: 'multi', x: sx, y: sy },
                )
        }
        onOpenElementContextMenu={
          isReadOnly
            ? undefined
            : (id, sx, sy) =>
                // Ellipsis is a toggle: clicking it while its menu is already
                // open for this element closes it (the ContextMenu ignores the
                // trigger's mousedown so this onClick gets to decide).
                setContextMenu((cur) =>
                  cur && cur.mode === 'element' && cur.elementId === id
                    ? null
                    : { mode: 'element', elementId: id, x: sx, y: sy },
                )
        }
        onCanvasContextMenu={
          isReadOnly
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
                })
        }
        onBeginDrag={beginDrag}
        onPressArmedAction={pressArmedAction}
        onBeginEdit={beginEdit}
        onCommitLabel={commitLabel}
        onDeleteRetired={isReadOnly ? undefined : deleteRetired}
        onCancelEdit={cancelEdit}
        onBeginEndpointDrag={beginEndpointDrag}
        onBeginArrowTranslate={beginArrowTranslate}
        onBeginArrowCurveDrag={beginArrowCurveDrag}
        onBeginArrowCurvePointDrag={beginArrowCurvePointDrag}
        onBeginArrowBend={beginArrowBend}
        onBeginArrowScale={beginArrowScale}
        onDeleteCurvePoint={deleteCurvePoint}
        onBeginArrowLabelDrag={beginArrowLabelDrag}
        onBeginArrowElbowDrag={beginArrowElbowDrag}
        onShiftSelect={toggleInMultiSelect}
        onExitFormatTool={exitFormatTool}
        onStartFormatPainter={isReadOnly ? undefined : startFormatPainter}
        onSetTextAlign={setTextAlignSelected}
        onFollowLink={followLink}
        onOpenComments={openComments}
        onOpenAction={openActionPopover}
        onOpenNote={openNote}
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
    </CanvasThemeProvider>
  );
}
