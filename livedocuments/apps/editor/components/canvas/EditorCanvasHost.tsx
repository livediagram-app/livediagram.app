'use client';

import { goToElement } from '@/lib/go-to-element';
import { TagColoursProvider } from '@/components/canvas/TagColoursContext';
import { usePointerNoteSetters } from '@/hooks/canvas/usePointerNoteSetters';
import { SuppressElementIndicators } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { PresentingProvider } from '@/components/canvas/PresentingContext';
import { useBuildEntrance } from '@/components/canvas/useBuildEntrance';
import { BuildStepsProvider } from '@/components/canvas/BuildStepsContext';
import { pastePointer } from '@liveworkspace/workbench/lib/canvas-pointer';
import { canvasSurface } from '@livedocuments/document';
import { createStockColourProjector, plainPaper } from '@/lib/stock-colour-projector';
import { usePageView } from '@/hooks/canvas/usePageView';
import { drawnArrowAsShown } from '@/lib/drawn-arrow-preview';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ItemWebhooksDialog } from '@liveworkspace/workbench/components/dialogs/ItemWebhooksDialog';
import { registerTabStyleOpen } from '@/lib/tab-style-opener';
import { setBandDocumentName } from '@/lib/article/article-band-layout';
import { presentedPages } from '@/lib/presented-pages';
import { shownRemoteSelections } from '@/lib/presence-rows';
import { LockedElementMenu } from '@liveworkspace/workbench/components/canvas/LockedElementMenu';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { getTheme, themeChartPalette, themeViewMap, type ThemeId } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsLandscapePhone } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { useTemplateStartOpen } from '@/components/start/useTemplateStartShown';
import { canEditSankey } from '@/lib/sankey-edit';
import { canEditMap } from '@/lib/map-edit';
import { CanvasThemeProvider } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { useCanvasHostBrush } from '@/components/canvas/useCanvasHostBrush';
import { useCanvasHostExplorer } from '@/components/canvas/useCanvasHostExplorer';
import { useCanvasHostMenus } from '@/components/canvas/useCanvasHostMenus';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';
import { useInsertCanvasProps } from './editor-canvas-host/useInsertCanvasProps';
import { usePanelCanvasProps } from './editor-canvas-host/usePanelCanvasProps';
import { useEditCanvasProps } from './editor-canvas-host/useEditCanvasProps';

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
    presentedElements,
    buildEntrance,
    slideDeck,
    presentingPageId,
    layers,
    layerInertIds,
    laserConfig,
    anyWelcomeOpen,
    beginAnchorDrag,
    broadcastCursor,
    broadcastLaser,
    canvasPointerRef,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,
    confirmIdentity,
    cancelIdentity,
    accountDisplayName,
    accountUserId,
    styleNewElement,
    deleteMultiSelected,
    documentId,
    documentName,
    nameDocument,
    sessionShareCode,
    duplicateMultiSelected,
    contextMenu,
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
    releaseSelectionLock,
    isPinchingRef,
    isReadOnly,
    can,
    laserTrailRows,
    livePresence,
    narrowMultiSelection,
    newDocument,
    openActionPopover,
    openAssignAction,
    scrollIntoView,
    openComments,
    redo,
    remoteCursorRows,
    remoteSelectionsByElement,
    retryActiveTabLoad,
    readSelection,
    selectElement,
    selectMarquee,
    selfParticipant,
    followMe,
    setCanvasTool,
    setCanvasThemeTab,
    setContextMenu,
    setExportOpen,
    setExportScope,
    setCodeEditOpenForId,
    setSankeyFlowsOpenForId,
    setMapDialogOpenForId,
    setLinkPickerOpenForId,
    setSelectedId,
    setTextAlignSelected,
    setViewportOffset,
    setViewportZoom,
    shiftDupGhostIds,
    snapGuideStore,
    tabSummaries,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleZenMode,
    undo,
    userPreferences,
    zenMode,
    drag,
    editorMode,
    pagesMode,
    loadedTabIds,
  } = useEditorContext();
  // The name a {name} field in an article's header or footer shows.
  useLayoutEffect(() => setBandDocumentName(documentName), [documentName]);
  // A pointer note's tip handle (docs/specs/009-elements/pointer-note.md).
  const { setPointerTip } = usePointerNoteSetters(commitElements, activeTab.elements);
  // Open, or about to open (its code still loading): either way the tab's first page waits. Closed for an explicit
  // blank, it is not open, and the page is drawn to ask its kind.
  const templateStartOpen = useTemplateStartOpen();
  const startPanelOpen = useStartPanelOpen() || templateStartOpen;
  // A free arrow's frame stands down while a handle reshapes it (arrow-bending.md).
  const reshapingArrowId =
    drag &&
    (drag.kind === 'arrow-bend' ||
      drag.kind === 'arrow-curve' ||
      drag.kind === 'arrow-elbow' ||
      drag.kind === 'arrow-endpoint')
      ? drag.arrowId
      : null;

  // The menu and deselect gestures, the Explorer's document actions and the format brush (beside this file).
  const {
    lockedMenu,
    setLockedMenu,
    onDeselect,
    onElementContextMenu,
    onMultiContextMenu,
    onOpenMultiContextMenu,
    onCanvasContextMenu,
  } = useCanvasHostMenus();
  const { explorerMenuActions, webhooksOpen, setWebhooksOpen } = useCanvasHostExplorer();
  const { onFormatPagePress, formatBrushSource } = useCanvasHostBrush();
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
    else if (canEditMap(can, el)) setMapDialogOpenForId(id);
  };
  // A Collaborate panel row goes to its card, brought into view (goToElement).
  const goToRowElement = (id: string) =>
    goToElement(activeTab.elements, id, setSelectedId, scrollIntoView);
  const backdrop = resolveViewBackdrop(activeTab, appearance);
  // Stock colours stored by name are drawn in their version for this canvas, on every tab
  // (docs/specs/008-canvas/canvas-and-palette.md "Colours"). Display only: the projector
  // caches per element, so an unchanged element keeps its identity and the memoised views stay quiet.
  const [projectStockColours] = useState(createStockColourProjector);
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in this viewer's half (docs/specs/011-theme/light-and-dark.md); the map is cached per theme and
  // appearance, so its identity holds and the projector's cache with it.
  // A presented slide less the builds still to come (presentation-mode.md "Builds"); the step's own elements play in.
  const shownElements = presentedElements ?? activeTab.elements;
  useBuildEntrance(buildEntrance, canvasMainRef);
  // A presented slide shows nobody else's selection, as it shows nobody else's cursor.
  const remoteSelectionsShown = shownRemoteSelections(
    remoteSelectionsByElement,
    presentingElements != null,
  );
  // On a page with a fill of its own, an element is drawn for that page rather than the chrome
  // (stock-colour-projector.ts "PageView"); off Pages mode, or with no filled page, nothing to do.
  const pageView = usePageView(shownElements, pagesMode?.pages, activeTab.theme);
  // Tab Style's door on each page's title bar (lib/tab-style-opener.ts), for whoever may style the tab: an Editor
  // outside an embed. The page's own Style button tracks its opening.
  const tabStyleOpens = !isReadOnly && !embedMode;
  useEffect(
    () => registerTabStyleOpen(tabStyleOpens ? () => setCanvasThemeTab('looks') : null),
    [tabStyleOpens, setCanvasThemeTab],
  );
  // Once the tab has pages, Tab Style is on each page's title bar, not the bottom-right cluster.
  const styleOnPages = (pagesMode?.pages.length ?? 0) > 0;
  const canvasElements = projectStockColours(
    shownElements,
    surface,
    themeViewMap(activeTab.theme, appearance),
    pageView,
    // Labels are re-inked against the plain paper (docs/specs/011-theme/light-and-dark.md "A theme never sinks a
    // label into what is behind it"): its words are made on white, the paper as stored and printed, and the dark
    // editor draws it slate, where a template's dark words (a resume's job titles, a heading) would vanish.
    plainPaper(surface),
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

  // Object props the canvas boundary compares by identity (docs/specs/008-canvas/canvas-performance.md
  // "The canvas re-renders only for what it shows"): new only when their data changes.
  const activeTheme = getTheme(activeTab.theme);
  // The Canvas props by concern (beside this file, in editor-canvas-host/).
  const insertProps = useInsertCanvasProps({ handleStartArrow });
  const panelProps = usePanelCanvasProps({ styleOnPages, goToRowElement });
  const editProps = useEditCanvasProps({ setPointerTip });
  return (
    // The tab's theme for faces that dress in it unstored (the image placeholder).
    <CanvasThemeProvider theme={activeTheme}>
      {/* The tab's tag colours (docs/specs/009-elements/tag-colours.md), for the cards that render them. */}
      <TagColoursProvider tab={activeTab}>
        {/* Each built element's step number for its badge (presentation-mode.md "Setting builds up"). */}
        <BuildStepsProvider slides={slideDeck?.deck.slides} tab={activeTab} editable={!isReadOnly}>
          {/* Presenting shows the slide as the audience sees it: no indicators or lock badges on its elements
          (docs/specs/008-canvas/element-indicators.md "Unchanged"). */}
          <SuppressElementIndicators when={presentingElements != null}>
            {/* A presented slide's stat rows count up (docs/specs/009-elements/stat-row.md). */}
            <PresentingProvider when={presentingElements != null}>
              <Canvas
                {...insertProps}
                {...panelProps}
                {...editProps}
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
                projectElement={projectStockColours.one}
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
                remoteSelectionsByElement={remoteSelectionsShown}
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
                onFormatPagePress={onFormatPagePress}
                canUndo={canUndo && !activeTabLocked}
                canRedo={canRedo && !activeTabLocked}
                reshapingArrowId={reshapingArrowId}
                settings={userPreferences}
                onUndo={undo}
                onRedo={redo}
                layers={layers}
                userPreferences={userPreferences}
                formatBrushSource={formatBrushSource}
                currentDocumentId={documentId}
                currentShareCode={sessionShareCode}
                onRenameCurrentDocument={nameDocument}
                onNewDocument={newDocument}
                explorerMenuActions={explorerMenuActions}
                onDeselect={onDeselect}
                onSelect={selectElement}
                onElementContextMenu={onElementContextMenu}
                onMultiContextMenu={onMultiContextMenu}
                onOpenMultiContextMenu={onOpenMultiContextMenu}
                onCanvasContextMenu={onCanvasContextMenu}
                chartPalette={themeChartPalette(activeTheme)}
                onShiftSelect={toggleInMultiSelect}
                onExitFormatTool={exitFormatTool}
                onSetTextAlign={setTextAlignSelected}
                onFollowLink={followLink}
                onOpenComments={openComments}
                // An action note's marker opens its action, or for an Editor the Assign Action dialog while none is
                // assigned (docs/specs/007-editor/article-pages.md "Comments and actions"), as a click on its text does.
                onOpenAction={isReadOnly ? openActionPopover : openAssignAction}
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
                // One gesture, one answer: while the element menu is open the
                // quick-connect pluses stand down (see deriveCanvasSelection).
                elementMenuOpen={contextMenu?.mode === 'element'}
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
              {documentId !== null && (
                <ItemWebhooksDialog
                  open={webhooksOpen}
                  onClose={() => setWebhooksOpen(false)}
                  itemId={documentId}
                  app="livedocuments"
                  title={documentName}
                  shareCode={sessionShareCode}
                />
              )}
            </PresentingProvider>
          </SuppressElementIndicators>
        </BuildStepsProvider>
      </TagColoursProvider>
    </CanvasThemeProvider>
  );
}
