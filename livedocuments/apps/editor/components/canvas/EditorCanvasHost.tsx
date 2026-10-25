'use client';

import { TagColoursProvider } from '@/components/canvas/TagColoursContext';
import { usePointerNoteSetters } from '@/hooks/canvas/usePointerNoteSetters';
import { SuppressElementIndicators } from '@/components/canvas/ElementIndicatorStyleContext';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { pastePointer } from '@liveworkspace/workbench/lib/canvas-pointer';
import { dropThenDisarm } from '@liveworkspace/workbench/lib/palette-drop';
import { describeOne } from '@/lib/element-names';
import { canvasSurface } from '@livedocuments/document';
import { createStockColourProjector } from '@/lib/stock-colour-projector';
import { usePageView } from '@/hooks/canvas/usePageView';
import { drawnArrowAsShown } from '@/lib/drawn-arrow-preview';
import { useState } from 'react';
import { presentedPages } from '@/lib/presented-pages';
import { LockedElementMenu, type LockHolder } from '@/components/canvas/LockedElementMenu';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { getTheme, themeChartPalette, themeViewMap, type ThemeId } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsLandscapePhone } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { useStableObject } from '@liveworkspace/workbench/hooks/ui/useStableObject';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { canEditSankey } from '@/lib/sankey-edit';
import { CanvasThemeProvider } from '@/components/canvas/CanvasSurfaceContext';
import {
  TabWindowContext,
  useTabWindowContextValue,
} from '@/components/canvas/tab-window/tab-window-context';
import { useSelectTab } from '@/app/document/[id]/useSelectTab';
import {
  brushPageId,
  pageBrushPreview,
  pagePaintPress,
} from '@liveworkspace/workbench/lib/format-page-brush';
import { useDeadPageBrush } from '@liveworkspace/workbench/hooks/editor/useDeadPageBrush';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';

// The Canvas element's wiring, lifted out of EditorView (which carried
// ~500 lines of prop plumbing for it). Reads everything straight from
// EditorContext — the same host pattern as EditorModals /
// EditorContextMenuHost — plus the handful of locals only the Canvas
// props consume (the quick-connect arrow starter, the memoised Explorer
// list props, the owner-badge resolution).
export function EditorCanvasHost() {
  const {
    activeTab,
    activeTabLoadState,
    activeTabLocked,
    commitElements,
    presentingElements,
    presentingPageId,
    slideDeck,
    slideDeckPanelPosition,
    setSlideDeckPanelPosition,
    layers,
    activeLayerId,
    layerInertIds,
    layerCounts,
    laserPanelPosition,
    spotlightPanelPosition,
    setSpotlightPanelPosition,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatPanelPosition,
    setFormatPanelPosition,
    laserConfig,
    onChangeLaserField,
    setLaserPanelPosition,
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
    addShape,
    addStatRow,
    addSticky,
    dropBoardFile,
    addTable,
    addTechIcon,
    addText,
    anyWelcomeOpen,
    appendTableColumnSelected,
    appendTableRowSelected,
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
    broadcastLaser,
    canvasPointerRef,
    cancelConnect,
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
    actionRows,
    commentRows,
    commentsPanelPosition,
    commitDraw,
    commitPolygon,
    styleNewElement,
    commitLabel,
    commitTable,
    deleteCurvePoint,
    deleteMultiSelected,
    deleteSelected,
    documentId,
    documentName,
    nameDocument,
    sessionShareCode,
    dropIconOnElement,
    dropPaletteItem,
    duplicateMultiSelected,
    contextMenu,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    editCursorAtEnd,
    editingId,
    embedMode,
    workbenchMode,
    exitFormatTool,
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
    releaseSelectionLock,
    isPinchingRef,
    isReadOnly,
    can,
    laserTrailRows,
    livePresence,
    lockedByOther,
    mapPosition,
    narrowMultiSelection,
    newDocument,
    openActionPopover,
    completeAction,
    reopenAction,
    openCellLinkPicker,
    openComments,
    openNote,
    pendingDraw,
    redo,
    remoteCursorRows,
    remoteSelectionsByElement,
    retryActiveTabLoad,
    readSelection,
    selectElement,
    selectMarquee,
    selfParticipant,
    followMe,
    tabs,
    setCanvasTool,
    setCanvasThemeTab,
    setCommentsPanelPosition,
    setContextMenu,
    setEditingId,
    setExportOpen,
    setExportScope,
    setCodeEditOpenForId,
    setSankeyFlowsOpenForId,
    setFormatSourceId,
    setLinkPickerOpenForId,
    setMapPosition,
    setMultiSelectedIds,
    setSelectedId,
    toggleChecklistItem,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setHeroCaptionLine,
    setTextAlignSelected,
    setViewportOffset,
    setViewportZoom,
    shiftDupGhostIds,
    snapGuideStore,
    spawnConnectSelected,
    tabSummaries,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    toggleZenMode,
    undo,
    userPreferences,
    zenMode,
    drag,
    editorMode,
    pagesMode,
    loadedTabIds,
    isOutOfScope,
    tabLoadErrors,
  } = useEditorContext();
  // A pointer note's tip handle (docs/specs/009-elements/pointer-note.md).
  const { setPointerTip } = usePointerNoteSetters(commitElements, activeTab.elements);
  const startPanelOpen = useStartPanelOpen();
  // A free arrow's frame stands down while a handle reshapes it (arrow-bending.md).
  const reshapingArrowId =
    drag &&
    (drag.kind === 'arrow-bend' ||
      drag.kind === 'arrow-curve' ||
      drag.kind === 'arrow-elbow' ||
      drag.kind === 'arrow-endpoint')
      ? drag.arrowId
      : null;

  // The menu on an element somebody else is holding (docs/specs/007-editor/editor-app.md).
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
  // A workspace frame's hooks: its Back, at the canvas's top left (WB59).
  const workbenchFrame = useWorkbenchSession()?.frame ?? null;
  // Double-click on an element with its own edit dialog (docs/specs/009-elements/code-block.md,
  // docs/specs/009-elements/sankey.md): which dialog depends on the kind.
  const openEditDialog = (id: string) => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape') return;
    if (el.shape === 'code-block') setCodeEditOpenForId(id);
    else if (el.shape === 'sankey' && canEditSankey(can, el)) setSankeyFlowsOpenForId(id);
  };
  const backdrop = resolveViewBackdrop(activeTab, appearance);
  // Stock colours stored by name are drawn in their version for this canvas, on every tab
  // (docs/specs/008-canvas/canvas-and-palette.md "Colours"). Display only: the projector
  // caches per element, so an unchanged element keeps its identity and the memoised views stay quiet.
  const [projectStockColours] = useState(createStockColourProjector);
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in this viewer's half (docs/specs/011-theme/light-and-dark.md); the map is cached per theme and
  // appearance, so its identity holds and the projector's cache with it.
  const shownElements = presentingElements ?? activeTab.elements;
  // On a page with a fill of its own, an element is drawn for that page rather than the chrome
  // (stock-colour-projector.ts "PageView"); off Pages mode, or with no filled page, nothing to do.
  const pageView = usePageView(shownElements, pagesMode?.pages, activeTab.theme);
  const canvasElements = projectStockColours(
    shownElements,
    surface,
    themeViewMap(activeTab.theme, appearance),
    pageView,
  );
  // Lazy per-tab load gate (docs/specs/006-document/per-tab-storage.md): show a blocking loader / error over
  // the canvas while the active tab's content is still being fetched, so
  // the user never edits a blank placeholder whose autosave would
  // overwrite the real server row. Derived once in useEditorState (it also
  // gates editsBlocked there, so the pointer overlay and the edit lock
  // can't disagree); consumed here for the overlay.
  const tabLoadState = activeTabLoadState;
  // Quick add + connect Arrow starter (docs/specs/008-canvas/canvas-and-palette.md) — see useQuickConnectStart.
  const { handleStartArrow } = useQuickConnectStart({ readSelection, beginAnchorDrag });

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
  // A page's background in the brush (docs/specs/007-editor/pages-mode.md "Copying a background").
  const brushedPage = pagesMode?.pages.find((pg) => pg.id === brushPageId(formatSourceId));
  useDeadPageBrush(
    formatSourceId,
    pagesMode?.pages.map((pg) => pg.id),
    setFormatSourceId,
  );
  const formatSource = formatSourceId
    ? (activeTab.elements.find((el) => el.id === formatSourceId) ?? null)
    : null;

  // Object props the canvas boundary compares by identity (docs/specs/008-canvas/canvas-performance.md
  // "The canvas re-renders only for what it shows"): new only when their data changes.
  const stableSlideDeck = useStableObject(slideDeck);
  const activeTheme = getTheme(activeTab.theme);
  // Tab windows (docs/specs/009-elements/tab-window.md): the tabs they show, fetched as they are shown.
  const selectTab = useSelectTab();
  const tabWindows = useTabWindowContextValue({
    tabs,
    ownTabId: activeTab.id,
    loadedTabIds,
    loadTabs: loadAllTabs,
    openTab: selectTab,
    canChoose: can.level === 'edit' && !activeTabLocked,
    commitElements,
    isOutOfScope,
    loadErrors: tabLoadErrors,
  });

  return (
    // The tab's theme for faces that dress in it unstored (the image placeholder).
    <CanvasThemeProvider theme={activeTheme}>
      {/* The tab's tag colours (docs/specs/009-elements/tag-colours.md), for the cards that render them. */}
      <TagColoursProvider tab={activeTab}>
        <TabWindowContext.Provider value={tabWindows}>
          {/* Presenting shows the slide as the audience sees it: no indicators or lock badges on its elements
          (docs/specs/008-canvas/element-indicators.md "Unchanged"). */}
          <SuppressElementIndicators when={presentingElements != null}>
            <Canvas
              tabName={activeTab.name}
              tabSummaries={tabSummaries}
              activeTabId={activeTab.id}
              activeTabLoaded={loadedTabIds.has(activeTab.id)}
              tabLocked={activeTabLocked}
              readOnly={isReadOnly}
              takePart={can.takePart}
              canWriteText={can.writeText}
              documentName={documentName}
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
                // In Pages, Fit frames the page you are nearest, not the whole tab.
                if (pagesMode) pagesMode.fitPageInView();
                else fitToScreen();
                track('Canvas', 'Zoomed', 'Fit');
              }}
              setViewportOffset={setViewportOffset}
              // Presenting (docs/specs/012-collaboration/presentation-mode.md) narrows the canvas to one slide's elements. The
              // real canvas still draws them — a slide has to respond to clicks and
              // carry live element state, and there is then exactly one thing that
              // knows how an element looks.
              elements={canvasElements}
              tabLayers={activeTab.layers}
              editorMode={editorMode.mode}
              // No page while Start Making Pages is open (docs/specs/007-editor/start-diagramming.md "Start Making Pages"):
              // the tab's first page is drawn only once a template is picked or the panel closed, so nothing waits behind it.
              pagesMode={startPanelOpen ? null : presentedPages(pagesMode, presentingPageId)}
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
              onToggleLockMultiSelected={toggleLockMultiSelected}
              onFilterMultiSelected={narrowMultiSelection}
              onExportMultiSelected={() => {
                setExportScope('selection');
                setExportOpen(true);
              }}
              editingId={editingId}
              editCursorAtEnd={editCursorAtEnd}
              formatSourceId={formatSourceId}
              onFormatPagePress={
                canvasTool === 'format' && pagesMode?.edit
                  ? (pageId) => {
                      // A page's background as the brush, painted page to page (docs/specs/007-editor/
                      // pages-mode.md "Copying a background").
                      // A brush whose page has gone is emptied as the page goes (useDeadPageBrush), so this
                      // press arms the pressed page at once.
                      const press = pagePaintPress(
                        formatSourceId,
                        pageId,
                        formatConfig.mode === 'keep',
                      );
                      // A refused paint (a locked page) keeps the brush:
                      // only a paint empties a Paint once brush.
                      if (
                        press.paint &&
                        !pagesMode.edit?.copyBackground(press.paint.from, press.paint.to)
                      )
                        return;
                      if (press.next !== formatSourceId) setFormatSourceId(press.next);
                    }
                  : undefined
              }
              canUndo={canUndo && !activeTabLocked}
              canRedo={canRedo && !activeTabLocked}
              onAddShape={addShape}
              onAddIcon={addIcon}
              onAddSticker={addSticker}
              onAddTechIcon={addTechIcon}
              onDropIcon={isReadOnly ? undefined : dropIconOnElement}
              onLinkCell={isReadOnly ? undefined : openCellLinkPicker}
              onAddTable={addTable}
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
              onDropFile={isReadOnly ? undefined : dropBoardFile}
              onAddImage={addImage}
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
              userPreferences={userPreferences}
              laserPanelPosition={laserPanelPosition}
              spotlightPanelPosition={spotlightPanelPosition}
              formatConfig={formatConfig}
              onToggleFormatGroup={onToggleFormatGroup}
              onSetFormatMode={onSetFormatMode}
              // What the brush holds, described for the panel's preview (docs/specs/010-palette/stickers.md):
              // the loaded element's name and the three colours the swatch draws.
              formatBrushSource={
                brushedPage
                  ? pageBrushPreview(brushedPage)
                  : formatSource
                    ? {
                        name: describeOne(formatSource),
                        fill: 'fillColor' in formatSource ? formatSource.fillColor : undefined,
                        stroke:
                          'strokeColor' in formatSource ? formatSource.strokeColor : undefined,
                        textColor: 'textColor' in formatSource ? formatSource.textColor : undefined,
                      }
                    : null
              }
              formatPanelPosition={formatPanelPosition}
              onMoveFormatPanel={(x, y) => setFormatPanelPosition({ x, y })}
              onResetFormatPanel={() => setFormatPanelPosition(null)}
              // Slide Deck (docs/specs/012-collaboration/presentation-mode.md): the deck itself plus its panel's placement.
              slideDeck={stableSlideDeck}
              slideDeckPanelPosition={slideDeckPanelPosition}
              onMoveSlideDeckPanel={(x, y) => setSlideDeckPanelPosition({ x, y })}
              onResetSlideDeckPanel={() => setSlideDeckPanelPosition(null)}
              onMoveSpotlightPanel={(x, y) => setSpotlightPanelPosition({ x, y })}
              onResetSpotlightPanel={() => setSpotlightPanelPosition(null)}
              laserConfig={laserConfig}
              onChangeLaserField={onChangeLaserField}
              onMoveLaserPanel={(x, y) => setLaserPanelPosition({ x, y })}
              onResetLaserPanel={() => setLaserPanelPosition(null)}
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
                  : (id, done) => (done ? completeAction(id) : reopenAction(id))
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
              onElementContextMenu={
                isReadOnly
                  ? undefined
                  : (id, sx, sy) => {
                      // Concurrent-selection lock (docs/specs/007-editor/editor-app.md): a peer holds this
                      // element, so it can't be selected, dragged, or edited — don't
                      // pop a dead context menu on it either. Same gate as
                      // selectElement.
                      //
                      // An Editor's one action on a locked element is freeing it, and that gets
                      // its own small menu rather than the element's real one, whose every
                      // other row would be dead. See LockedElementMenu.
                      if (lockedByOther(id)) {
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
              onCommitTable={commitTable}
              onAddTableRow={appendTableRowSelected}
              onAddTableColumn={appendTableColumnSelected}
              onToggleChecklistItem={isReadOnly ? undefined : toggleChecklistItem}
              onSetPageHeading={setPageHeading}
              onSetWebRows={isReadOnly ? undefined : setWebRows}
              onSetPointerTip={isReadOnly ? undefined : setPointerTip}
              onAppendWebRow={isReadOnly ? undefined : appendWebRowTo}
              onSetHeroCaptionLine={isReadOnly ? undefined : setHeroCaptionLine}
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
              // A phone held sideways has no Explorer at all (docs/specs/007-editor/editor-app.md "A phone
              // held sideways"): too short for it, and no way to bring it back; turn the phone upright.
              explorerHidden={workbenchMode || landscapePhone}
              workbenchBack={workbenchFrame}
              onToggleZen={embedMode ? undefined : toggleZenMode}
            />
            {lockedMenu ? (
              <LockedElementMenu
                at={lockedMenu.at}
                holders={lockedMenu.holders}
                onRelease={(presenceId) => releaseSelectionLock(presenceId, lockedMenu.elementId)}
                onClose={() => setLockedMenu(null)}
              />
            ) : null}
          </SuppressElementIndicators>
        </TabWindowContext.Provider>
      </TagColoursProvider>
    </CanvasThemeProvider>
  );
}
