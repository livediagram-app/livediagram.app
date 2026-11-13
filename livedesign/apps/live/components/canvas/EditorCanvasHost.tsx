'use client';

import { TagColoursProvider } from '@/components/canvas/TagColoursContext';
import { usePointerNoteSetters } from '@/hooks/canvas/usePointerNoteSetters';
import { pastePointer } from '@liveworkspace/workbench/lib/canvas-pointer';
import { canvasSurface, PEN_INK } from '@livedesign/design';
import { createStockColourProjector, plainPaper } from '@/lib/stock-colour-projector';
import { usePageView } from '@/hooks/canvas/usePageView';
import { drawnArrowAsShown } from '@/lib/drawn-arrow-preview';
import { useCallback, useState } from 'react';
import { ItemWebhooksDialog } from '@liveworkspace/workbench/components/dialogs/ItemWebhooksDialog';
import { LockedElementMenu } from '@/components/canvas/LockedElementMenu';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { getTheme, themeChartPalette, themeViewMap, type ThemeId } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsLandscapePhone } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { InspectSessionContext } from '@/components/canvas/inspect/InspectSessionContext';
import { useInspectHost } from '@/components/canvas/inspect/useInspectHost';
import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { useTemplateStartOpen } from '@/components/start/useTemplateStartShown';
import { CanvasThemeProvider } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { ComponentFaceContext } from './component/component-face-context';
import { ComponentSessionBar } from './component/ComponentSessionBar';
import { useDeadPageBrush } from '@liveworkspace/workbench/hooks/editor/useDeadPageBrush';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';
import { NEVER } from './editor-canvas-host/inspect-gestures';
import { useMenuCanvasProps, type LockedMenuState } from './editor-canvas-host/useMenuCanvasProps';
import { usePanelCanvasProps } from './editor-canvas-host/usePanelCanvasProps';
import { useInsertCanvasProps } from './editor-canvas-host/useInsertCanvasProps';
import { useEditCanvasProps } from './editor-canvas-host/useEditCanvasProps';

// The Canvas element's wiring, lifted out of EditorView (which carried
// ~500 lines of prop plumbing for it). Reads everything straight from
// EditorContext (the same host pattern as EditorModals /
// EditorContextMenuHost) plus the handful of locals only the Canvas
// props consume (the quick-connect arrow starter, the memoised Explorer
// list props, the owner-badge resolution). The props themselves are built by
// concern in editor-canvas-host/: menus, panels, inserting and editing.
export function EditorCanvasHost() {
  const {
    activeTab,
    activeTabLoadState,
    activeTabLocked,
    commitElements,
    layerInertIds,
    laserConfig,
    anyWelcomeOpen,
    beginAnchorDrag,
    broadcastCursor,
    broadcastLaser,
    canvasPointerRef,
    canvasMainRef,
    canvasTool,
    confirmIdentity,
    cancelIdentity,
    accountDisplayName,
    accountUserId,
    styleNewElement,
    designId,
    designName,
    editingId,
    embedMode,
    workbenchMode,
    fitToScreen,
    formatSourceId,
    hydrated,
    sessionTabScope,
    identityOnlyScreenOpen,
    imageContext,
    isOwner,
    canShareDesign,
    setShareDialogOpen,
    releaseSelectionLock,
    isPinchingRef,
    isReadOnly,
    can,
    participating,
    laserTrailRows,
    livePresence,
    remoteCursorRows,
    remoteSelectionsByElement,
    retryActiveTabLoad,
    readSelection,
    selectMarquee,
    selfParticipant,
    sessionShareCode,
    followMe,
    setCanvasTool,
    setContextMenu,
    setFormatSourceId,
    setViewportOffset,
    setViewportZoom,
    shiftDupGhostIds,
    snapGuideStore,
    tabSummaries,
    toggleZenMode,
    userPreferences,
    zenMode,
    editorMode,
    pagesMode,
    loadedTabIds,
    componentLibrary,
    componentActions,
    componentSession,
  } = useEditorContext();
  // Inspect (docs/specs/007-editor/wireframe-pages.md "Inspect"): while it is on, a press only selects, for an
  // Editor too, so the canvas is handed a Viewer's gestures; the panel's export and link come from here.
  const inspecting = canvasTool === 'inspect';
  const inspectSession = useInspectHost({
    canvasTool,
    setCanvasTool,
    wireframeTab: pagesMode?.pages[0]?.kind === 'wireframe',
    ready: hydrated && loadedTabIds.has(activeTab.id),
    activeTab,
    designId,
    designName,
    sessionShareCode,
    canShareDesign,
    openShare: () => setShareDialogOpen(true),
    imageContext,
  });
  // A pointer note's tip handle (docs/specs/009-elements/pointer-note.md).
  const { setPointerTip } = usePointerNoteSetters(commitElements, activeTab.elements);
  // Open, or about to open (its code still loading): either way the tab's first page waits. Closed for the tab (the
  // ×, an explicit blank), it is not open, and the page is drawn to ask its kind (start-diagramming.md "The first page").
  const templateStartOpen = useTemplateStartOpen();
  const startPanelOpen = useStartPanelOpen() || templateStartOpen;

  // The menu on an element somebody else is holding (docs/specs/007-editor/live-app.md).
  // Null when closed. Holders are captured at open time rather than re-read on
  // render: if the holder lets go while the menu is up it closes on the next
  // outside click anyway, and a list that emptied underneath would leave a
  // menu with nothing in it.
  const [lockedMenu, setLockedMenu] = useState<LockedMenuState | null>(null);
  // The canvas paints the backdrop the VIEWER resolves, not blindly the one
  // the tab stores: a tab on the Default theme follows this browser's
  // appearance (docs/specs/007-editor/live-app.md). Subscribing to the appearance here is what makes the
  // canvas repaint when it changes: resolveViewBackdrop would otherwise read a
  // module store nothing re-renders for.
  const { appearance } = useAppearance();
  const landscapePhone = useIsLandscapePhone();
  // A workspace frame's hooks: its Back, at the canvas's top left (WB59).
  const workbenchFrame = useWorkbenchSession()?.frame ?? null;
  const backdrop = resolveViewBackdrop(activeTab, appearance);
  // Stock colours stored by name are drawn in their version for this canvas, on every tab
  // (docs/specs/008-canvas/canvas-and-palette.md "Colours"). Display only: the projector
  // caches per element, so an unchanged element keeps its identity and the memoised views stay quiet.
  const [projectStockColours] = useState(createStockColourProjector);
  // The document's own Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): offered to a signed-in account that
  // edits the whole design (not a Viewer, a Participant or a one-tab link); the index checks again on every call.
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const canManageWebhooks =
    hydrated && Boolean(accountUserId) && !isReadOnly && !participating && sessionTabScope === null;
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in this viewer's half (docs/specs/011-theme/light-and-dark.md); the map is cached per theme and
  // appearance, so its identity holds and the projector's cache with it.
  const shownElements = activeTab.elements;
  // On a page with a fill of its own, an element is drawn for that page rather than the chrome
  // (stock-colour-projector.ts "PageView"); off Pages mode, or with no filled page, nothing to do.
  const pageView = usePageView(shownElements, pagesMode?.pages, activeTab.theme);
  const canvasElements = projectStockColours(
    shownElements,
    surface,
    themeViewMap(activeTab.theme, appearance),
    // Labels are re-inked against the plain paper (docs/specs/011-theme/light-and-dark.md "A theme never sinks a
    // label into what is behind it"): its words are made on white, the paper as stored and printed, and the dark
    // editor draws it slate, where a template's dark words (a wireframe's heading, a logo's wordmark) would vanish.
    plainPaper(surface),
    pageView,
  );
  // Lazy per-tab load gate (docs/specs/006-design/per-tab-storage.md): show a blocking loader / error over
  // the canvas while the active tab's content is still being fetched, so
  // the user never edits a blank placeholder whose autosave would
  // overwrite the real server row. Derived once in useEditorState (it also
  // gates editsBlocked there, so the pointer overlay and the edit lock
  // can't disagree); consumed here for the overlay.
  const tabLoadState = activeTabLoadState;
  // Quick add + connect Arrow starter (docs/specs/008-canvas/canvas-and-palette.md): see useQuickConnectStart.
  const { handleStartArrow } = useQuickConnectStart({ readSelection, beginAnchorDrag });

  // While a label is being edited, ride the element context menu alongside
  // the editor (docs/specs/008-canvas/canvas-and-palette.md): see useEditModeContextMenu.
  useEditModeContextMenu({
    editingId,
    elements: activeTab.elements,
    isReadOnly,
    setContextMenu,
  });

  // A page's background in the brush (docs/specs/007-editor/pages-mode.md "Copying a background").
  useDeadPageBrush(
    formatSourceId,
    pagesMode?.pages.map((pg) => pg.id),
    setFormatSourceId,
  );

  const activeTheme = getTheme(activeTab.theme);
  // Instances (docs/specs/009-elements/components.md "How an instance draws"): the library and the tab's look.
  const { font, finish, theme } = activeTab;
  const { lookup: componentLookup, loaded: componentsLoaded } = componentLibrary;
  const paper = backdrop.backgroundColor;
  // Memoised by the React Compiler: a new value only when one of these changes.
  const componentFaces = {
    lookup: componentLookup,
    loaded: componentsLoaded,
    tab: { font, finish, theme },
    paper,
  };

  // This person's open edit session on the tab, and its Done (docs/specs/009-elements/components.md "Editing the main").
  const sessionInstance = componentSession.sessionInstanceId
    ? activeTab.elements.find((e) => e.id === componentSession.sessionInstanceId)
    : undefined;
  const sessionMain =
    sessionInstance?.type === 'shape' && sessionInstance.componentId
      ? componentLibrary.lookup(sessionInstance.componentId)
      : undefined;
  const sessionId = componentSession.sessionInstanceId;
  const finishSession = useCallback(() => {
    if (sessionId) componentActions.finishEdit(sessionId);
  }, [sessionId, componentActions]);

  const menuProps = useMenuCanvasProps({ setLockedMenu, canManageWebhooks, setWebhooksOpen });
  const panelProps = usePanelCanvasProps();
  const insertProps = useInsertCanvasProps({ handleStartArrow });
  const editProps = useEditCanvasProps({ setPointerTip, inspecting });

  return (
    // The tab's theme for faces that dress in it unstored (the image placeholder).
    <CanvasThemeProvider theme={activeTheme}>
      {/* The tab's tag colours (docs/specs/009-elements/tag-colours.md), for the cards that render them. */}
      <TagColoursProvider tab={activeTab}>
        <ComponentFaceContext.Provider value={componentFaces}>
          <InspectSessionContext.Provider value={inspectSession}>
            <Canvas
              {...menuProps}
              {...panelProps}
              {...insertProps}
              {...editProps}
              tabName={activeTab.name}
              tabSummaries={tabSummaries}
              activeTabId={activeTab.id}
              activeTabLoaded={loadedTabIds.has(activeTab.id)}
              tabLocked={activeTabLocked}
              readOnly={isReadOnly}
              participantPalette={participating && can.addContent}
              takePart={can.takePart}
              canMove={inspecting ? NEVER : can.move}
              canWriteText={inspecting ? NEVER : can.writeText}
              canResize={inspecting ? NEVER : can.resize}
              designName={designName}
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
              elements={canvasElements}
              projectElement={projectStockColours.one}
              tabLayers={activeTab.layers}
              editorMode={editorMode.mode}
              // No page while Start Making Pages is open (docs/specs/007-editor/start-diagramming.md "Start Making Pages"):
              // the tab's first page is drawn only once a template is picked or the panel closed, so nothing waits behind it.
              pagesMode={startPanelOpen || !pagesMode ? null : pagesMode}
              whiteboardInk={PEN_INK[surface]}
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
                  // Laser mode hides the cursor indicator on peer screens:
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
              settings={userPreferences}
              userPreferences={userPreferences}
              chartPalette={themeChartPalette(activeTheme)}
              imageContext={imageContext}
              // The visitor name prompt shows for EVERYONE, view-role visitors included: it only writes their own
              // participant row, so there's no 403, and they should set a name before others see them in presence.
              showIdentityPrompt={identityOnlyScreenOpen}
              hydrated={hydrated}
              // Visitor on someone else's design + signed in → lock the
              // identity input to their account name. Owner branch never
              // shows the identity prompt so `lockedName` is moot there;
              // pure guests pass null and keep the editable name field.
              identityLockedName={!isOwner && accountUserId ? accountDisplayName : null}
              welcomeOpen={anyWelcomeOpen}
              selfParticipant={selfParticipant}
              onConfirmIdentity={confirmIdentity}
              onCancelIdentity={cancelIdentity}
              tabThemeId={(activeTab.theme as ThemeId | undefined) ?? 'brand'}
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
              workbenchBack={workbenchFrame}
              onToggleZen={embedMode ? undefined : toggleZenMode}
            />
          </InspectSessionContext.Provider>
          {lockedMenu ? (
            <LockedElementMenu
              at={lockedMenu.at}
              holders={lockedMenu.holders}
              onRelease={(presenceId) => releaseSelectionLock(presenceId, lockedMenu.elementId)}
              onClose={() => setLockedMenu(null)}
            />
          ) : null}
          {sessionMain && componentSession.sessionInstanceId ? (
            <ComponentSessionBar
              name={sessionMain.name}
              nothingSelected={() => {
                const s = readSelection();
                return s.selectedId === null && s.multiSelectedIds.size === 0;
              }}
              onDone={finishSession}
            />
          ) : null}
        </ComponentFaceContext.Provider>
        {designId !== null && (
          <ItemWebhooksDialog
            open={webhooksOpen}
            onClose={() => setWebhooksOpen(false)}
            itemId={designId}
            app="livedesign"
            title={designName}
            shareCode={sessionShareCode}
          />
        )}
      </TagColoursProvider>
    </CanvasThemeProvider>
  );
}
