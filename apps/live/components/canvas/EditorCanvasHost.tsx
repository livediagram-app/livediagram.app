'use client';

import { describeOne } from '@/lib/element-names';
import { DEFAULT_BUTTON_MODE } from '@livediagram/diagram';
import { useMemo } from 'react';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR, isVoteHost } from '@livediagram/diagram';
import { resolveOwnerBadge } from '@/lib/presence-rows';
import { usePreferenceHandlers } from '@/hooks/ui/usePreferenceHandlers';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { getTheme, themeChartPalette, type ThemeId } from '@/lib/themes';
import { Canvas } from '@/components/canvas/Canvas';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';

// The Canvas element's wiring, lifted out of EditorView (which carried
// ~500 lines of prop plumbing for it). Reads everything straight from
// EditorContext — the same host pattern as EditorModals /
// EditorContextMenuHost — plus the handful of locals only the Canvas
// props consume (the quick-connect arrow starter, the memoised Explorer
// / Activity list props, the owner-badge resolution).
export function EditorCanvasHost() {
  const {
    activeId,
    activeTab,
    activeTabLoadState,
    activeTabLocked,
    presentingElements,
    slideDeck,
    slideDeckPanelPosition,
    setSlideDeckPanelPosition,
    activityMinimized,
    activityPosition,
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
    addCurvePoint,
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
    addTable,
    addTechIcon,
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
    beginShapePen,
    beginPolygon,
    beginGroup,
    highlighterColor,
    highlighterWidth,
    setHighlighterColor,
    setHighlighterWidth,
    broadcastAvatar,
    broadcastAvatarPush,
    avatarShove,
    fireReaction,
    reactionBursts,
    clearReactionBurst,
    broadcastCursor,
    broadcastLaser,
    cancelConnect,
    cancelDrawShape,
    cancelEdit,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,
    castVote,
    changeLog,
    changeLogLoading,
    chooseTemplate,
    clearActivityForActiveTab,
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
    commitLabel,
    commitTable,
    createFolder,
    deleteCurvePoint,
    deleteDiagram,
    deleteFolder,
    deleteMultiSelected,
    deleteSelected,
    diagramId,
    diagramList,
    diagramListLoading,
    diagramName,
    diagramOwnerColor,
    diagramOwnerId,
    diagramOwnerName,
    dismissSharedDiagram,
    distGuides,
    dropIconOnElement,
    dropPaletteItem,
    duplicateDiagram,
    duplicateMultiSelected,
    duplicateSelected,
    editCursorAtEnd,
    editingId,
    effectiveTemplatePickerMode,
    embedMode,
    endVote,
    exitFormatPainter,
    exitFormatTool,
    exitGroupMode,
    explorerPosition,
    fitToScreen,
    folders,
    followLink,
    formatSourceId,
    groupMultiSelected,
    groupSourceId,
    handleActivityRowClick,
    handleCanvasDoubleClick,
    hydrated,
    identityOnlyScreenOpen,
    imageContext,
    isOwner,
    isPinchingRef,
    isReadOnly,
    laserTrailRows,
    livePresence,
    lockedByOther,
    mapPosition,
    moveDiagramToFolder,
    moveDiagramTo,
    multiSelectedIds,
    narrowMultiSelection,
    newDiagram,
    openActionPopover,
    openCellLinkPicker,
    openComments,
    openDiagram,
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
    revertChange,
    previewRevert,
    clearRevertPreview,
    savedAt,
    saveStatus,
    selectedId,
    selectElement,
    selectMarquee,
    selfParticipant,
    setActivityMinimized,
    setActivityPosition,
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
    followMe,
    endPollKeepingResults,
    tabs,
    setCanvasTool,
    setCanvasThemeTab,
    setCommentsPanelPosition,
    setContextMenu,
    setDiagramList,
    setDiagramName,
    setEditingId,
    setExplorerPosition,
    setExportOpen,
    setExportScope,
    setCodeEditOpenForId,
    setFormatSourceId,
    setGroupSourceId,
    setLinkPickerOpenForId,
    setMapPosition,
    setMultiSelectedIds,
    setPalettePosition,
    setRailLabelSelected,
    setSelectedId,
    toggleChecklistItem,
    setPageHeading,
    growMindNode,
    setShareDialogOpen,
    setTextAlignSelected,
    setUserPreferences,
    setViewportOffset,
    setViewportZoom,
    sharedDiagrams,
    shiftDupGhostIds,
    skipTemplatePicker,
    snapGuides,
    snapTargets,
    soloSelectedId,
    spawnConnectSelected,
    startTimer,
    startVote,
    tabSummaries,
    teamDiagrams,
    teamFolders,
    teams,
    templateGridOpen,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    toggleZenMode,
    undo,
    ungroupSelected,
    userPreferences,
    viewportOffset,
    viewportZoom,
    zenMode,
  } = useEditorContext();
  // Stable references for the two list-shaped props the Explorer +
  // Activity panels take, so those (React.memo'd) panels don't
  // re-render on every drag frame just because the editor re-rendered.
  // Both recompute only when their real inputs change, not per frame.
  const explorerTeams = useMemo(() => teams.map((t) => ({ id: t.id, name: t.name })), [teams]);
  const activeTabChangeLog = useMemo(
    () => changeLog.filter((entry) => entry.tabId === activeId),
    [changeLog, activeId],
  );
  // Lazy per-tab load gate (spec/13): show a blocking loader / error over
  // the canvas while the active tab's content is still being fetched, so
  // the user never edits a blank placeholder whose autosave would
  // overwrite the real server row. Derived once in useEditorState (it also
  // gates editsBlocked there, so the pointer overlay and the edit lock
  // can't disagree); consumed here for the overlay.
  const tabLoadState = activeTabLoadState;
  // Quick add + connect Arrow starter (spec/09) — see useQuickConnectStart.
  const { handleStartArrow } = useQuickConnectStart({ selectedId, activeTab, beginAnchorDrag });

  // While a label is being edited, ride the element context menu alongside
  // the editor (spec/09) — see useEditModeContextMenu.
  useEditModeContextMenu({
    editingId,
    elements: activeTab.elements,
    isReadOnly,
    setContextMenu,
  });

  // Preference writes (Settings save + the two quick toggles) — see
  // usePreferenceHandlers.
  const { onChangeSettings, onToggleMinimalPanels } = usePreferenceHandlers({
    userPreferences,
    setUserPreferences,
    selfParticipantId: selfParticipant?.id ?? null,
  });
  // The element the format brush is loaded from (spec/116), for the panel's
  // preview. Resolved here rather than in the panel so the panel stays a
  // renderer and never reaches into the tab.
  const formatSource = formatSourceId
    ? (activeTab.elements.find((el) => el.id === formatSourceId) ?? null)
    : null;

  return (
    <Canvas
      tabName={activeTab.name}
      tabSummaries={tabSummaries}
      // Portals (spec/104) can lead to another tab; see Canvas.enterPortal.
      portalTabs={tabs}
      activeTabId={activeTab.id}
      tabLocked={activeTabLocked}
      readOnly={isReadOnly}
      // Three-tier owner-badge resolution (self / live presence row /
      // joined fetch fallback) — see resolveOwnerBadge in presence-rows.
      ownerParticipant={resolveOwnerBadge({
        isOwner,
        selfParticipant,
        livePresence,
        diagramOwnerId,
        diagramOwnerName,
        diagramOwnerColor,
      })}
      isOwner={isOwner}
      diagramName={diagramName}
      tabBackgroundPattern={activeTab.backgroundPattern ?? 'grid'}
      tabBackgroundColor={activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
      tabBackgroundOpacity={activeTab.backgroundOpacity ?? 1}
      tabBackgroundPatternScale={activeTab.backgroundPatternScale ?? 1}
      tabBackgroundAnimationSpeed={activeTab.backgroundAnimationSpeed ?? 1}
      tabPatternColor={activeTab.patternColor ?? DEFAULT_PATTERN_COLOR}
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
      // Presenting (spec/31) narrows the canvas to one slide's elements. The
      // real canvas still draws them — a slide has to respond to clicks and
      // carry live element state, and there is then exactly one thing that
      // knows how an element looks.
      elements={presentingElements ?? activeTab.elements}
      tabLayers={activeTab.layers}
      layerInertIds={layerInertIds}
      shiftDupGhostIds={shiftDupGhostIds}
      snapGuides={snapGuides}
      distGuides={distGuides}
      snapTargets={snapTargets}
      selectedId={selectedId}
      soloSelectedId={soloSelectedId}
      multiSelectedIds={multiSelectedIds}
      remoteSelectionsByElement={remoteSelectionsByElement}
      remoteCursors={remoteCursorRows}
      remoteAvatars={remoteAvatarRows}
      onAvatarPresence={broadcastAvatar}
      // Avatar mode (spec/101): clicking a peer's character walks over and
      // shoves it; their own client decides what to do with the request.
      onAvatarPush={broadcastAvatarPush}
      avatarShove={avatarShove}
      onFireReaction={isReadOnly ? undefined : fireReaction}
      reactionBursts={reactionBursts}
      onReactionBurstDone={clearReactionBurst}
      laserTrails={laserTrailRows}
      onCanvasPointerMove={(x, y) => {
        if (canvasTool === 'laser' && x !== null && y !== null) {
          // The pen rides the sample so peers draw MY laser (spec/111).
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
      // Mode button (spec/103): pressing one is exactly picking that mode from
      // the palette, so it goes through the same setter — telemetry, the
      // selection clear, and the empty-canvas guard all included. Pressing it
      // again, while already in that mode, hands you back your previous one.
      onPressModeButton={(element) => pressModeButton(element.mode ?? DEFAULT_BUTTON_MODE)}
      // Session button (spec/105) / Reveal zone (spec/106) / Picker (spec/107):
      // see useBehaviourElements — the press resolves what to do from the
      // element and calls the tool that already exists.
      onPressSessionButton={pressSessionButton}
      sessionStartBlocked={isReadOnly}
      timerState={activeTab.timer ? (activeTab.timer.running ? 'running' : 'paused') : 'none'}
      revealedIds={revealedIds}
      onToggleReveal={toggleRevealForMe}
      onSetSessionConfig={isReadOnly ? undefined : setSessionConfigFor}
      // Comment panels (spec/136) drive the SAME thread machinery the anchored
      // popover does — it is all keyed by element id already.
      commentSelfId={selfParticipant.id}
      commentPanelActions={
        isReadOnly
          ? undefined
          : {
              add: (id, text) => addComment(id, text),
              remove: deleteComment,
              resolve: resolveThread,
              unresolve: unresolveThread,
            }
      }
      onRollPicker={pickerFor}
      // Follow-me (spec/131): resolved to a NAME here, where presence lives,
      // so the pill doesn't have to look one up.
      followingName={
        followMe.followingId
          ? (livePresence.find((p) => p.id === followMe.followingId)?.name ?? 'someone')
          : null
      }
      onStopFollowing={followMe.stopFollowing}
      // The collaboration elements (spec/123 to spec/129). One prop for all
      // five faces; the write handlers drop out entirely for a view-role
      // visitor, so the faces render readable but inert rather than offering
      // presses the room would discard.
      collab={{
        selfId: selfParticipant.id,
        // Ourselves first: livePresence is the REMOTE roster, and an estimate
        // card that can't show your own avatar is showing the wrong room.
        participants: [selfParticipant, ...livePresence],
        tabTimer: activeTab.timer,
        respond: isReadOnly ? undefined : collabElements.respond,
        setResponsesRevealed: isReadOnly ? undefined : collabElements.setResponsesRevealed,
        clearResponses: isReadOnly ? undefined : collabElements.clearResponses,
        addIdea: isReadOnly ? undefined : collabElements.addIdea,
        revealIdeas: isReadOnly ? undefined : collabElements.revealIdeas,
        scatterIdeas: isReadOnly ? undefined : collabElements.scatterIdeas,
        pressAgendaItem: isReadOnly ? undefined : collabElements.pressAgendaItem,
        takeRoll: isReadOnly ? undefined : collabElements.takeRoll,
      }}
      onEraseStart={isReadOnly ? undefined : beginErase}
      onDuplicateMultiSelected={duplicateMultiSelected}
      onDeleteMultiSelected={deleteMultiSelected}
      onGroupMultiSelected={groupMultiSelected}
      onToggleLockMultiSelected={toggleLockMultiSelected}
      onFilterMultiSelected={narrowMultiSelection}
      onExportMultiSelected={() => {
        setExportScope('selection');
        setExportOpen(true);
      }}
      onExportDeck={() => {
        setExportScope('deck');
        setExportOpen(true);
      }}
      editingId={editingId}
      editCursorAtEnd={editCursorAtEnd}
      formatSourceId={formatSourceId}
      groupSourceId={groupSourceId}
      palettePosition={palettePosition}
      explorerPosition={explorerPosition}
      canUndo={canUndo && !activeTabLocked}
      canRedo={canRedo && !activeTabLocked}
      onAddShape={addShape}
      onAddIcon={addIcon}
      onAddSticker={addSticker}
      onAddTechIcon={addTechIcon}
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
      onAddImage={addImage}
      onAddArrow={addArrow}
      onBeginFreehand={beginFreehand}
      onBeginShapePen={beginShapePen}
      onBeginPolygon={beginPolygon}
      highlighterColor={highlighterColor}
      highlighterWidth={highlighterWidth}
      onSetHighlighterColor={setHighlighterColor}
      onSetHighlighterWidth={setHighlighterWidth}
      pendingDraw={pendingDraw}
      onCommitDraw={commitDraw}
      onCommitFreehand={commitFreehand}
      onCommitPolygon={commitPolygon}
      settings={userPreferences}
      onChangeSettings={onChangeSettings}
      minimalPanels={userPreferences.minimalPanels === true}
      onToggleMinimalPanels={onToggleMinimalPanels}
      onCancelDraw={cancelDrawShape}
      onUndo={undo}
      onRedo={redo}
      onMovePalette={(x, y) => setPalettePosition({ x, y })}
      onResetPalette={() => setPalettePosition(null)}
      onMoveExplorer={(x, y) => setExplorerPosition({ x, y })}
      onResetExplorer={() => setExplorerPosition(null)}
      diagramList={diagramList}
      folders={folders}
      sharedDiagrams={sharedDiagrams}
      teams={explorerTeams}
      teamFolders={teamFolders}
      teamDiagrams={teamDiagrams}
      onDismissShared={dismissSharedDiagram}
      diagramListLoading={diagramListLoading}
      changeLog={activeTabChangeLog}
      changeLogLoading={changeLogLoading}
      activityPosition={activityPosition}
      activityMinimized={activityMinimized}
      mapPosition={mapPosition}
      onMoveMap={(x, y) =>
        // Equality-guarded so a drag tick that resolves to the same spot
        // doesn't spin the render loop (max update depth).
        setMapPosition((p) => (p && p.x === x && p.y === y ? p : { x, y }))
      }
      onResetMap={() => setMapPosition((p) => (p === null ? p : null))}
      onMoveActivity={(x, y) => setActivityPosition({ x, y })}
      onToggleActivityMinimized={() => {
        // Emit only the open transition (minimized -> expanded);
        // closing isn't a feature-reach signal. The closure read is
        // safe because this is a single user click, not a rapid
        // race, so no stale-state risk.
        if (activityMinimized) track('UI', 'Opened', 'Activity');
        setActivityMinimized((v) => !v);
      }}
      onResetActivity={() => setActivityPosition(null)}
      layers={layers}
      activeLayerId={activeLayerId}
      layerCounts={layerCounts}
      layersPanelPosition={layersPanelPosition}
      layersMinimized={layersMinimized}
      onMoveLayersPanel={(x, y) => setLayersPanelPosition({ x, y })}
      onResetLayersPanel={() => setLayersPanelPosition(null)}
      pollPanel={
        // Results are for the host and for anyone who has responded
        // (spec/88) — answering is what buys you the tally. A local
        // Dismiss hides it without ending the poll for everyone.
        livePoll.poll && !livePoll.dismissed && (livePoll.isHost || livePoll.myAnswer)
          ? {
              poll: livePoll.poll,
              answers: livePoll.answers,
              isHost: livePoll.isHost,
              onEnd: livePoll.endPoll,
              // spec/126: ends the poll for the room exactly as End does (the
              // same op), and additionally drops the tallies onto the canvas.
              // Read-only visitors never see it — they are never the host.
              onEndAndKeep: isReadOnly ? undefined : endPollKeepingResults,
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
      // What the brush holds, described for the panel's preview (spec/116):
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
      // Slide Deck (spec/31): the deck itself plus its panel's placement.
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
      isVoteHost={isVoteHost(activeTab.vote, selfParticipant.id)}
      // +1 for the local participant: livePresence is the REMOTE roster.
      participantCount={livePresence.length + 1}
      onToggleLayersMinimized={() => {
        // Emit only the open transition, matching the Activity dock.
        if (layersMinimized) track('Layer', 'Opened', 'Panel');
        setLayersMinimized((v) => !v);
      }}
      // Bottom-dock paintbrush (spec/42): the same CanvasThemeDialog the
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
        openComments(id);
      }}
      actionRows={actionRows}
      onOpenActionForElement={(id) => {
        setSelectedId(id);
        openActionPopover(id);
      }}
      onRevertChange={revertChange}
      onPreviewRevert={previewRevert}
      onClearRevertPreview={clearRevertPreview}
      onActivityRowClick={handleActivityRowClick}
      onClearActivity={isReadOnly ? undefined : clearActivityForActiveTab}
      saveStatus={saveStatus}
      savedAt={savedAt}
      currentDiagramId={diagramId}
      onOpenDiagram={openDiagram}
      onNewDiagram={newDiagram}
      onRenameCurrent={(next) => {
        const prev = diagramName.trim();
        const nextTrim = next.trim();
        setDiagramName(next);
        if (nextTrim && diagramId)
          setDiagramList((prev) =>
            prev.map((d) => (d.id === diagramId ? { ...d, name: nextTrim } : d)),
          );
        if (nextTrim && nextTrim !== prev) track('Diagram', 'Renamed');
      }}
      onOpenShareCurrent={() => setShareDialogOpen(true)}
      onDeleteDiagram={deleteDiagram}
      onDuplicateDiagram={(id) => void duplicateDiagram(id)}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      onMoveDiagramToFolder={moveDiagramToFolder}
      onMoveDiagramTo={moveDiagramTo}
      onDeselect={() => {
        // Clicking empty canvas also cancels an armed arrow-connect, and
        // wraps up the Format tool — restoring the pre-Format tool — so a
        // background click is the quick way out of paint mode (spec/09).
        if (canvasTool === 'format') exitFormatTool();
        cancelConnect();
        setSelectedId(null);
        setMultiSelectedIds(new Set());
        setEditingId(null);
        setFormatSourceId(null);
        setGroupSourceId(null);
        setContextMenu(null);
      }}
      onSelect={selectElement}
      onElementContextMenu={
        isReadOnly
          ? undefined
          : (id, sx, sy) => {
              // Concurrent-selection lock (spec/07): a peer holds this element,
              // so it can't be selected, dragged, or edited — don't pop a dead
              // context menu on it either. Same gate as selectElement.
              if (lockedByOther(id)) return;
              setContextMenu({ mode: 'element', elementId: id, x: sx, y: sy });
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
      onAddRailPoint={addRailPointSelected}
      onAddTableRow={appendTableRowSelected}
      onAddTableColumn={appendTableColumnSelected}
      onSetRailLabel={isReadOnly ? undefined : setRailLabelSelected}
      onToggleChecklistItem={isReadOnly ? undefined : toggleChecklistItem}
      onSetPageHeading={setPageHeading}
      onGrowMindNode={growMindNode}
      chartPalette={themeChartPalette(getTheme(activeTab.theme))}
      onCancelEdit={cancelEdit}
      onBeginEndpointDrag={beginEndpointDrag}
      onBeginArrowTranslate={beginArrowTranslate}
      onBeginArrowCurveDrag={beginArrowCurveDrag}
      onBeginArrowCurvePointDrag={beginArrowCurvePointDrag}
      onAddCurvePoint={addCurvePoint}
      onDeleteCurvePoint={deleteCurvePoint}
      onBeginArrowLabelDrag={beginArrowLabelDrag}
      onBeginArrowElbowDrag={beginArrowElbowDrag}
      onShiftSelect={toggleInMultiSelect}
      onBeginFormatPainter={beginFormatPainter}
      onCancelFormatPainter={exitFormatPainter}
      onExitFormatTool={exitFormatTool}
      onBeginGroup={beginGroup}
      onCancelGroup={exitGroupMode}
      onUngroup={ungroupSelected}
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
      // Visitor on someone else's diagram + signed in → lock the
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
      onDropPalette={dropPaletteItem}
      onSpawnConnect={spawnConnectSelected}
      onStartArrow={handleStartArrow}
      onStartPencil={beginFreehand}
      onToggleLockSelected={toggleLockSelected}
      onDeleteSelected={deleteSelected}
      onDuplicateSelected={duplicateSelected}
      onCanvasDoubleClick={handleCanvasDoubleClick}
      tabLoadState={tabLoadState}
      onRetryTabLoad={retryActiveTabLoad}
      // Embeds (spec/33) ride the zen chrome-hide gates: every panel
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
  );
}
