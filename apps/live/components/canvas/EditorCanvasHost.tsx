'use client';

import { useMemo } from 'react';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR } from '@livediagram/diagram';
import { resolveOwnerBadge } from '@/lib/presence-rows';
import { usePreferenceHandlers } from '@/hooks/ui/usePreferenceHandlers';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
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
    activityMinimized,
    activityPosition,
    layers,
    activeLayerId,
    layerInertIds,
    layerCounts,
    layersPanelPosition,
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
    addAnnotation,
    addArrow,
    addAvatar,
    addBanner,
    addCallout,
    addCurvePoint,
    addHeader,
    addHero,
    addIcon,
    addImage,
    addLinkCard,
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
    beginGroup,
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
    mapPosition,
    moveDiagramToFolder,
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
    remoteCursorRows,
    remoteSelectionsByElement,
    renameFolder,
    resetTimer,
    resumeTimer,
    retractVote,
    retryActiveTabLoad,
    revealVote,
    revertChange,
    savedAt,
    saveStatus,
    selectedId,
    selectElement,
    selectMarquee,
    selfParticipant,
    setActivityMinimized,
    setActivityPosition,
    setAiPanelPosition,
    setCanvasTool,
    setCommentsPanelPosition,
    setContextMenu,
    setDiagramList,
    setDiagramName,
    setEditingId,
    setExplorerPosition,
    setExportOpen,
    setExportScope,
    setFontSelected,
    setFormatSourceId,
    setGroupSourceId,
    setLinkPickerOpenForId,
    setMapPosition,
    setMultiSelectedIds,
    setPaddingSelected,
    setPalettePosition,
    setRailLabelSelected,
    setSelectedId,
    setTextAlignSelected,
    setTextSizeSelected,
    setUserPreferences,
    setViewportOffset,
    setViewportZoom,
    sharedDiagrams,
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

  // Preference writes (Settings save + the two quick toggles) — see
  // usePreferenceHandlers.
  const { onChangeSettings, onToggleMinimalPanels, onToggleRecogniseShapes } =
    usePreferenceHandlers({
      userPreferences,
      setUserPreferences,
      selfParticipantId: selfParticipant?.id ?? null,
    });
  return (
    <Canvas
      tabName={activeTab.name}
      tabSummaries={tabSummaries}
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
      elements={activeTab.elements}
      tabLayers={activeTab.layers}
      layerInertIds={layerInertIds}
      snapGuides={snapGuides}
      distGuides={distGuides}
      snapTargets={snapTargets}
      selectedId={selectedId}
      soloSelectedId={soloSelectedId}
      multiSelectedIds={multiSelectedIds}
      remoteSelectionsByElement={remoteSelectionsByElement}
      remoteCursors={remoteCursorRows}
      laserTrails={laserTrailRows}
      onCanvasPointerMove={(x, y) => {
        if (canvasTool === 'laser' && x !== null && y !== null) {
          broadcastLaser(x, y);
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
      onAddTechIcon={addTechIcon}
      onDropIcon={isReadOnly ? undefined : dropIconOnElement}
      onLinkCell={isReadOnly ? undefined : openCellLinkPicker}
      onAddTable={addTable}
      onAddAnnotation={addAnnotation}
      onAddLinkCard={addLinkCard}
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
      pendingDraw={pendingDraw}
      onCommitDraw={commitDraw}
      onCommitFreehand={commitFreehand}
      recogniseShapes={userPreferences.recogniseShapes !== false}
      settings={userPreferences}
      onChangeSettings={onChangeSettings}
      minimalPanels={userPreferences.minimalPanels === true}
      onToggleMinimalPanels={onToggleMinimalPanels}
      onToggleRecogniseShapes={onToggleRecogniseShapes}
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
      onToggleLayersMinimized={() => {
        // Emit only the open transition, matching the Activity dock.
        if (layersMinimized) track('Layer', 'Opened', 'Panel');
        setLayersMinimized((v) => !v);
      }}
      onSelectLayer={setActiveLayer}
      onAddLayer={addLayer}
      onRemoveLayer={removeLayer}
      onRenameLayer={renameLayer}
      onToggleLayerVisibility={toggleLayerVisibility}
      onToggleLayerLock={toggleLayerLock}
      onReorderLayer={reorderLayer}
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
      onDeleteDiagram={deleteDiagram}
      onDuplicateDiagram={(id) => void duplicateDiagram(id)}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      onMoveDiagramToFolder={moveDiagramToFolder}
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
          : (id, sx, sy) => setContextMenu({ mode: 'element', elementId: id, x: sx, y: sy })
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
      onSetTextSize={setTextSizeSelected}
      onSetTextAlign={setTextAlignSelected}
      onSetFont={setFontSelected}
      onSetPadding={setPaddingSelected}
      onFollowLink={followLink}
      onOpenComments={openComments}
      onOpenAction={openActionPopover}
      onOpenNote={openNote}
      onEditLink={isReadOnly ? undefined : setLinkPickerOpenForId}
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
      onStartVote={startVote}
      onEndVote={endVote}
      onRevealVote={revealVote}
      onClearVote={clearVote}
      onCastVote={castVote}
      onRetractVote={retractVote}
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
