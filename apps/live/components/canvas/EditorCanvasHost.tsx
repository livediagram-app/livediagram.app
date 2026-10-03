'use client';

import { pastePointer } from '@/lib/canvas-pointer';
import { dropThenDisarm } from '@/lib/palette-drop';
import { resolvePanelLayout } from '@/lib/user-preferences';
import { describeOne } from '@/lib/element-names';
import { canvasSurface, DEFAULT_BUTTON_MODE, PEN_INK } from '@livediagram/document';
import { createStockColourProjector } from '@/lib/stock-colour-projector';
import { drawnArrowAsShown } from '@/lib/drawn-arrow-preview';
import { useMemo, useState } from 'react';
import { isVoteHost } from '@livediagram/document';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import { LockedElementMenu, type LockHolder } from '@/components/canvas/LockedElementMenu';
import { participantKey } from '@/lib/identity';
import { usePreferenceHandlers } from '@/hooks/ui/usePreferenceHandlers';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { useTeamFolderActions } from '@/hooks/ui/useTeamFolderActions';
import { getTheme, themeChartPalette, type ThemeId } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { readDrawPattern } from '@/lib/whiteboard-dock-prefs';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import type { LibraryShapeRef } from '@/lib/shape-library-dnd';
import { useStableCollab } from '@/components/canvas/element-layer-props';

// The Canvas element's wiring, lifted out of EditorView (which carried
// ~500 lines of prop plumbing for it). Reads everything straight from
// EditorContext — the same host pattern as EditorModals /
// EditorContextMenuHost — plus the handful of locals only the Canvas
// props consume (the quick-connect arrow starter, the memoised Explorer
// list props, the owner-badge resolution).
export function EditorCanvasHost() {
  const {
    activeTab,
    scrollIntoView,
    activeTabLoadState,
    activeTabLocked,
    presentingElements,
    slideDeck,
    slideDeckPanelPosition,
    setSlideDeckPanelPosition,
    layers,
    activeLayerId,
    layerInertIds,
    layerCounts,
    layersPanelPosition,
    pollPanelPosition,
    setPollPanelPosition,
    votePanelPosition,
    avatarPanelPosition,
    laserPanelPosition,
    spotlightPanelPosition,
    setSpotlightPanelPosition,
    eraserPanelPosition,
    setEraserPanelPosition,
    eraserConfig,
    onChangeEraserField,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatPanelPosition,
    setFormatPanelPosition,
    laserConfig,
    onChangeLaserField,
    setLaserPanelPosition,
    setVotePanelPosition,
    setAvatarPanelPosition,
    toggleRecentExclusion,
    favouriteIds,
    toggleFavourite,
    voteResults,
    jumpToVoteResult,
    livePoll,
    setLayersPanelPosition,
    layersMinimized,
    setLayersMinimized,
    setActiveLayer,
    addLayer,
    renameLayer,
    removeLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayer,
    mergeActiveLayer,
    setLayerOpacityLive,
    clearLayer,
    hideOtherLayersOp,
    layerPreviewId,
    setLayerPreviewId,
    addAnnotation,
    addArrow,
    addAvatar,
    addBanner,
    addCallout,
    beginArrowBend,
    beginArrowScale,
    addHeader,
    addHero,
    addIcon,
    addSticker,
    addImage,
    addLinkCard,
    addVideo,
    addProcess,
    addRailPointSelected,
    addShape,
    addStatRow,
    addSticky,
    esBoard,
    addNextNote,
    photoImportAvailable,
    photoImportBlocked,
    openPhotoImport,
    readPhotoFile,
    dropBoardFile,
    photoDraft,
    createBlocked,
    addTable,
    addTechIcon,
    insertLibraryShape,
    addText,
    aiCapable,
    aiPanelPosition,
    aiPanelVisible,
    anyWelcomeOpen,
    appendTableColumnSelected,
    appendTableRowSelected,
    applyAiElements,
    beginAnchorDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
    beginArrowTranslate,
    beginDrag,
    beginEdit,
    beginEndpointDrag,
    beginErase,
    beginFormatPainter,
    beginFreehand,
    beginHighlighter,
    beginShapePen,
    beginPolygon,
    broadcastAvatar,
    broadcastAvatarPush,
    avatarShove,
    fireReaction,
    pressFocusButton,
    reactionBursts,
    clearReactionBurst,
    broadcastCursor,
    broadcastLaser,
    canvasPointerRef,
    cancelConnect,
    cancelDrawShape,
    cancelEdit,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,
    castVote,
    chooseTemplate,
    clearTimer,
    clearVote,
    clerkDisplayName,
    clerkUserId,
    actionRows,
    commentRows,
    commentsPanelPosition,
    commitDraw,
    commitFreehand,
    commitPolygon,
    commitPath,
    commitPathEdit,
    styleNewElement,
    commitLabel,
    commitTable,
    commitHeaderSize,
    createFolder,
    deleteCurvePoint,
    deleteDocument,
    deleteFolder,
    deleteMultiSelected,
    deleteSelected,
    documentId,
    documentList,
    documentListLoading,
    documentName,
    dismissSharedDocument,
    distGuides,
    dropIconOnElement,
    dropPaletteItem,
    duplicateDocument,
    duplicateMultiSelected,
    contextMenu,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    editCursorAtEnd,
    editingId,
    effectiveTemplatePickerMode,
    embedMode,
    endVote,
    exitFormatPainter,
    exitFormatTool,
    explorerPosition,
    fitToScreen,
    folders,
    followLink,
    formatSourceId,
    handleCanvasDoubleClick,
    hydrated,
    identityOnlyScreenOpen,
    imageContext,
    isOwner,
    setSearchOpen,
    setShareDialogOpen,
    setSettingsOpen,
    loadAllTabs,
    facilitator,
    isPinchingRef,
    isReadOnly,
    laserTrailRows,
    livePresence,
    lockedByOther,
    mapPosition,
    moveDocumentToFolder,
    moveDocumentTo,
    multiSelectedIds,
    narrowMultiSelection,
    newDocument,
    openActionPopover,
    openAssignActionDialog,
    completeAction,
    reopenAction,
    openCellLinkPicker,
    openComments,
    openDocument,
    openNote,
    openTemplatePicker,
    palettePosition,
    pauseTimer,
    pendingDraw,
    redo,
    remoteAvatarRows,
    remoteCursorRows,
    remoteSelectionsByElement,
    renameFolder,
    resetTimer,
    resumeTimer,
    retractVote,
    voteReview,
    nextVoteResult,
    prevVoteResult,
    doneVoteReview,
    retryActiveTabLoad,
    revealVote,
    selectedId,
    selectElement,
    selectMarquee,
    confirm,
    selfParticipant,
    setAiPanelPosition,
    exitAvatarTool,
    pressModeButton,
    pressSessionButton,
    revealedIds,
    toggleRevealForMe,
    setSessionConfigFor,
    setTimerDuration,
    addComment,
    deleteComment,
    resolveThread,
    unresolveThread,
    pickerFor,
    collabElements,
    quiz,
    qaBoard,
    followMe,
    keepPollResults,
    tabs,
    setCanvasTool,
    setCanvasThemeTab,
    setCommentsPanelPosition,
    setContextMenu,
    setDocumentList,
    setDocumentName,
    setEditingId,
    setExplorerPosition,
    setExportOpen,
    setExportScope,
    setCodeEditOpenForId,
    setFormatSourceId,
    setLinkPickerOpenForId,
    setMapPosition,
    setMultiSelectedIds,
    setPalettePosition,
    setRailLabelSelected,
    setSelectedId,
    toggleChecklistItem,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setHeroCaptionLine,
    growMindNode,
    abandonMindNode,
    setTextAlignSelected,
    setUserPreferences,
    setViewportOffset,
    setViewportZoom,
    sharedDocuments,
    shiftDupGhostIds,
    skipTemplatePicker,
    snapGuides,
    snapTargets,
    spawnConnectSelected,
    startTimer,
    startVote,
    tabSummaries,
    teamDocuments,
    teamFolders,
    teams,
    refreshTeamLibraries,
    templateGridOpen,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    toggleZenMode,
    undo,
    userPreferences,
    viewportOffset,
    viewportZoom,
    zenMode,
    whiteboardDock,
    drag,
    editorMode,
    infographicPages,
  } = useEditorContext();
  // The viewer's editor mode (docs/specs/007-editor/editor-modes.md): Draw brings the dock and its
  // rules into focus; the board look keys on it through hasBoardLook.
  const drawMode = editorMode.mode === 'draw';
  // A shape dragged from My shapes (docs/specs/013-workspace/shape-libraries.md): resolved against the
  // owner's libraries, then placed at the drop point.
  const { libraries } = useShapeLibraries();
  const dropLibraryShape = (ref: LibraryShapeRef, at: { x: number; y: number }) => {
    const item = libraries
      .find((l) => l.id === ref.libraryId)
      ?.items.find((i) => i.id === ref.itemId);
    if (!item) {
      console.warn('[shape-libraries] drop ignored', { reason: 'unknown shape' });
      return;
    }
    insertLibraryShape(item, at);
  };
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
  // The facilitator's menu on an element somebody else is holding (docs/specs/007-editor/live-app.md).
  // Null when closed. Holders are captured at open time rather than re-read on
  // render: if the holder lets go while the menu is up it closes on the next
  // outside click anyway, and a list that emptied underneath would leave a
  // menu with nothing in it.
  const [lockedMenu, setLockedMenu] = useState<{
    elementId: string;
    at: { x: number; y: number };
    holders: LockHolder[];
  } | null>(null);
  // A stable reference for the list-shaped prop the Explorer takes, so the
  // (React.memo'd) panel doesn't re-render on every drag frame just because
  // the editor re-rendered. It recomputes only when its real input changes.
  const explorerTeams = useMemo(() => teams.map((t) => ({ id: t.id, name: t.name })), [teams]);
  // Team-library folder mutations for the Explorer panel's team tree
  // (docs/specs/013-workspace/team-shared-documents.md) - see useTeamFolderActions.
  const viewerId = selfParticipant?.id ?? null;
  const onTeamFolders = useTeamFolderActions({
    clerkUserId,
    viewerId,
    teamFolders,
    refreshTeamLibraries,
    confirm,
  });
  // The canvas paints the backdrop the VIEWER resolves, not blindly the one
  // the tab stores: a tab on the Default theme follows this browser's
  // appearance (docs/specs/007-editor/live-app.md). Subscribing to the appearance here is what makes the
  // canvas repaint when it changes — resolveViewBackdrop would otherwise read a
  // module store nothing re-renders for.
  const { appearance } = useAppearance();
  // The layout this viewport shows (a phone has no Floating, docs/specs/007-editor/toolbar-layout.md).
  const isMobile = useIsMobileViewport();
  const panelLayout = resolvePanelLayout(userPreferences, { mobile: isMobile });
  // The Collaborate panel's jump to a conversation card (docs/specs/012-collaboration/assigned-actions.md §5):
  // true when the row's element is that kind of card, now centred in view.
  const jumpToCard = (id: string, shape: 'comment-pin' | 'action-card'): boolean => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape' || el.shape !== shape) return false;
    scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    return true;
  };
  const backdrop = resolveViewBackdrop(
    activeTab,
    { mode: editorMode.mode, drawPattern: readDrawPattern(userPreferences) },
    appearance,
  );
  // Stock colours stored by name are drawn in their version for this canvas, on every tab and in
  // either mode (docs/specs/007-editor/editor-modes.md "One look"). Display only: the projector
  // caches per element, so an unchanged element keeps its identity and the memoised views stay quiet.
  const [projectStockColours] = useState(createStockColourProjector);
  const surface = canvasSurface(backdrop.backgroundColor);
  const canvasElements = projectStockColours(presentingElements ?? activeTab.elements, surface);
  // Lazy per-tab load gate (docs/specs/006-document/per-tab-storage.md): show a blocking loader / error over
  // the canvas while the active tab's content is still being fetched, so
  // the user never edits a blank placeholder whose autosave would
  // overwrite the real server row. Derived once in useEditorState (it also
  // gates editsBlocked there, so the pointer overlay and the edit lock
  // can't disagree); consumed here for the overlay.
  const tabLoadState = activeTabLoadState;
  // Quick add + connect Arrow starter (docs/specs/008-canvas/canvas-and-palette.md) — see useQuickConnectStart.
  const { handleStartArrow } = useQuickConnectStart({ selectedId, beginAnchorDrag });

  // While a label is being edited, ride the element context menu alongside
  // the editor (docs/specs/008-canvas/canvas-and-palette.md) — see useEditModeContextMenu.
  useEditModeContextMenu({
    editingId,
    elements: activeTab.elements,
    isReadOnly,
    whiteboard: drawMode,
    setContextMenu,
  });

  // Preference writes (the Settings save): see usePreferenceHandlers.
  const { onChangeSettings } = usePreferenceHandlers({
    setUserPreferences,
    selfParticipantId: selfParticipant?.id ?? null,
  });
  // The element the format brush is loaded from (docs/specs/010-palette/stickers.md), for the panel's
  // preview. Resolved here rather than in the panel so the panel stays a
  // renderer and never reaches into the tab.
  const formatSource = formatSourceId
    ? (activeTab.elements.find((el) => el.id === formatSourceId) ?? null)
    : null;

  // The collaboration elements (docs/specs/012-collaboration/estimate-card.md to
  // docs/specs/012-collaboration/roll-call.md). One bag for all their faces; the write handlers drop out
  // entirely for a view-role visitor. Held stable while nothing a face shows changes, so a render here
  // does not re-render every element (docs/specs/008-canvas/canvas-performance.md).
  const collab = useStableCollab({
    // The document-write key, not the owner id — see CollabApi.selfKey.
    selfKey: participantKey(selfParticipant),
    // Ourselves first: livePresence is the REMOTE roster, and an estimate
    // card that can't show your own avatar is showing the wrong room.
    participants: [selfParticipant, ...livePresence],
    tabTimer: activeTab.timer,
    respond: isReadOnly ? undefined : collabElements.respond,
    setResponsesRevealed:
      isReadOnly || runBlocked ? undefined : collabElements.setResponsesRevealed,
    clearResponses: isReadOnly || runBlocked ? undefined : collabElements.clearResponses,
    chooseEstimateScale: isReadOnly ? undefined : collabElements.chooseEstimateScale,
    addIdea: isReadOnly ? undefined : collabElements.addIdea,
    revealIdeas: isReadOnly || runBlocked ? undefined : collabElements.revealIdeas,
    clearIdeas: isReadOnly || runBlocked ? undefined : collabElements.clearIdeas,
    scatterIdeas: isReadOnly || runBlocked ? undefined : collabElements.scatterIdeas,
    pressAgendaItem: isReadOnly || runBlocked ? undefined : collabElements.pressAgendaItem,
    takeRoll: isReadOnly || runBlocked ? undefined : collabElements.takeRoll,
    // The Q&A board (docs/specs/012-collaboration/qa-board.md). Adding and voting stay live for a
    // view-role visitor: the server owns the board and gates them on
    // read access, which is the point of the element. Running it is
    // the facilitator's, else any editor's.
    selfOwnerId: selfParticipant.id,
    selfName: selfParticipant.name,
    addQaNote: qaBoard.addQaNote,
    voteQaNote: qaBoard.voteQaNote,
    discussQaNote: isReadOnly || runBlocked ? undefined : qaBoard.discussQaNote,
    closeQaNote: isReadOnly || runBlocked ? undefined : qaBoard.closeQaNote,
    reopenQaNote: isReadOnly || runBlocked ? undefined : qaBoard.reopenQaNote,
    removeQaNote: isReadOnly || runBlocked ? undefined : qaBoard.removeQaNote,
    clearQaBoard: isReadOnly || runBlocked ? undefined : qaBoard.clearQaBoard,
    // The Quiz (docs/specs/012-collaboration/quiz.md). Picking is everyone's with edit rights;
    // editing and running the round are the facilitator's, else any editor's.
    answerQuiz: isReadOnly ? undefined : quiz.answerQuiz,
    startQuiz: isReadOnly || runBlocked ? undefined : quiz.startQuiz,
    lockQuiz: isReadOnly || runBlocked ? undefined : quiz.lockQuiz,
    revealQuiz: isReadOnly || runBlocked ? undefined : quiz.revealQuiz,
    resetQuiz: isReadOnly || runBlocked ? undefined : quiz.resetQuiz,
    saveQuiz: isReadOnly || runBlocked ? undefined : quiz.saveQuiz,
  });

  return (
    <>
      <Canvas
        tabName={activeTab.name}
        tabSummaries={tabSummaries}
        // Portals (docs/specs/009-elements/portal-element.md) can lead to another tab; see Canvas.enterPortal.
        portalTabs={tabs}
        activeTabId={activeTab.id}
        tabLocked={activeTabLocked}
        readOnly={isReadOnly}
        documentName={documentName}
        tabBackgroundPattern={backdrop.backgroundPattern ?? 'grid'}
        tabBackgroundColor={backdrop.backgroundColor}
        tabBackgroundOpacity={backdrop.backgroundOpacity ?? 1}
        tabBackgroundPatternScale={activeTab.backgroundPatternScale ?? 1}
        tabBackgroundAnimationSpeed={activeTab.backgroundAnimationSpeed ?? 1}
        tabPatternColor={backdrop.patternColor}
        tabFont={activeTab.font}
        mainRef={canvasMainRef}
        isPinchingRef={isPinchingRef}
        viewportZoom={viewportZoom}
        setViewportZoom={setViewportZoom}
        onFitToScreen={() => {
          fitToScreen();
          track('Canvas', 'Zoomed', 'Fit');
        }}
        viewportOffset={viewportOffset}
        setViewportOffset={setViewportOffset}
        // Presenting (docs/specs/012-collaboration/presentation-mode.md) narrows the canvas to one slide's elements. The
        // real canvas still draws them — a slide has to respond to clicks and
        // carry live element state, and there is then exactly one thing that
        // knows how an element looks.
        elements={canvasElements}
        tabLayers={activeTab.layers}
        tabKind={activeTab.kind}
        editorMode={editorMode.mode}
        infographicPages={infographicPages}
        whiteboardDock={whiteboardDock.whiteboard ? whiteboardDock : undefined}
        whiteboardInk={PEN_INK[surface]}
        previewDrawnArrow={(intent, startX, startY, endX, endY) =>
          drawnArrowAsShown(intent, startX, startY, endX, endY, {
            elements: activeTab.elements,
            theme: getTheme(activeTab.theme),
            whiteboard: drawMode,
            styleNewElement,
            surface,
          })
        }
        layerInertIds={layerInertIds}
        shiftDupGhostIds={shiftDupGhostIds}
        snapGuides={snapGuides}
        distGuides={distGuides}
        snapTargets={snapTargets}
        selectedId={selectedId}
        multiSelectedIds={multiSelectedIds}
        remoteSelectionsByElement={remoteSelectionsByElement}
        remoteCursors={remoteCursorRows}
        remoteAvatars={remoteAvatarRows}
        onAvatarPresence={broadcastAvatar}
        // Avatar mode (docs/specs/008-canvas/avatar-mode.md): clicking a peer's character walks over and
        // shoves it; their own client decides what to do with the request.
        onAvatarPush={broadcastAvatarPush}
        avatarShove={avatarShove}
        onFireReaction={isReadOnly ? undefined : fireReaction}
        // Bring Focus (docs/specs/012-collaboration/bring-focus.md) is live for view-role visitors too: it mutates
        // nothing, which makes it the same read-only act as following somebody,
        // and the person who spots the thing worth looking at is often not the
        // one with edit rights.
        // Bring Focus (docs/specs/012-collaboration/bring-focus.md) is the facilitator's while somebody holds the
        // baton (docs/specs/012-collaboration/facilitator.md): "everybody look here" is the same act as "everybody
        // stop and listen". Undefined renders the face inert, which is what a
        // read-only surface already gets.
        onPressFocusButton={runBlocked ? undefined : pressFocusButton}
        reactionBursts={reactionBursts}
        onReactionBurstDone={clearReactionBurst}
        laserTrails={laserTrailRows}
        onCanvasPointerMove={(x, y, target) => {
          canvasPointerRef.current = pastePointer(x, y, target ?? null);
          if (canvasTool === 'laser' && x !== null && y !== null) {
            // The pen rides the sample so peers draw MY laser (docs/specs/008-canvas/laser-panel.md).
            broadcastLaser(x, y, laserConfig);
            // Laser mode hides the cursor indicator on peer screens —
            // the laser dot is the cursor. Clear any prior position.
            broadcastCursor(null);
            return;
          }
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
        onPressModeButton={(element) => pressModeButton(element.mode ?? DEFAULT_BUTTON_MODE)}
        // Session button (docs/specs/012-collaboration/session-button.md) / Reveal zone (docs/specs/009-elements/reveal-zone.md) / Picker (docs/specs/012-collaboration/picker.md):
        // see useBehaviourElements — the press resolves what to do from the
        // element and calls the tool that already exists.
        onPressSessionButton={pressSessionButton}
        sessionStartBlocked={isReadOnly || runBlocked}
        timerState={activeTab.timer ? (activeTab.timer.running ? 'running' : 'paused') : 'none'}
        revealedIds={revealedIds}
        // A cover is the facilitator's to lift while one is running the session
        // (docs/specs/012-collaboration/facilitator.md); with nobody facilitating it stays the private peek it has
        // always been (docs/specs/009-elements/reveal-zone.md).
        onToggleReveal={runBlocked ? undefined : toggleRevealForMe}
        onSetSessionConfig={isReadOnly || runBlocked ? undefined : setSessionConfigFor}
        // The `…` on a Behaviours element's face (docs/specs/008-canvas/canvas-and-palette.md). Anchored from the
        // ELEMENT's rect, not the trigger's, so it lands exactly where a
        // right-click on the same element would — one menu, one position,
        // whichever way you asked for it.
        onOpenElementSettings={
          isReadOnly
            ? undefined
            : (elementId) => {
                const node = document.querySelector(`[data-element-id="${elementId}"]`);
                if (!(node instanceof HTMLElement)) return;
                const { x, y } = elementMenuAnchor(node.getBoundingClientRect());
                setContextMenu({ mode: 'element', elementId, x, y });
              }
        }
        // Comment panels (docs/specs/012-collaboration/comment-pin.md) drive the SAME thread machinery the anchored
        // popover does — it is all keyed by element id already.
        commentSelfId={selfParticipant.id}
        commentPanelActions={
          isReadOnly
            ? undefined
            : {
                add: (id, text, mentions) => addComment(id, text, undefined, mentions),
                remove: deleteComment,
                resolve: resolveThread,
                unresolve: unresolveThread,
              }
        }
        // Action panels (docs/specs/012-collaboration/action-panel.md) drive the SAME action machinery the popover
        // and the Assign Action dialog do. The viewer identity is the one the
        // popover uses: the Clerk account, else the guest participant.
        actionSelfId={clerkUserId ?? selfParticipant.id}
        actionPanelActions={
          isReadOnly
            ? undefined
            : {
                configure: openAssignActionDialog,
                complete: completeAction,
                reopen: reopenAction,
              }
        }
        onRollPicker={pickerFor}
        // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): resolved to a NAME here, where presence lives,
        // so the pill doesn't have to look one up.
        followingName={
          followMe.followingId
            ? (livePresence.find((p) => p.id === followMe.followingId)?.name ?? 'someone')
            : null
        }
        onStopFollowing={followMe.stopFollowing}
        collab={collab}
        onEraseStart={isReadOnly ? undefined : beginErase}
        onDuplicateMultiSelected={duplicateMultiSelected}
        onDeleteMultiSelected={deleteMultiSelected}
        onToggleLockMultiSelected={toggleLockMultiSelected}
        onFilterMultiSelected={narrowMultiSelection}
        onExportMultiSelected={() => {
          setExportScope('selection');
          setExportOpen(true);
        }}
        editingId={editingId}
        editCursorAtEnd={editCursorAtEnd}
        formatSourceId={formatSourceId}
        palettePosition={palettePosition}
        explorerPosition={explorerPosition}
        canUndo={canUndo && !activeTabLocked}
        canRedo={canRedo && !activeTabLocked}
        onAddShape={addShape}
        onAddIcon={addIcon}
        onAddSticker={addSticker}
        onAddTechIcon={addTechIcon}
        onInsertLibraryShape={(item) => void insertLibraryShape(item)}
        onDropIcon={isReadOnly ? undefined : dropIconOnElement}
        onLinkCell={isReadOnly ? undefined : openCellLinkPicker}
        onAddTable={addTable}
        onAddAnnotation={addAnnotation}
        onAddLinkCard={addLinkCard}
        onAddVideo={addVideo}
        onAddBanner={addBanner}
        onAddHero={addHero}
        onAddHeader={addHeader}
        onAddCallout={addCallout}
        onAddStatRow={addStatRow}
        onAddProcess={addProcess}
        onAddAvatar={addAvatar}
        onAddText={addText}
        onAddSticky={addSticky}
        esBoard={esBoard}
        esBoardControls={{
          ...(photoImportAvailable
            ? {
                onImportPhoto: openPhotoImport,
                photoDisabled: photoImportBlocked,
                photoDisabledReason: photoDraft.draftOpen
                  ? 'Finish the current draft first'
                  : undefined,
              }
            : {}),
        }}
        onAddNextNote={createBlocked ? undefined : addNextNote}
        onDropPhoto={readPhotoFile}
        onDropFile={isReadOnly ? undefined : dropBoardFile}
        onDropLibraryShape={isReadOnly ? undefined : dropLibraryShape}
        createBlocked={createBlocked}
        onAddImage={addImage}
        onAddArrow={addArrow}
        reshapingArrowId={reshapingArrowId}
        onBeginFreehand={beginFreehand}
        onBeginHighlighter={beginHighlighter}
        onBeginShapePen={beginShapePen}
        onBeginPolygon={beginPolygon}
        pendingDraw={pendingDraw}
        onCommitDraw={commitDraw}
        onCommitFreehand={commitFreehand}
        onCommitPolygon={commitPolygon}
        onCommitPath={commitPath}
        onCommitPathEdit={commitPathEdit}
        onDressPath={styleNewElement}
        settings={userPreferences}
        onChangeSettings={onChangeSettings}
        // Toolbar (docs/specs/007-editor/toolbar-layout.md) keeps Floating's panels and swaps the
        // Palette + Explorer for the strip and menu button. A phone always shows it.
        toolbarLayout={panelLayout === 'toolbar'}
        onCancelDraw={cancelDrawShape}
        onUndo={undo}
        onRedo={redo}
        onMovePalette={(x, y) => setPalettePosition({ x, y })}
        onResetPalette={() => setPalettePosition(null)}
        onMoveExplorer={(x, y) => setExplorerPosition({ x, y })}
        onResetExplorer={() => setExplorerPosition(null)}
        documentList={documentList}
        folders={folders}
        sharedDocuments={sharedDocuments}
        teams={explorerTeams}
        teamFolders={teamFolders}
        teamDocuments={teamDocuments}
        onDismissShared={dismissSharedDocument}
        documentListLoading={documentListLoading}
        mapPosition={mapPosition}
        onMoveMap={(x, y) =>
          // Equality-guarded so a drag tick that resolves to the same spot
          // doesn't spin the render loop (max update depth).
          setMapPosition((p) => (p && p.x === x && p.y === y ? p : { x, y }))
        }
        onResetMap={() => setMapPosition((p) => (p === null ? p : null))}
        layers={layers}
        activeLayerId={activeLayerId}
        layerCounts={layerCounts}
        layersPanelPosition={layersPanelPosition}
        layersMinimized={layersMinimized}
        onMoveLayersPanel={(x, y) => setLayersPanelPosition({ x, y })}
        onResetLayersPanel={() => setLayersPanelPosition(null)}
        pollPanel={
          // Results are for the host and for anyone who has responded
          // (docs/specs/012-collaboration/live-poll.md) — answering is what buys you the tally. A local
          // Dismiss hides it without ending the poll for everyone.
          livePoll.poll && !livePoll.dismissed && (livePoll.isHost || livePoll.myAnswer)
            ? {
                poll: livePoll.poll,
                answers: livePoll.answers,
                isHost: livePoll.isHost,
                onEnd: livePoll.endPoll,
                // docs/specs/012-collaboration/poll-result-capture.md: drops the tallies so far onto the canvas without
                // ending the poll. Read-only visitors never see it — they are
                // never the host.
                onKeepResults: isReadOnly ? undefined : keepPollResults,
                onDismiss: livePoll.dismissPoll,
              }
            : null
        }
        pollPanelPosition={pollPanelPosition}
        onMovePollPanel={(x, y) => setPollPanelPosition({ x, y })}
        onResetPollPanel={() => setPollPanelPosition(null)}
        userPreferences={userPreferences}
        onToggleRecentExclusion={toggleRecentExclusion}
        favouriteIds={favouriteIds}
        onToggleFavourite={toggleFavourite}
        votePanelPosition={votePanelPosition}
        onMoveVotePanel={(x, y) => setVotePanelPosition({ x, y })}
        onResetVotePanel={() => setVotePanelPosition(null)}
        avatarPanelPosition={avatarPanelPosition}
        laserPanelPosition={laserPanelPosition}
        spotlightPanelPosition={spotlightPanelPosition}
        eraserPanelPosition={eraserPanelPosition}
        eraserConfig={eraserConfig}
        onChangeEraserField={onChangeEraserField}
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
        // Slide Deck (docs/specs/012-collaboration/presentation-mode.md): the deck itself plus its panel's placement.
        slideDeck={slideDeck}
        slideDeckPanelPosition={slideDeckPanelPosition}
        onMoveSlideDeckPanel={(x, y) => setSlideDeckPanelPosition({ x, y })}
        onResetSlideDeckPanel={() => setSlideDeckPanelPosition(null)}
        onMoveEraserPanel={(x, y) => setEraserPanelPosition({ x, y })}
        onResetEraserPanel={() => setEraserPanelPosition(null)}
        onMoveSpotlightPanel={(x, y) => setSpotlightPanelPosition({ x, y })}
        onResetSpotlightPanel={() => setSpotlightPanelPosition(null)}
        laserConfig={laserConfig}
        onChangeLaserField={onChangeLaserField}
        onMoveLaserPanel={(x, y) => setLaserPanelPosition({ x, y })}
        onResetLaserPanel={() => setLaserPanelPosition(null)}
        onMoveAvatarPanel={(x, y) => setAvatarPanelPosition({ x, y })}
        onResetAvatarPanel={() => setAvatarPanelPosition(null)}
        voteResults={voteResults}
        onJumpToVoteResult={jumpToVoteResult}
        isVoteHost={isVoteHost(
          activeTab.vote,
          participantKey(selfParticipant),
          facilitator.isFacilitator,
        )}
        // +1 for the local participant: livePresence is the REMOTE roster.
        participantCount={livePresence.length + 1}
        onToggleLayersMinimized={() => {
          // Emit only the open transition; closing isn't a feature-reach
          // signal (the dock / popover layouts count in useDockPopovers).
          if (layersMinimized) track('Layer', 'Opened', 'Panel');
          setLayersMinimized((v) => !v);
        }}
        // Bottom-dock paintbrush (docs/specs/011-theme/canvas-and-theme-dialog.md): the same CanvasThemeDialog the
        // canvas right-click menu opens, one click from the chrome. Opens on
        // the Theme tab; the dialog's tab strip reaches Canvas from there.
        onOpenCanvasTheme={
          isReadOnly || embedMode
            ? undefined
            : () => {
                setCanvasThemeTab('theme');
                track('UI', 'Opened', 'ThemePicker');
              }
        }
        onSelectLayer={setActiveLayer}
        onAddLayer={addLayer}
        onRemoveLayer={removeLayer}
        onRenameLayer={renameLayer}
        onToggleLayerVisibility={toggleLayerVisibility}
        onToggleLayerLock={toggleLayerLock}
        onReorderLayer={reorderLayer}
        onMergeLayer={mergeActiveLayer}
        onSetLayerOpacity={setLayerOpacityLive}
        onClearLayer={clearLayer}
        onHideOtherLayers={hideOtherLayersOp}
        layerPreviewId={layerPreviewId}
        onPreviewLayer={setLayerPreviewId}
        commentRows={commentRows}
        commentsPanelPosition={commentsPanelPosition}
        onMoveCommentsPanel={(x, y) => setCommentsPanelPosition({ x, y })}
        onResetCommentsPanel={() => setCommentsPanelPosition(null)}
        onOpenCommentsForElement={(id) => {
          setSelectedId(id);
          // A Comment panel IS the thread (docs/specs/012-collaboration/assigned-actions.md §5): go to it
          // rather than open a popover repeating it beside the card.
          if (!jumpToCard(id, 'comment-pin')) openComments(id);
        }}
        actionRows={actionRows}
        onOpenActionForElement={(id) => {
          setSelectedId(id);
          // An Action panel IS the action: the same jump.
          if (!jumpToCard(id, 'action-card')) openActionPopover(id);
        }}
        onToggleActionDone={
          isReadOnly
            ? undefined
            : (id, done, actionId) =>
                done ? completeAction(id, actionId) : reopenAction(id, actionId)
        }
        currentDocumentId={documentId}
        onOpenDocument={openDocument}
        onNewDocument={newDocument}
        explorerMenuActions={{
          // The header's Share gate: owners only (docs/specs/013-workspace/folders.md, docs/specs/015-api/api.md).
          onShare:
            isOwner && hydrated
              ? () => {
                  setShareDialogOpen(true);
                  track('UI', 'Opened', 'Share');
                }
              : undefined,
          onExport: () => {
            setExportScope('tab');
            setExportOpen(true);
          },
          onSearch: () => {
            setSearchOpen(true);
            // Same prefetch as the bottom bar's Search: element matches
            // cover tabs not yet visited (docs/specs/008-canvas/canvas-and-palette.md).
            void loadAllTabs();
          },
          onOpenSettings: () => {
            setSettingsOpen(true);
            track('UI', 'Opened', 'Settings');
          },
        }}
        onRenameCurrent={(next) => {
          const prev = documentName.trim();
          const nextTrim = next.trim();
          setDocumentName(next);
          if (nextTrim && documentId)
            setDocumentList((prev) =>
              prev.map((d) => (d.id === documentId ? { ...d, name: nextTrim } : d)),
            );
          if (nextTrim && nextTrim !== prev) track('Document', 'Renamed');
        }}
        onDeleteDocument={deleteDocument}
        onDuplicateDocument={(id) => void duplicateDocument(id)}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onTeamFolders={onTeamFolders}
        onMoveDocumentToFolder={moveDocumentToFolder}
        onMoveDocumentTo={moveDocumentTo}
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
        onElementContextMenu={
          isReadOnly
            ? undefined
            : (id, sx, sy) => {
                // Concurrent-selection lock (docs/specs/007-editor/live-app.md): a peer holds this
                // element, so it can't be selected, dragged, or edited — don't
                // pop a dead context menu on it either. Same gate as
                // selectElement.
                //
                // The one exception is whoever is running the session
                // (docs/specs/012-collaboration/facilitator.md): for them a locked element has exactly one
                // available action, freeing it, and that gets its own small menu
                // rather than the element's real one, whose every other row
                // would be dead. See LockedElementMenu.
                if (lockedByOther(id)) {
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
                  cur &&
                  cur.mode === 'element' &&
                  cur.elementId === id &&
                  cur.x === sx &&
                  cur.y === sy
                    ? cur
                    : { mode: 'element', elementId: id, x: sx, y: sy },
                );
              }
        }
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
                  // Where a Paste from this menu lands: the right-clicked
                  // spot, not wherever the pointer is when the row is clicked.
                  canvasPoint: canvasPointerRef.current,
                  // Open upward when the click is in the bottom fifth of the
                  // viewport so the canvas menu's categories don't run
                  // off-screen (matching the tab menu).
                  openUp: typeof window !== 'undefined' && sy > window.innerHeight * 0.8,
                })
        }
        onBeginDrag={beginDrag}
        onBeginEdit={beginEdit}
        onCommitLabel={commitLabel}
        onCommitTable={commitTable}
        onCommitHeaderSize={commitHeaderSize}
        onAddRailPoint={addRailPointSelected}
        onAddTableRow={appendTableRowSelected}
        onAddTableColumn={appendTableColumnSelected}
        onSetRailLabel={isReadOnly ? undefined : setRailLabelSelected}
        onToggleChecklistItem={isReadOnly ? undefined : toggleChecklistItem}
        onSetPageHeading={setPageHeading}
        onSetWebRows={isReadOnly ? undefined : setWebRows}
        onAppendWebRow={isReadOnly ? undefined : appendWebRowTo}
        onSetHeroCaptionLine={isReadOnly ? undefined : setHeroCaptionLine}
        onGrowMindNode={growMindNode}
        onAbandonMindNode={abandonMindNode}
        chartPalette={themeChartPalette(getTheme(activeTab.theme))}
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
        onBeginFormatPainter={beginFormatPainter}
        onCancelFormatPainter={exitFormatPainter}
        onExitFormatTool={exitFormatTool}
        onSetTextAlign={setTextAlignSelected}
        onFollowLink={followLink}
        onOpenComments={openComments}
        onOpenAction={openActionPopover}
        onOpenNote={openNote}
        onEditLink={isReadOnly ? undefined : setLinkPickerOpenForId}
        onEditCode={isReadOnly ? undefined : setCodeEditOpenForId}
        imageContext={imageContext}
        showTemplatePicker={
          // The identity / join card (name entry) shows for EVERYONE
          // including view-role visitors: it only writes their own
          // participant row, so there's no 403, and they should set a
          // name before others see them in presence.
          identityOnlyScreenOpen ||
          // The template-CHOOSING variant (Quick Start) stays editor-only: a
          // viewer can't commit a template (every write 403s). It opens only on
          // an explicit request (adding a tab or the empty-canvas button, both
          // of which set templatePickerMode='templates' -> templateGridOpen),
          // never automatically just because a tab is empty.
          (!isReadOnly && hydrated && templateGridOpen)
        }
        hydrated={hydrated}
        templatePickerMode={effectiveTemplatePickerMode}
        // Visitor on someone else's document + signed in → lock the
        // identity input to their Clerk name. Owner branch never
        // shows the identity prompt so `lockedName` is moot there;
        // pure guests pass null and keep the editable name field.
        templatePickerLockedName={!isOwner && clerkUserId ? clerkDisplayName : null}
        welcomeOpen={anyWelcomeOpen}
        selfParticipant={selfParticipant}
        onChooseTemplate={chooseTemplate}
        onSkipTemplatePicker={skipTemplatePicker}
        onOpenTemplatePicker={openTemplatePicker}
        tabThemeId={(activeTab.theme as ThemeId | undefined) ?? 'brand'}
        tabTimer={activeTab.timer}
        tabVote={activeTab.vote}
        onStartTimer={startTimer}
        onPauseTimer={pauseTimer}
        onResumeTimer={resumeTimer}
        onResetTimer={resetTimer}
        onClearTimer={clearTimer}
        onSetTimerDuration={setTimerDuration}
        onStartVote={startVote}
        onEndVote={endVote}
        onRevealVote={revealVote}
        onClearVote={clearVote}
        onCastVote={castVote}
        onRetractVote={retractVote}
        voteReview={voteReview}
        onNextVoteResult={nextVoteResult}
        onPrevVoteResult={prevVoteResult}
        onDoneVoteReview={doneVoteReview}
        onToggleAspectLock={toggleAspectLockSelected}
        onDropPalette={dropThenDisarm(dropPaletteItem, cancelDrawShape)}
        onSpawnConnect={spawnConnectSelected}
        onStartArrow={handleStartArrow}
        onStartPencil={beginFreehand}
        onToggleLockSelected={toggleLockSelected}
        onDeleteSelected={deleteSelected}
        // One gesture, one answer: while the element menu is open the
        // selection popover stands down (see deriveCanvasSelection).
        elementMenuOpen={contextMenu?.mode === 'element'}
        onDuplicateSelected={duplicateSelected}
        onBringSelectedToFront={stackSelectedFront}
        onSendSelectedToBack={stackSelectedBack}
        onCanvasDoubleClick={handleCanvasDoubleClick}
        tabLoadState={tabLoadState}
        onRetryTabLoad={retryActiveTabLoad}
        // Embeds (docs/specs/013-workspace/embeds.md) ride the zen chrome-hide gates: every panel
        // and badge zen hides, embeds hide too. The zen TOGGLE is
        // withheld so the ZoomControls dock doesn't offer an exit
        // from a mode the embed can't actually leave.
        zenMode={zenMode || embedMode}
        onToggleZen={embedMode ? undefined : toggleZenMode}
        aiPanel={
          aiCapable && userPreferences.aiAssistanceEnabled && aiPanelVisible && !isReadOnly
            ? {
                position: aiPanelPosition,
                onMove: (x, y) => setAiPanelPosition({ x, y }),
                onReset: () => setAiPanelPosition(null),
                contextElements: activeTab.elements,
                focusIds:
                  multiSelectedIds.size > 0
                    ? [...multiSelectedIds]
                    : selectedId !== null
                      ? [selectedId]
                      : [],
                onApplyElements: applyAiElements,
                ownerId: selfParticipant.id,
                tabId: activeTab.id,
              }
            : undefined
        }
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
    </>
  );
}
