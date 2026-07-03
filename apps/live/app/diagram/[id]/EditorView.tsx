'use client';

import dynamic from 'next/dynamic';
import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  selectionMembers,
  type Anchor,
} from '@livediagram/diagram';
import type { QuickConnectDirection } from '@/lib/canvas';
import { quickConnectGroupStart, quickConnectSourceId } from '@/lib/quick-connect-source';
import { track } from '@/lib/telemetry';
import {
  getTheme,
  shapeColorPresets,
  themeChartPalette,
  themePresetColors,
  type ThemeId,
} from '@/lib/themes';
import type { UserPreferences } from '@/lib/user-preferences';
import { Canvas } from '@/components/canvas/Canvas';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { EmbedChrome } from '@/components/chrome/EmbedChrome';
import { TabBar } from '@/components/chrome/TabBar';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { EmptyCanvasBanner } from '@/components/canvas/EmptyCanvasBanner';
import { EditorModals } from '@/components/dialogs/EditorModals';
import { EditorTabDialogs } from '@/components/dialogs/EditorTabDialogs';
import { EditorElementDialogs } from '@/components/dialogs/EditorElementDialogs';
import { EditorAnchoredPopovers } from '@/components/panels/EditorAnchoredPopovers';
import { EditorSearchPanel } from '@/components/panels/EditorSearchPanel';
import { ThemeModeBanner } from '@/components/chrome/ThemeModeBanner';
import { ShiftHintBanner } from '@/components/chrome/ShiftHintBanner';
import { clerkEnabled } from '@/lib/clerk-config';
import { useDismissibleBanner } from '@/hooks/ui/useDismissibleBanner';
import { useDelayedReveal } from '@/hooks/ui/useDelayedReveal';
import { useEditorAccent } from '@/hooks/ui/useEditorAccent';
import { useEditorContext } from './EditorContext';

// How long a guest edits before the sign-in nudge appears (spec/36).
// Long enough that it never greets someone the instant they open a
// diagram; short enough to catch an invested session.
const SIGNIN_BANNER_DELAY_MS = 5 * 60_000;

const EditorContextMenu = dynamic(() =>
  import('@/components/palette/EditorContextMenu').then((m) => m.EditorContextMenu),
);

// The editor's full view (header + canvas + tab bar + all dialogs),
// lifted out of editor-page.tsx. Every value/handler it needs is read
// from EditorContext (provided by the page), so the page no longer
// threads ~150 props through this JSX. The JSX is verbatim; only its
// scope changed from the page's locals to the destructured context.
export function EditorView() {
  const ctx = useEditorContext();
  const {
    activeId,
    activeTab,
    activeTabLoadState,
    activeTabLocked,
    activityMinimized,
    activityPosition,
    mapPosition,
    addArrow,
    addImage,
    addIcon,
    addTechIcon,
    dropIconOnElement,
    removeIconFromElement,
    addShape,
    addSticky,
    addTable,
    addAnnotation,
    addLinkCard,
    addBanner,
    addHero,
    addHeader,
    addCallout,
    addStatRow,
    addProcess,
    addAvatar,
    dropPaletteItem,
    addTab,
    addText,
    aiCapable,
    aiPanelPosition,
    aiPanelVisible,
    anyWelcomeOpen,
    applyAiElements,
    embedMode,
    autoAlignTab,
    autoLayoutTab,
    applyTabFontToAll,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    castVote,
    retractVote,
    beginAnchorDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    addCurvePoint,
    deleteCurvePoint,
    beginArrowLabelDrag,
    beginArrowElbowDrag,
    beginArrowTranslate,
    beginDrag,
    beginEdit,
    beginEndpointDrag,
    beginFormatPainter,
    beginFreehand,
    beginGroup,
    bringSelectedToFront,
    broadcastCursor,
    broadcastLaser,
    cancelDrawShape,
    cancelEdit,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,
    drag,
    beginErase,
    changeLog,
    changeLogLoading,
    chooseTemplate,
    clearActivityForActiveTab,
    clearTabContent,
    clerkDisplayName,
    clerkUserId,
    closeContextMenu,
    commentRows,
    commentsPanelPosition,
    commitDraw,
    commitFreehand,
    commitLabel,
    commitTable,
    contextMenu,
    copying,
    createFolder,
    deleteDiagram,
    deleteFolder,
    deleteMultiSelected,
    deleteSelected,
    deleteTab,
    diagramId,
    diagramList,
    setDiagramList,
    diagramListLoading,
    diagramName,
    diagramOwnerColor,
    diagramOwnerId,
    diagramOwnerName,
    diagramShareable,
    diagramTeamId,
    dismissSharedDiagram,
    spawnConnectSelected,
    duplicateDiagram,
    duplicateMultiSelected,
    duplicateSelected,
    duplicateTab,
    editCursorAtEnd,
    editingId,
    effectiveTemplatePickerMode,
    templateGridOpen,
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
    setImportOpen,
    isOwner,
    isPinchingRef,
    isReadOnly,
    laserTrailRows,
    linkActiveTabTo,
    openLinkPicker,
    livePresence,
    loadAllTabs,
    makeCopy,
    moveDiagramToFolder,
    multiSelectedIds,
    narrowMultiSelection,
    newDiagram,
    openComments,
    openDiagram,
    openNote,
    openTemplatePicker,
    palettePosition,
    participantsByTab,
    pendingDraw,
    redo,
    remoteCursorRows,
    remoteSelectionsByElement,
    removeImageFromElement,
    renameFolder,
    renameTab,
    renameTabFolder,
    moveTabToFolder,
    removeTabFromFolder,
    reorderTabs,
    resetColorsSelected,
    retryActiveTabLoad,
    revertChange,
    savedAt,
    saveStatus,
    selectedId,
    soloSelectedId,
    selectElement,
    connectSourceId,
    cancelConnect,
    selectMarquee,
    selfParticipant,
    sendSelectedToBack,
    sessionRole,
    sessionShareCode,
    setActiveId,
    setActivityMinimized,
    setActivityPosition,
    setMapPosition,
    setAiPanelPosition,
    setArrowEndsSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    setArrowStrokeStyleSelected,
    setArrowStyleSelected,
    setArrowThicknessSelected,
    resetAspectRatioSelected,
    setRailCountSelected,
    addRailPointSelected,
    appendTableRowSelected,
    appendTableColumnSelected,
    setRailLabelSelected,
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartLegendPositionSelected,
    setLineDataOpenForId,
    clearStylePreview,
    previewShapeColorPreset,
    commitShapeColorPreset,
    previewArrowPreset,
    commitArrowPreset,
    previewAnimation,
    commitAnimation,
    previewArrowFlow,
    commitArrowFlow,
    previewIconAnimation,
    commitIconAnimation,
    previewFillColor,
    commitFillColor,
    previewStrokeColor,
    commitStrokeColor,
    previewTextColor,
    commitTextColor,
    previewBorderStroke,
    commitBorderStroke,
    previewBorderStyle,
    commitBorderStyle,
    previewBorderRadius,
    commitBorderRadius,
    previewRotation,
    commitRotation,
    previewShapeKind,
    commitShapeKind,
    previewIconSize,
    commitIconSize,
    previewMarker,
    commitMarker,
    previewMarkerSize,
    commitMarkerSize,
    previewTextAlign,
    commitTextAlign,
    previewTextSize,
    commitTextSize,
    previewInlineIcon,
    commitInlineIcon,
    resetShapeStyleSelected,
    resetArrowStyleSelected,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setAnimationSpeedSelected,
    setFlowSpeedSelected,
    setCanvasTool,
    setCommentsPanelPosition,
    setContextMenu,
    setDiagramName,
    setEditingId,
    setExplorerPosition,
    setExportOpen,
    setExportScope,
    setFillColorSelected,
    setFormatSourceId,
    setGroupSourceId,
    setLinkPickerOpenForId,
    applyElementLink,
    openCellLinkPicker,
    setMultiSelectedIds,
    setOpacitySelected,
    setPaddingSelected,
    setPalettePosition,
    setSearchOpen,
    setSelectedId,
    setSettingsOpen,
    setShareDialogOpen,
    setCanvasThemeTab,
    renameDiagramNonce,
    renameTabNonce,
    setShortcutsOpen,
    setStrokeColorSelected,
    setTextAlignSelected,
    setFontSelected,
    setTextColorSelected,
    setTextSizeSelected,
    setTabFont,
    setTabDefaultTextSize,
    setUserPreferences,
    setViewportOffset,
    setViewportZoom,
    sharedDiagrams,
    skipTemplatePicker,
    snapGuides,
    distGuides,
    snapTargets,
    tabs,
    tabSummaries,
    teamFolders,
    teamDiagrams,
    teams,
    toggleActiveTabLock,
    toggleZenMode,
    zenMode,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    toggleTextStyleSelected,
    undo,
    ungroupSelected,
    userPreferences,
    viewportOffset,
    viewportZoom,
    writeUserPreferences,
  } = ctx;
  // Contextual command palette for the SearchPanel "Actions" group (spec/09):
  // selection-aware command list + dispatcher, built off the same editor
  // actions the menus use. Empty (undefined items) for view-only sessions.
  // Retarget the brand-* accent (buttons, rings, focus) to the active tab's
  // theme so the editor chrome matches the diagram (spec/42).
  useEditorAccent(activeTab.theme);
  // Selection-context-menu wiring (right-click a multi-selection or group):
  // resolve the member set, whether it's a group vs a marquee multi, count,
  // and lock state, then route the actions to the multi- or group-aware
  // handlers accordingly.
  const ctxMultiActive = multiSelectedIds.size > 0;
  const ctxSelectedEl = selectedId
    ? (activeTab.elements.find((e) => e.id === selectedId) ?? null)
    : null;
  const ctxMemberIds = ctxMultiActive
    ? [...multiSelectedIds]
    : ctxSelectedEl
      ? selectionMembers(activeTab.elements, ctxSelectedEl.id)
      : [];
  // Guest sign-in nudge (spec/36): the same banner the Explorer shows,
  // but on the editor it waits ~5 minutes into the session before
  // appearing so it never interrupts someone the moment they open a
  // diagram. Hidden in embed (read-only iframe) and zen mode. zenMode
  // is deliberately kept OUT of the timer's `enabled` so toggling zen
  // doesn't restart the countdown; it only hides the card at render.
  const { dismissed: signInDismissed, dismiss: dismissSignIn } =
    useDismissibleBanner(SIGNIN_BANNER_DISMISS_KEY);
  const signInTimerEnabled = clerkEnabled && !clerkUserId && !embedMode && !signInDismissed;
  const signInDelayElapsed = useDelayedReveal(SIGNIN_BANNER_DELAY_MS, signInTimerEnabled);
  const showSignInBanner = signInTimerEnabled && !zenMode && signInDelayElapsed;
  // Empty-canvas hint (spec/14): a bottom banner while the active tab has no
  // elements. Not dismissible — it just goes away once there's content. Hidden
  // in zen / embed, while a draw tool is armed, or while Quick Start is open;
  // yields the bottom slot to the sign-in banner.
  const showEmptyCanvasBanner =
    hydrated &&
    !zenMode &&
    !embedMode &&
    !showSignInBanner &&
    !templateGridOpen &&
    !pendingDraw &&
    activeTab.elements.length === 0;
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
  // Quick add + connect Arrow option (spec/09). Desktop (mouse / pen): make
  // a pinned→free arrow from the picked side's anchor in click-to-place
  // mode — a plain click then has the endpoint trail the cursor until the
  // next click lands it (a press-drag still works too). Touch: no hover, so
  // arm the click-to-connect gesture (the next shape tap sets the other
  // end), reusing addArrow's connect-from-selection path.
  const handleStartArrow = (direction: QuickConnectDirection, e: ReactPointerEvent) => {
    if (selectedId === null) return;
    // On a group the pluses ring the union bounds: the arrow starts PINNED
    // TO THE GROUP's union box at the picked side's centre (a pinned-group
    // endpoint, so it tracks the group as it moves), inheriting its stroke
    // from the member nearest that side. A lone element pins to its own
    // anchor as ever.
    const sourceId = quickConnectSourceId(activeTab.elements, selectedId, direction);
    const groupStart = quickConnectGroupStart(activeTab.elements, selectedId, direction);
    const fromGroup = groupStart
      ? { groupId: groupStart.groupId, point: { x: groupStart.x, y: groupStart.y } }
      : undefined;
    const anchor: Anchor =
      direction === 'right' ? 'e' : direction === 'left' ? 'w' : direction === 'below' ? 's' : 'n';
    if (e.pointerType === 'touch') {
      // Touch: drop a free arrow running straight out from the anchor (~50px)
      // and select it, so the user can drag it where they want — no
      // tap-target step.
      beginAnchorDrag(sourceId, anchor, e, { placeOutPx: 50, fromGroup });
      return;
    }
    beginAnchorDrag(sourceId, anchor, e, { clickToPlace: true, fromGroup });
  };
  // The primary selection's flavour for the shift hint's no-drag messages.
  const shiftSelected = selectedId ? activeTab.elements.find((el) => el.id === selectedId) : null;
  const shiftSelectedKind = !shiftSelected
    ? null
    : shiftSelected.type === 'arrow'
      ? ('arrow' as const)
      : shiftSelected.type === 'table'
        ? ('table' as const)
        : ('other' as const);

  return (
    <div className="flex h-dvh flex-col">
      {/* Arrow click-to-connect hint (spec/09): shown while the gesture
          is armed so the user knows the next shape click connects, and
          gives a click target to cancel (clicking empty canvas also
          cancels). */}
      {connectSourceId !== null ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[var(--z-modal)] flex justify-center">
          <button
            type="button"
            onClick={cancelConnect}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200"
          >
            Click a shape to connect the arrow
            <span className="text-brand-300" aria-hidden>
              |
            </span>
            <span className="text-brand-500 dark:text-brand-300">Cancel</span>
          </button>
        </div>
      ) : null}
      {/* Zen / focus mode (spec/26) hides the header entirely so the
          canvas gets the full height. Embeds (spec/33) never show it. */}
      {zenMode || embedMode ? null : (
        <EditorHeader
          diagramName={diagramName}
          hideTitle={anyWelcomeOpen}
          showShare={isOwner && hydrated && !anyWelcomeOpen}
          shareable={diagramShareable}
          teamDiagram={!!diagramTeamId}
          // Visitors see "Make a copy" instead of "Share": same slot,
          // different action. Hidden during the welcome flow so the
          // first-paint chrome stays minimal, and during hydration so
          // we don't render the button before we know whether the user
          // is the owner.
          onMakeCopy={!isOwner && hydrated && !anyWelcomeOpen && diagramId ? makeCopy : undefined}
          copying={copying}
          readOnly={isReadOnly}
          renameNonce={renameDiagramNonce}
          brandAccent={getTheme(activeTab.theme).elementStroke ?? undefined}
          onOpenShare={() => {
            setShareDialogOpen(true);
            track('UI', 'Opened', 'Share');
          }}
          onRename={(next) => {
            const prev = diagramName.trim();
            const nextTrim = next.trim();
            setDiagramName(next);
            // Keep the Explorer panel's row for THIS diagram in sync —
            // autosave persists the name, but the in-memory list would
            // otherwise show the old name until a reload re-fetched it.
            if (nextTrim && diagramId)
              setDiagramList((prev) =>
                prev.map((d) => (d.id === diagramId ? { ...d, name: nextTrim } : d)),
              );
            if (nextTrim && nextTrim !== prev) track('Diagram', 'Renamed');
          }}
        />
      )}
      <EditorTabDialogs />
      <Canvas
        tabName={activeTab.name}
        tabSummaries={tabSummaries}
        tabLocked={activeTabLocked}
        readOnly={isReadOnly}
        ownerParticipant={(() => {
          // Three-tier resolution for the top-middle "Owner" badge:
          //   1. Self IS the owner -> always have name + colour.
          //   2. Owner is currently in the room -> use the live
          //      presence row so the avatar (and its online dot)
          //      matches what visitors see in the TabBar.
          //   3. Owner is offline -> fall back to the joined name
          //      + colour we got from the diagram fetch
          //      (api worker LEFT JOINs participants on owner_id).
          // Returning null only when the owner truly has no
          // participant record on the server.
          if (isOwner) return selfParticipant;
          // The share endpoint redacts ownerId to '' for visitors (so an
          // observer can't learn + claim a guest's owner-id), so a
          // visitor can't match the owner's live presence row by id.
          // When we have the real id (owner opening their own link) match
          // on it; otherwise fall back to the joined owner name + colour,
          // which is the same identity the fetch already trusts. Without
          // this, an online owner always resolved to the offline branch
          // below and showed a red (offline) dot to viewers.
          const live = diagramOwnerId
            ? livePresence.find((p) => p.id === diagramOwnerId)
            : livePresence.find(
                (p) => p.name === diagramOwnerName && p.color === diagramOwnerColor,
              );
          if (live) return live;
          // Owner not in the room: key the badge off the NAME, not the
          // (blanked) id, or viewers never get the badge at all. The id
          // here is display-only, so a synthetic fallback is fine.
          if (diagramOwnerName) {
            return {
              id: diagramOwnerId || 'owner',
              name: diagramOwnerName,
              color: diagramOwnerColor ?? '#94a3b8',
              status: 'offline' as const,
            };
          }
          return null;
        })()}
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
        onChangeSettings={(next) => {
          setUserPreferences(next);
          writeUserPreferences(next, selfParticipant?.id ?? null);
        }}
        minimalPanels={userPreferences.minimalPanels === true}
        onToggleMinimalPanels={() => {
          const next: UserPreferences = {
            ...userPreferences,
            minimalPanels: !(userPreferences.minimalPanels === true),
          };
          track('UI', 'Toggled', next.minimalPanels ? 'MinimalPanelsOn' : 'MinimalPanelsOff');
          setUserPreferences(next);
          writeUserPreferences(next, selfParticipant?.id ?? null);
        }}
        onToggleRecogniseShapes={() => {
          const next: UserPreferences = {
            ...userPreferences,
            // Default-on: undefined / true read as on, so toggling off
            // stores an explicit false.
            recogniseShapes: userPreferences.recogniseShapes === false,
          };
          // Telemetry (spec/22): emit BEFORE persistence so the
          // flip itself reaches the wire even when the new state
          // would suppress emission later (matches how
          // TelemetryOn / TelemetryOff are handled in the
          // Settings dialog).
          track('UI', 'Toggled', next.recogniseShapes ? 'RecogniseShapesOn' : 'RecogniseShapesOff');
          setUserPreferences(next);
          writeUserPreferences(next, selfParticipant?.id ?? null);
        }}
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
        commentRows={commentRows}
        commentsPanelPosition={commentsPanelPosition}
        onMoveCommentsPanel={(x, y) => setCommentsPanelPosition({ x, y })}
        onResetCommentsPanel={() => setCommentsPanelPosition(null)}
        onOpenCommentsForElement={(id) => {
          setSelectedId(id);
          openComments(id);
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
      {embedMode ? (
        // Embed chrome (spec/33): the link-out badge + a minimal tab
        // switcher replace the full TabBar. Same selection clears as
        // the TabBar's onSelect so element state never leaks across a
        // tab switch.
        <EmbedChrome
          tabs={tabs}
          activeId={activeId}
          shareCode={sessionShareCode}
          onSelectTab={(id) => {
            setActiveId(id);
            setSelectedId(null);
            setMultiSelectedIds(new Set());
            setEditingId(null);
            setFormatSourceId(null);
            setGroupSourceId(null);
          }}
        />
      ) : null}
      {anyWelcomeOpen || zenMode || embedMode ? null : (
        <TabBar
          tabs={tabs}
          activeId={activeId}
          diagramId={diagramId ?? ''}
          onMoveTabToFolder={moveTabToFolder}
          onRemoveTabFromFolder={removeTabFromFolder}
          onRenameFolder={renameTabFolder}
          activeTabHasContent={activeTab.elements.length > 0}
          onSelect={(id) => {
            setActiveId(id);
            setSelectedId(null);
            setMultiSelectedIds(new Set());
            setEditingId(null);
            setFormatSourceId(null);
            setGroupSourceId(null);
          }}
          onAdd={addTab}
          onRename={renameTab}
          onDuplicate={duplicateTab}
          onDelete={deleteTab}
          onClearContent={clearTabContent}
          onImportTab={() => setImportOpen(true)}
          onExportTab={() => {
            setExportScope('tab');
            setExportOpen(true);
          }}
          timer={activeTab.timer ?? null}
          vote={activeTab.vote ?? null}
          onStartTimer={startTimer}
          onPauseTimer={pauseTimer}
          onResumeTimer={resumeTimer}
          onResetTimer={resetTimer}
          onClearTimer={clearTimer}
          onStartVote={startVote}
          onEndVote={endVote}
          onRevealVote={revealVote}
          onClearVote={clearVote}
          otherDiagrams={diagramList.filter((d) => d.id !== diagramId)}
          onCopyTabTo={linkActiveTabTo}
          onToggleLockTab={toggleActiveTabLock}
          onReorder={reorderTabs}
          readOnly={isReadOnly}
          renameActiveNonce={renameTabNonce}
          participantsByTab={participantsByTab}
          selfId={selfParticipant.id}
          selfRole={sessionRole}
          onOpenShortcuts={() => {
            setShortcutsOpen(true);
            track('UI', 'Opened', 'Shortcuts');
          }}
          onOpenSettings={() => {
            // Preferences are user-scoped, not diagram-scoped, so
            // view-role visitors can still flip them for their own
            // browser (e.g. opt out of telemetry).
            setSettingsOpen(true);
            track('UI', 'Opened', 'Settings');
          }}
          onOpenSearch={() => {
            setSearchOpen(true);
            // Element search walks local tab state; pull every
            // not-yet-visited tab's content so matches cover the
            // whole diagram (spec/09 "Search panel"). Best-effort
            // and fire-and-forget: results refresh as tabs land.
            void loadAllTabs();
          }}
          // Canvas right-click (desktop) + long-press (touch) open the active
          // tab's menu with the canvas sections folded in, rendered by the
          // TabBar so it reuses every tab handler. Element / multi context
          // menus stay on EditorContextMenu below.
          canvasMenu={contextMenu?.mode === 'canvas' ? contextMenu : null}
          onCloseCanvasMenu={closeContextMenu}
          canvasActions={{
            onChangeTheme: () => {
              setCanvasThemeTab('theme');
              track('UI', 'Opened', 'ThemePicker');
            },
            onChangeCanvas: () => {
              setCanvasThemeTab('canvas');
              track('UI', 'Opened', 'CanvasStyle');
            },
            onAutoAlign: autoAlignTab,
            onAutoLayout: autoLayoutTab,
            font: activeTab.font ?? null,
            onApplyFontToAll: applyTabFontToAll,
            onSetFont: setTabFont,
            defaultTextSize: activeTab.defaultTextSize,
            onSetDefaultTextSize: setTabDefaultTextSize,
          }}
        />
      )}
      <EditorSearchPanel />
      <EditorModals />
      <EditorAnchoredPopovers />
      {contextMenu && contextMenu.mode !== 'canvas' && !isReadOnly ? (
        <EditorContextMenu
          menu={contextMenu}
          elements={activeTab.elements}
          onClose={closeContextMenu}
          onLinkElement={openLinkPicker}
          onRemoveIcon={removeIconFromElement}
          onOpenImagePicker={(id) => imageContext?.onOpenPicker?.(id)}
          onRemoveImage={removeImageFromElement}
          onRemoveLink={() => applyElementLink(null)}
          onSetIconPosition={commitInlineIcon}
          onPreviewIconPosition={previewInlineIcon}
          onSetIconSize={commitIconSize}
          onPreviewIconSize={previewIconSize}
          onSetTextAlign={commitTextAlign}
          onPreviewTextAlign={previewTextAlign}
          onBringToFront={bringSelectedToFront}
          onSendToBack={sendSelectedToBack}
          onToggleAspectLock={toggleAspectLockSelected}
          onSetOpacity={setOpacitySelected}
          onSetTextColor={setTextColorSelected}
          onSetFillColor={setFillColorSelected}
          onSetStrokeColor={setStrokeColorSelected}
          onPreviewTextColor={previewTextColor}
          onCommitTextColor={commitTextColor}
          onPreviewFillColor={previewFillColor}
          onCommitFillColor={commitFillColor}
          onPreviewStrokeColor={previewStrokeColor}
          onCommitStrokeColor={commitStrokeColor}
          onPreviewBorderStroke={previewBorderStroke}
          onCommitBorderStroke={commitBorderStroke}
          onPreviewBorderStyle={previewBorderStyle}
          onCommitBorderStyle={commitBorderStyle}
          onPreviewBorderRadius={previewBorderRadius}
          onCommitBorderRadius={commitBorderRadius}
          onPreviewRotation={previewRotation}
          onCommitRotation={commitRotation}
          onSetMarker={commitMarker}
          onPreviewMarker={previewMarker}
          onSetMarkerSize={commitMarkerSize}
          onPreviewMarkerSize={previewMarkerSize}
          onSetRailCount={setRailCountSelected}
          onSetRating={setRatingSelected}
          onSetRatingAnim={setRatingAnimSelected}
          onSetRatingAnimSpeed={setRatingAnimSpeedSelected}
          onSetRatingAnimRepeat={setRatingAnimRepeatSelected}
          onSetPieData={setPieDataSelected}
          onSetPieAnim={setPieAnimSelected}
          onSetPieAnimSpeed={setPieAnimSpeedSelected}
          onSetPieAnimRepeat={setPieAnimRepeatSelected}
          onSetChartLegend={setChartLegendSelected}
          onSetChartLegendPosition={setChartLegendPositionSelected}
          onEditLineData={setLineDataOpenForId}
          shapeColorPresets={shapeColorPresets(getTheme(activeTab.theme))}
          onApplyShapeColorPreset={commitShapeColorPreset}
          onPreviewShapeColorPreset={previewShapeColorPreset}
          onResetShapeStyle={resetShapeStyleSelected}
          onApplyArrowPreset={commitArrowPreset}
          onPreviewArrowPreset={previewArrowPreset}
          onPreviewStyleEnd={clearStylePreview}
          onResetArrowStyle={resetArrowStyleSelected}
          onSetAnimation={commitAnimation}
          onSetArrowFlow={commitArrowFlow}
          onSetIconAnimation={commitIconAnimation}
          onPreviewAnimation={previewAnimation}
          onPreviewArrowFlow={previewArrowFlow}
          onPreviewIconAnimation={previewIconAnimation}
          onAnimationPreviewEnd={clearStylePreview}
          onSetIconAnimationSpeed={setIconAnimationSpeedSelected}
          onSetProgress={setProgressSelected}
          onSetProgressAnim={setProgressAnimSelected}
          onSetProgressAnimSpeed={setProgressAnimSpeedSelected}
          onSetProgressAnimRepeat={setProgressAnimRepeatSelected}
          onSetAnimationSpeed={setAnimationSpeedSelected}
          onSetFlowSpeed={setFlowSpeedSelected}
          onResetColors={resetColorsSelected}
          onToggleTextBold={() => toggleTextStyleSelected('textBold')}
          onToggleTextItalic={() => toggleTextStyleSelected('textItalic')}
          onToggleTextUnderline={() => toggleTextStyleSelected('textUnderline')}
          onToggleTextStrikethrough={() => toggleTextStyleSelected('textStrikethrough')}
          onSetTextSize={commitTextSize}
          onPreviewTextSize={previewTextSize}
          onSetArrowThickness={setArrowThicknessSelected}
          onSetArrowStyle={setArrowStyleSelected}
          onSetArrowStrokeStyle={setArrowStrokeStyleSelected}
          onSetArrowEnds={setArrowEndsSelected}
          onSetArrowheadSize={setArrowheadSizeSelected}
          onSetArrowheadShape={setArrowheadShapeSelected}
          onSetShapeKind={commitShapeKind}
          onPreviewShapeKind={previewShapeKind}
          onResetAspectRatio={resetAspectRatioSelected}
          presetColors={themePresetColors(getTheme(activeTab.theme))}
          onToggleTableHeaderRow={setTableHeaderRowSelected}
          onToggleTableHeaderColumn={setTableHeaderColumnSelected}
          onToggleTableZebra={setTableZebraSelected}
          onOpenNote={openNote}
          onOpenComments={openComments}
          selectionElements={ctxMemberIds
            .map((id) => activeTab.elements.find((e) => e.id === id))
            .filter((e): e is NonNullable<typeof e> => e != null)}
        />
      ) : null}
      <EditorElementDialogs />

      {/* Guest sign-in nudge (spec/36), delayed ~5 min. Lifted above
          the 48px tab bar (pb-16) and over the canvas chrome (z-[var(--z-overlay)]). */}
      {showSignInBanner ? (
        <SignInBanner
          onDismiss={dismissSignIn}
          placementClassName="bottom-0 z-[var(--z-overlay)] pb-16"
        />
      ) : null}
      {/* Empty-canvas hint (spec/14) — replaces the old centre-of-canvas card
          with a subdued, dismissible bottom banner so a blank diagram reads as
          intentionally blank. */}
      {showEmptyCanvasBanner ? (
        <EmptyCanvasBanner
          tabName={activeTab.name}
          readOnly={isReadOnly}
          onQuickStart={openTemplatePicker}
        />
      ) : null}
      {/* Offer to match the editor chrome to the active tab's theme
          (dark theme -> dark mode, light theme -> light mode). Hidden in
          zen / embed like the other floating prompts, and yields the
          bottom-centre slot to the sign-in / empty-canvas banners. */}
      {zenMode || embedMode || showSignInBanner || showEmptyCanvasBanner ? null : (
        <ThemeModeBanner themeId={activeTab.theme} />
      )}
      {/* Shift hint (spec/09): names what holding Shift does right now.
          Suppressed while a mode banner owns the top slot. */}
      <ShiftHintBanner
        drag={drag}
        selectedKind={shiftSelectedKind}
        hasElements={activeTab.elements.length > 0}
        suppressed={
          canvasTool === 'format' ||
          formatSourceId !== null ||
          groupSourceId !== null ||
          pendingDraw !== null
        }
      />
    </div>
  );
}
