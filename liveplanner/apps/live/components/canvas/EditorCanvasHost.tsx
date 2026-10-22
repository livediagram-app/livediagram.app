'use client';

import { TagColoursProvider } from '@/components/canvas/TagColoursContext';
import { openSearchWithPrefetch } from '@/lib/open-search';
import { pastePointer } from '@/lib/canvas-pointer';
import { dropThenDisarm } from '@/lib/palette-drop';
import { describeOne } from '@/lib/element-names';
import { canvasSurface, DEFAULT_BACKGROUND_COLOR } from '@liveplanner/project';
import { createStockColourProjector } from '@/lib/stock-colour-projector';
import { drawnArrowAsShown } from '@/lib/drawn-arrow-preview';
import { useMemo, useState } from 'react';
import { isBoxed, isVoteHost, threadAt } from '@liveplanner/project';
import { commentPersisters } from '@/lib/comment-persistence';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import { useElementMenuOpener } from '@/hooks/canvas/element-menu-opener';
import { useSheetChartMenuSelection } from '@/hooks/sheets/useSheetChartMenuSelection';
import { focusSheetCell } from '@/hooks/sheets/sheet-cell-refs';
import { answeringKeys, participantKey, selfInRoom } from '@/lib/identity';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { useTeamFolderActions } from '@/hooks/ui/useTeamFolderActions';
import { getTheme, themeChartPalette, themeViewMap, type ThemeId } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsLandscapePhone } from '@/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useSessionTools } from '@/components/chrome/useSessionTools';
import { useStableCollab } from '@/components/canvas/element-layer-props';
import { canEditSankey } from '@/lib/sankey-edit';
import { canEditSequence } from '@/lib/sequence-edit';
import { CanvasThemeProvider } from '@/components/canvas/CanvasSurfaceContext';
import { elementSelector } from '@/lib/canvas-selectors';

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
    layers,
    activeLayerId,
    layerInertIds,
    layerCounts,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatPanelPosition,
    setFormatPanelPosition,
    toggleRecentExclusion,
    favouriteIds,
    toggleFavourite,
    voteResults,
    jumpToVoteResult,
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
    addLinkCard,
    addVideo,
    addProcess,
    addFlowchart,
    addShape,
    addStatRow,
    addSticky,
    dropBoardFile,
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
    pressArmedAction,
    beginEdit,
    beginEndpointDrag,
    beginPolygon,
    broadcastCursor,
    canvasPointerRef,
    cancelConnect,
    cancelDrawShape,
    cancelEdit,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,
    castVote,
    confirmIdentity,
    cancelIdentity,
    clearTimer,
    clearVote,
    clerkDisplayName,
    clerkUserId,
    actionRows,
    commentRows,
    commentsPanelPosition,
    commitDraw,
    commitPolygon,
    styleNewElement,
    commitLabel,
    createFolder,
    deleteCurvePoint,
    deleteProject,
    refreshOwnProjects,
    deleteFolder,
    deleteMultiSelected,
    deleteSelected,
    projectId,
    projectList,
    projectListLoading,
    projectName,
    dismissSharedProject,
    dropPaletteItem,
    duplicateProject,
    duplicateMultiSelected,
    contextMenu,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    editCursorAtEnd,
    editingId,
    embedMode,
    workbenchMode,
    endVote,
    exitFormatTool,
    fitToScreen,
    folders,
    followLink,
    formatSourceId,
    handleCanvasDoubleClick,
    hydrated,
    identityOnlyScreenOpen,
    isOwner,
    canShareProject,
    setSearchOpen,
    setShareDialogOpen,
    setSettingsOpen,
    loadAllTabs,
    isPinchingRef,
    isReadOnly,
    can,
    participating,
    livePresence,
    lockedByOther,
    mapPosition,
    moveProjectToFolder,
    moveProjectTo,
    narrowMultiSelection,
    newProject,
    openActionPopover,
    openAssignActionDialog,
    completeAction,
    reopenAction,
    linkedActions,
    openComments,
    openProject,
    openNote,
    pauseTimer,
    pendingDraw,
    redo,
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
    readSelection,
    selectElement,
    selectMarquee,
    confirm,
    selfParticipant,
    sessionShareCode,
    setAiPanelPosition,
    pressSessionButton,
    setSessionConfigFor,
    setTimerDuration,
    addComment,
    deleteComment,
    resolveThread,
    unresolveThread,
    pickerFor,
    collabElements,
    tabs,
    setCanvasTool,
    setCanvasThemeTab,
    setCommentsPanelPosition,
    setContextMenu,
    setProjectList,
    setProjectName,
    setEditingId,
    setExportOpen,
    setExportScope,
    setCodeEditOpenForId,
    setSankeyFlowsOpenForId,
    setSequenceOpenForId,
    setFormatSourceId,
    setLinkPickerOpenForId,
    setMapPosition,
    setMultiSelectedIds,
    setSelectedId,
    setPageHeading,
    appendWebRowTo,
    growMindNode,
    flowchartActions,
    entityActions,
    mindOutline,
    tidyMindMap,
    abandonMindNode,
    setTextAlignSelected,
    setViewportOffset,
    setViewportZoom,
    sharedProjects,
    shiftDupGhostIds,
    snapGuideStore,
    spawnConnectSelected,
    startTimer,
    startVote,
    tabSummaries,
    teamProjects,
    teamFolders,
    teams,
    refreshTeamLibraries,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    toggleZenMode,
    undo,
    userPreferences,
    zenMode,
    drag,
    loadedTabIds,
  } = useEditorContext();
  // A free arrow's frame stands down while a handle reshapes it (arrow-bending.md).
  const reshapingArrowId =
    drag &&
    (drag.kind === 'arrow-bend' ||
      drag.kind === 'arrow-curve' ||
      drag.kind === 'arrow-elbow' ||
      drag.kind === 'arrow-endpoint')
      ? drag.arrowId
      : null;

  // The Session strip's tools (docs/specs/012-collaboration/session-tools.md "The Session strip").
  const sessionTools = useSessionTools();
  // A stable reference for the list-shaped prop the Explorer takes, so the
  // (React.memo'd) panel doesn't re-render on every drag frame just because
  // the editor re-rendered. It recomputes only when its real input changes.
  const explorerTeams = useMemo(() => teams.map((t) => ({ id: t.id, name: t.name })), [teams]);
  // Team-library folder mutations for the Explorer panel's team tree
  // (docs/specs/013-workspace/team-shared-projects.md) - see useTeamFolderActions.
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
  const landscapePhone = useIsLandscapePhone();
  // The Collaborate panel's jump to a conversation card (docs/specs/012-collaboration/assigned-actions.md §5):
  // true when the row's element is that kind of card, now centred in view.
  const jumpToCard = (id: string, shape: 'comment-pin' | 'action-card'): boolean => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape' || el.shape !== shape) return false;
    scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    return true;
  };
  // Double-click on an element with its own edit dialog (docs/specs/009-elements/code-block.md,
  // docs/specs/009-elements/sankey.md): which dialog depends on the kind.
  const openEditDialog = (id: string) => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape') return;
    if (el.shape === 'code-block') setCodeEditOpenForId(id);
    else if (el.shape === 'sankey' && canEditSankey(can, el)) setSankeyFlowsOpenForId(id);
    else if (el.shape === 'sequence' && canEditSequence(can, el)) setSequenceOpenForId(id);
  };
  // How a comment change made on a Comment panel is kept: shared with the anchored popover.
  const commentPersist = commentPersisters({
    readOnly: isReadOnly,
    projectId,
    tabId: activeTab.id,
    selfId: selfParticipant.id,
    shareCode: sessionShareCode,
  });
  const threadOn = (elementId: string) => {
    const el = activeTab.elements.find((e) => e.id === elementId);
    return el && isBoxed(el) ? threadAt(el) : undefined;
  };
  const backdrop = resolveViewBackdrop(activeTab, appearance);
  // Stock colours stored by name are drawn in their version for this canvas, on every tab and in
  // either mode (docs/specs/007-editor/editor-modes.md "One look"). Display only: the projector
  // caches per element, so an unchanged element keeps its identity and the memoised views stay quiet.
  const [projectStockColours] = useState(createStockColourProjector);
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in this viewer's half (docs/specs/011-theme/light-and-dark.md); the map is cached per theme and
  // appearance, so its identity holds and the projector's cache with it.
  const shownElements = activeTab.elements;
  const canvasElements = projectStockColours(
    shownElements,
    surface,
    themeViewMap(activeTab.theme, appearance),
    {
      stored: activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
      drawn: backdrop.backgroundColor,
    },
  );
  // Lazy per-tab load gate (docs/specs/006-project/per-tab-storage.md): show a blocking loader / error over
  // the canvas while the active tab's content is still being fetched, so
  // the user never edits a blank placeholder whose autosave would
  // overwrite the real server row. Derived once in useEditorState (it also
  // gates editsBlocked there, so the pointer overlay and the edit lock
  // can't disagree); consumed here for the overlay.
  const tabLoadState = activeTabLoadState;
  // Quick add + connect Arrow starter (docs/specs/008-canvas/canvas-and-palette.md) — see useQuickConnectStart.
  const { handleStartArrow } = useQuickConnectStart({ readSelection, beginAnchorDrag });

  // A control inside an element (a board header's ⋯) opens this element menu under itself, selecting the element
  // first as a right-click does (the menu acts on the selection); never on one a peer holds.
  // A chart its Sheet draws is selected for its menu directly, and let go as the menu closes (sheet.md "Charts").
  const selectForMenu = useSheetChartMenuSelection({
    elements: activeTab.elements,
    contextMenu,
    readSelection,
    selectElement,
    setSelectedId,
    setMultiSelectedIds,
  });
  useElementMenuOpener(setContextMenu, !isReadOnly, (id) => {
    if (lockedByOther(id)) return false;
    selectForMenu(id);
    return true;
  });

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

  // The collaboration elements (docs/specs/012-collaboration/temperature-check.md). One bag for their faces;
  // the write handlers drop out
  // entirely for a view-role visitor. Held stable while nothing a face shows changes, so a render here
  // does not re-render every element (docs/specs/008-canvas/canvas-performance.md).
  const collab = useStableCollab({
    // The project-write key, not the owner id — see CollabApi.selfKey.
    selfKey: participantKey(selfParticipant),
    // Taking part is a Participant's too (docs/specs/013-workspace/share-roles.md); running stays an Editor's.
    respond: can.takePart ? collabElements.respond : undefined,
    clearResponses: isReadOnly ? undefined : collabElements.clearResponses,
  });
  // Object props the canvas boundary compares by identity (docs/specs/008-canvas/canvas-performance.md
  // "The canvas re-renders only for what it shows"): new only when their data changes.
  const activeTheme = getTheme(activeTab.theme);

  return (
    // The tab's theme for faces that dress in it unstored (the image placeholder).
    <CanvasThemeProvider theme={activeTheme}>
      {/* The tab's tag colours (docs/specs/009-elements/tag-colours.md), for the cards that render them. */}
      <TagColoursProvider tab={activeTab}>
        <Canvas
          tabName={activeTab.name}
          tabSummaries={tabSummaries}
          // Portals (docs/specs/009-elements/portal-element.md) can lead to another tab; see Canvas.enterPortal.
          portalTabs={tabs}
          activeTabId={activeTab.id}
          activeTabLoaded={loadedTabIds.has(activeTab.id)}
          tabLocked={activeTabLocked}
          readOnly={isReadOnly}
          participantPalette={participating && can.addContent}
          takePart={can.takePart}
          canMove={can.move}
          canResize={can.resize}
          projectName={projectName}
          tabBackgroundPattern={backdrop.backgroundPattern ?? 'grid'}
          tabBackgroundColor={backdrop.backgroundColor}
          tabBackgroundOpacity={backdrop.backgroundOpacity ?? 1}
          tabBackgroundPatternScale={activeTab.backgroundPatternScale ?? 1}
          tabBackgroundAnimationSpeed={activeTab.backgroundAnimationSpeed ?? 1}
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
          tabLayers={activeTab.layers}
          previewDrawnArrow={(intent, startX, startY, endX, endY) =>
            drawnArrowAsShown(intent, startX, startY, endX, endY, {
              elements: activeTab.elements,
              theme: activeTheme,
              styleNewElement,
              surface,
            })
          }
          layerInertIds={layerInertIds}
          shiftDupGhostIds={shiftDupGhostIds}
          snapGuideStore={snapGuideStore}
          remoteSelectionsByElement={remoteSelectionsByElement}
          remoteCursors={remoteCursorRows}
          onCanvasPointerMove={(x, y, target) => {
            canvasPointerRef.current = pastePointer(x, y, target ?? null);
            broadcastCursor(x !== null && y !== null ? { x, y } : null);
          }}
          onSelectMarquee={selectMarquee}
          canvasTool={canvasTool}
          onSetCanvasTool={setCanvasTool}
          // Session button (docs/specs/012-collaboration/session-button.md) / Picker (docs/specs/012-collaboration/picker.md):
          // see useBehaviourElements — the press resolves what to do from the
          // element and calls the tool that already exists.
          onPressSessionButton={pressSessionButton}
          sessionStartBlocked={isReadOnly}
          timerState={activeTab.timer ? (activeTab.timer.running ? 'running' : 'paused') : 'none'}
          onSetSessionConfig={isReadOnly ? undefined : setSessionConfigFor}
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
          // Comment panels (docs/specs/012-collaboration/comment-pin.md) drive the SAME thread machinery the anchored
          // popover does — it is all keyed by element id already.
          commentSelfId={selfParticipant.id}
          // Commenting is a Participant's too (docs/specs/013-workspace/share-roles.md); a Viewer only reads.
          commentPanelActions={
            !can.takePart
              ? undefined
              : {
                  // A Participant has no autosave: its panel changes go through the comment endpoints, as the
                  // popover's do (lib/comment-persistence.ts); an Editor's ride the room and its save.
                  add: (id, text, mentions) =>
                    addComment(id, text, commentPersist.add(id, text, mentions), mentions),
                  remove: (id, cid) => deleteComment(id, cid, commentPersist.remove(cid)),
                  resolve: (id) =>
                    resolveThread(id, commentPersist.threadState(threadOn(id), true)),
                  unresolve: (id) =>
                    unresolveThread(id, commentPersist.threadState(threadOn(id), false)),
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
                  ...(linkedActions.openOnBoard
                    ? { openBoard: () => linkedActions.openOnBoard?.() }
                    : {}),
                }
          }
          // Everyone sees what a Picker holds; only an Editor spins it (ElementFaceRouter, share-roles.md).
          onRollPicker={pickerFor}
          collab={collab}
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
          canUndo={canUndo && !activeTabLocked}
          canRedo={canRedo && !activeTabLocked}
          onAddShape={addShape}
          onAddIcon={addIcon}
          onAddSticker={addSticker}
          onAddTechIcon={addTechIcon}
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
          onAddFlowchart={addFlowchart}
          onAddAvatar={addAvatar}
          onAddText={addText}
          onAddSticky={addSticky}
          onDropFile={isReadOnly ? undefined : dropBoardFile}
          onAddArrow={addArrow}
          reshapingArrowId={reshapingArrowId}
          onBeginPolygon={beginPolygon}
          pendingDraw={pendingDraw}
          onCommitDraw={commitDraw}
          onCommitPolygon={commitPolygon}
          settings={userPreferences}
          onCancelDraw={cancelDrawShape}
          onUndo={undo}
          onRedo={redo}
          projectList={projectList}
          folders={folders}
          sharedProjects={sharedProjects}
          teams={explorerTeams}
          teamFolders={teamFolders}
          teamProjects={teamProjects}
          onDismissShared={(id) => void dismissSharedProject(id)}
          projectListLoading={projectListLoading}
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
          sessionTools={sessionTools}
          userPreferences={userPreferences}
          onToggleRecentExclusion={toggleRecentExclusion}
          favouriteIds={favouriteIds}
          onToggleFavourite={toggleFavourite}
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
          voteResults={voteResults}
          onJumpToVoteResult={jumpToVoteResult}
          isVoteHost={isVoteHost(activeTab.vote, participantKey(selfParticipant))}
          // Who can cast, ourselves included (livePresence is the REMOTE roster): one per person, never a
          // view-link guest or an agent row (answeringKeys), so turnout never waits on someone who cannot vote.
          participantCount={
            answeringKeys([selfInRoom(selfParticipant, can.level), ...livePresence]).length
          }
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
          onOpenCommentsForElement={(id, cell) => {
            setSelectedId(id);
            // A Sheet cell's thread (docs/specs/029-sheets/sheet.md "Cell comments"): its cell selected, so the
            // popover sits beside it.
            if (cell !== undefined) {
              focusSheetCell(id, cell);
              return openComments(id, cell);
            }
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
          currentProjectId={projectId}
          onOpenProject={openProject}
          onNewProject={newProject}
          explorerMenuActions={{
            // The header's Share gate: the owner, or a joined member of the project's team
            // (docs/specs/013-workspace/folders.md, docs/specs/013-workspace/team-shared-projects.md).
            onShare:
              canShareProject && hydrated
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
          onRenameCurrent={(next) => {
            const prev = projectName.trim();
            const nextTrim = next.trim();
            setProjectName(next);
            if (nextTrim && projectId)
              setProjectList((prev) =>
                prev.map((d) => (d.id === projectId ? { ...d, name: nextTrim } : d)),
              );
            if (nextTrim && nextTrim !== prev) track('Project', 'Renamed');
          }}
          onDeleteProject={(id) => void deleteProject(id)}
          onLibraryChanged={refreshOwnProjects}
          onDuplicateProject={(id) => void duplicateProject(id)}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={(id) => void deleteFolder(id)}
          onTeamFolders={onTeamFolders}
          onMoveProjectToFolder={moveProjectToFolder}
          onMoveProjectTo={moveProjectTo}
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
                  if (lockedByOther(id)) return;
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
          onAddTableRow={appendTableRowSelected}
          onAddTableColumn={appendTableColumnSelected}
          onSetPageHeading={setPageHeading}
          onAppendWebRow={isReadOnly ? undefined : appendWebRowTo}
          onGrowMindNode={growMindNode}
          flowchartActions={isReadOnly ? undefined : flowchartActions}
          entityActions={isReadOnly ? undefined : entityActions}
          canEditMindOutline={mindOutline.canEdit}
          onEditMindOutline={mindOutline.open}
          onTidyMindMap={tidyMindMap}
          onAbandonMindNode={abandonMindNode}
          chartPalette={themeChartPalette(activeTheme)}
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
          onSetTextAlign={setTextAlignSelected}
          onFollowLink={followLink}
          onOpenComments={openComments}
          onOpenAction={openActionPopover}
          onOpenNote={openNote}
          onEditLink={isReadOnly ? undefined : setLinkPickerOpenForId}
          onOpenEditDialog={isReadOnly ? undefined : openEditDialog}
          // The visitor name prompt shows for EVERYONE, view-role visitors included: it only writes their own
          // participant row, so there's no 403, and they should set a name before others see them in presence.
          showIdentityPrompt={identityOnlyScreenOpen}
          hydrated={hydrated}
          // Visitor on someone else's project + signed in → lock the
          // identity input to their Clerk name. Owner branch never
          // shows the identity prompt so `lockedName` is moot there;
          // pure guests pass null and keep the editable name field.
          identityLockedName={!isOwner && clerkUserId ? clerkDisplayName : null}
          welcomeOpen={anyWelcomeOpen}
          selfParticipant={selfParticipant}
          onConfirmIdentity={confirmIdentity}
          onCancelIdentity={cancelIdentity}
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
          // A phone held sideways has no Explorer at all (docs/specs/007-editor/live-app.md "A phone
          // held sideways"): too short for it, and no way to bring it back; turn the phone upright.
          explorerHidden={workbenchMode || landscapePhone}
          onToggleZen={embedMode ? undefined : toggleZenMode}
          aiPanel={
            aiCapable && userPreferences.aiAssistanceEnabled && aiPanelVisible && !isReadOnly
              ? {
                  position: aiPanelPosition,
                  onMove: (x, y) => setAiPanelPosition({ x, y }),
                  onReset: () => setAiPanelPosition(null),
                  contextElements: activeTab.elements,
                  onApplyElements: applyAiElements,
                  ownerId: selfParticipant.id,
                  tabId: activeTab.id,
                }
              : undefined
          }
        />
      </TagColoursProvider>
    </CanvasThemeProvider>
  );
}
