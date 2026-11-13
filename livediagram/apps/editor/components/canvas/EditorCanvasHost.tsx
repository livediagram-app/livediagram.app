'use client';

import { TagColoursProvider } from '@/components/canvas/TagColoursContext';
import { usePointerNoteSetters } from '@/hooks/canvas/usePointerNoteSetters';
import { sessionToolsForSurface } from '@/components/canvas/SessionClusterStrip';
import { SuppressElementIndicators } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { pastePointer } from '@liveworkspace/workbench/lib/canvas-pointer';
import { canvasSurface, DEFAULT_BACKGROUND_COLOR, PEN_INK } from '@livediagram/document';
import { createStockColourProjector } from '@/lib/stock-colour-projector';
import { drawnArrowAsShown } from '@/lib/drawn-arrow-preview';
import { useState } from 'react';
import { ItemWebhooksDialog } from '@liveworkspace/workbench/components/dialogs/ItemWebhooksDialog';
import { LockedElementMenu } from '@liveworkspace/workbench/components/canvas/LockedElementMenu';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { getTheme, themeChartPalette, themeViewMap, type ThemeId } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { readDrawPattern } from '@/lib/whiteboard-dock-prefs';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsLandscapePhone } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { useStableObject } from '@liveworkspace/workbench/hooks/ui/useStableObject';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSessionTools } from '@/components/chrome/useSessionTools';
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import type { LibraryShapeRef } from '@/lib/shape-library-dnd';
import { CanvasThemeProvider } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';
import { useHostCollab } from './editor-canvas-host/useHostCollab';
import { useSessionCanvasProps } from './editor-canvas-host/useSessionCanvasProps';
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
// concern in editor-canvas-host/: session, menus, panels, inserting and editing.
export function EditorCanvasHost() {
  const {
    activeTab,
    activeTabLoadState,
    activeTabLocked,
    commitElements,
    presentingElements,
    slideDeck,
    layerInertIds,
    laserConfig,
    photoImportAvailable,
    photoImportBlocked,
    openPhotoImport,
    photoDraft,
    insertLibraryShape,
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
    documentId,
    documentName,
    editingId,
    embedMode,
    workbenchMode,
    fitToScreen,
    hydrated,
    identityOnlyScreenOpen,
    imageContext,
    isOwner,
    facilitator,
    isPinchingRef,
    isReadOnly,
    can,
    participating,
    laserTrailRows,
    remoteCursorRows,
    remoteSelectionsByElement,
    retryActiveTabLoad,
    readSelection,
    selectMarquee,
    selfParticipant,
    sessionShareCode,
    sessionTabScope,
    tabs,
    setCanvasTool,
    setContextMenu,
    setViewportOffset,
    setViewportZoom,
    shiftDupGhostIds,
    snapGuideStore,
    tabSummaries,
    toggleZenMode,
    userPreferences,
    zenMode,
    whiteboardDock,
    editorMode,
    loadedTabIds,
  } = useEditorContext();
  // A pointer note's tip handle (docs/specs/009-elements/pointer-note.md).
  const { setPointerTip } = usePointerNoteSetters(commitElements, activeTab.elements);
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

  // Somebody else is running this session (docs/specs/012-collaboration/facilitator.md). The facilitator verbs
  // below fall away for everybody else, exactly as they do on a read-only
  // surface; the responses beside them stay, because answering is the point.
  const runBlocked = facilitator.sessionToolsBlocked;
  // The Session strip's tools (docs/specs/012-collaboration/session-tools.md "The Session strip").
  const sessionTools = useSessionTools();
  // The facilitator's menu on an element somebody else is holding (docs/specs/007-editor/editor-app.md).
  // Null when closed. Holders are captured at open time rather than re-read on
  // render: if the holder lets go while the menu is up it closes on the next
  // outside click anyway, and a list that emptied underneath would leave a
  // menu with nothing in it.
  const [lockedMenu, setLockedMenu] = useState<LockedMenuState | null>(null);
  // The canvas paints the backdrop the VIEWER resolves, not blindly the one
  // the tab stores: a tab on the Default theme follows this browser's
  // appearance (docs/specs/007-editor/editor-app.md). Subscribing to the appearance here is what makes the
  // canvas repaint when it changes: resolveViewBackdrop would otherwise read a
  // module store nothing re-renders for.
  const { appearance } = useAppearance();
  const landscapePhone = useIsLandscapePhone();
  // A workspace frame's hooks: its Back, at the canvas's top left (WB59).
  const workbenchFrame = useWorkbenchSession()?.frame ?? null;
  const backdrop = resolveViewBackdrop(
    activeTab,
    { mode: editorMode.mode, drawPattern: readDrawPattern(userPreferences) },
    appearance,
  );
  // Stock colours stored by name are drawn in their version for this canvas, on every tab and in
  // either mode (docs/specs/007-editor/editor-modes.md "One look"). Display only: the projector
  // caches per element, so an unchanged element keeps its identity and the memoised views stay quiet.
  const [projectStockColours] = useState(createStockColourProjector);
  // The document's own Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): offered to a signed-in account that
  // edits the whole canvas (not a Viewer, a Participant or a one-tab link); the index checks again on every call.
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const canManageWebhooks =
    hydrated && Boolean(accountUserId) && !isReadOnly && !participating && sessionTabScope === null;
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in this viewer's half (docs/specs/011-theme/light-and-dark.md); the map is cached per theme and
  // appearance, so its identity holds and the projector's cache with it.
  const shownElements = presentingElements ?? activeTab.elements;
  const canvasElements = projectStockColours(
    shownElements,
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
  // Quick add + connect Arrow starter (docs/specs/008-canvas/canvas-and-palette.md): see useQuickConnectStart.
  const { handleStartArrow } = useQuickConnectStart({ readSelection, beginAnchorDrag });

  // While a label is being edited, ride the element context menu alongside
  // the editor (docs/specs/008-canvas/canvas-and-palette.md): see useEditModeContextMenu.
  useEditModeContextMenu({
    editingId,
    elements: activeTab.elements,
    isReadOnly,
    whiteboard: drawMode,
    setContextMenu,
  });

  const collab = useHostCollab(runBlocked);
  // Object props the canvas boundary compares by identity (docs/specs/008-canvas/canvas-performance.md
  // "The canvas re-renders only for what it shows"): new only when their data changes.
  const esBoardControls = useStableObject({
    ...(photoImportAvailable
      ? {
          onImportPhoto: openPhotoImport,
          photoDisabled: photoImportBlocked,
          photoDisabledReason: photoDraft.draftOpen ? 'Finish the current draft first' : undefined,
        }
      : {}),
  });
  const stableSlideDeck = useStableObject(slideDeck);
  const activeTheme = getTheme(activeTab.theme);
  const sessionProps = useSessionCanvasProps({ runBlocked, sessionTools });
  const menuProps = useMenuCanvasProps({ setLockedMenu, canManageWebhooks, setWebhooksOpen });
  const panelProps = usePanelCanvasProps({ stableSlideDeck });
  const insertProps = useInsertCanvasProps({ esBoardControls, dropLibraryShape, handleStartArrow });
  const editProps = useEditCanvasProps({ setPointerTip });
  return (
    // The tab's theme for faces that dress in it unstored (the image placeholder).
    <CanvasThemeProvider theme={activeTheme}>
      {/* The tab's tag colours (docs/specs/009-elements/tag-colours.md), for the cards that render them. */}
      <TagColoursProvider tab={activeTab}>
        {/* Presenting shows the slide as the audience sees it: no indicators or lock badges on its elements
          (docs/specs/008-canvas/element-indicators.md "Unchanged"). */}
        <SuppressElementIndicators when={presentingElements != null}>
          <Canvas
            {...sessionProps}
            {...menuProps}
            {...panelProps}
            {...insertProps}
            {...editProps}
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
            canWriteText={can.writeText}
            canResize={can.resize}
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
              fitToScreen();
              track('Canvas', 'Zoomed', 'Fit');
            }}
            setViewportOffset={setViewportOffset}
            // Presenting (docs/specs/012-collaboration/presentation-mode.md) narrows the canvas to one slide's elements. The
            // real canvas still draws them: a slide has to respond to clicks and
            // carry live element state, and there is then exactly one thing that
            // knows how an element looks.
            elements={canvasElements}
            projectElement={projectStockColours.one}
            tabLayers={activeTab.layers}
            tabKind={activeTab.kind}
            editorMode={editorMode.mode}
            whiteboardDock={whiteboardDock.whiteboard ? whiteboardDock : undefined}
            whiteboardInk={PEN_INK[surface]}
            previewDrawnArrow={(intent, startX, startY, endX, endY) =>
              drawnArrowAsShown(intent, startX, startY, endX, endY, {
                elements: activeTab.elements,
                theme: activeTheme,
                whiteboard: drawMode,
                styleNewElement,
                surface,
              })
            }
            layerInertIds={layerInertIds}
            sessionTools={sessionToolsForSurface(sessionTools, embedMode)}
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
            collab={collab}
            settings={userPreferences}
            userPreferences={userPreferences}
            chartPalette={themeChartPalette(activeTheme)}
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
              app="livediagram"
              title={documentName}
              shareCode={sessionShareCode}
            />
          )}
        </SuppressElementIndicators>
      </TagColoursProvider>
    </CanvasThemeProvider>
  );
}
