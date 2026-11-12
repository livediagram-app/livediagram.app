'use client';

import { TagColoursProvider } from '@/components/canvas/TagColoursContext';
import { PlanTextScaleProvider } from '@/components/plan/PlanTextScaleContext';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { pastePointer } from '@liveworkspace/workbench/lib/canvas-pointer';
import { canvasSurface, DEFAULT_BACKGROUND_COLOR } from '@liveplanner/project';
import { createStockColourProjector } from '@/lib/stock-colour-projector';
import { useState } from 'react';
import { ItemWebhooksDialog } from '@liveworkspace/workbench/components/dialogs/ItemWebhooksDialog';
import { useElementMenuOpener } from '@/hooks/canvas/element-menu-opener';
import { useSheetChartMenuSelection } from '@/hooks/sheets/useSheetChartMenuSelection';
import { participantKey } from '@/lib/identity';
import { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { useEditModeContextMenu } from '@/hooks/canvas/useEditModeContextMenu';
import { track } from '@/lib/telemetry';
import { getTheme, themeChartPalette, themeViewMap, type ThemeId } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsLandscapePhone } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { Canvas } from '@/components/canvas/Canvas';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useSessionTools } from '@/components/chrome/useSessionTools';
import { useStableCollab } from '@/components/canvas/element-layer-props';
import { canEditSankey } from '@/lib/sankey-edit';
import { canEditSequence } from '@/lib/sequence-edit';
import { CanvasThemeProvider } from '@/components/canvas/CanvasSurfaceContext';
import { useCanvasMenuProps } from '@/components/canvas/useCanvasMenuProps';
import { useCanvasThreadProps } from '@/components/canvas/useCanvasThreadProps';
import { useCanvasSessionProps } from '@/components/canvas/useCanvasSessionProps';
import { useCanvasLayerProps } from '@/components/canvas/useCanvasLayerProps';

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
    beginArrowBend,
    beginArrowScale,
    dropBoardFile,
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
    beginEdit,
    beginEndpointDrag,
    broadcastCursor,
    canvasPointerRef,
    cancelEdit,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,
    confirmIdentity,
    cancelIdentity,
    accountDisplayName,
    accountUserId,
    commitLabel,
    deleteCurvePoint,
    deleteMultiSelected,
    deleteSelected,
    projectId,
    projectName,
    sessionTabScope,
    nameProject,
    duplicateMultiSelected,
    contextMenu,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    editCursorAtEnd,
    editingId,
    embedMode,
    workbenchMode,
    fitToScreen,
    followLink,
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
    lockedByOther,
    narrowMultiSelection,
    newProject,
    openActionPopover,
    openComments,
    openNote,
    redo,
    peerRows,
    remoteSelectionsByElement,
    retryActiveTabLoad,
    readSelection,
    selectElement,
    selectMarquee,
    selfParticipant,
    sessionShareCode,
    pressSessionButton,
    setSessionConfigFor,
    pickerFor,
    collabElements,
    tabs,
    setCanvasThemeTab,
    setContextMenu,
    setEditingId,
    setExportOpen,
    setExportScope,
    setCodeEditOpenForId,
    setSankeyFlowsOpenForId,
    setSequenceOpenForId,
    setLinkPickerOpenForId,
    setMultiSelectedIds,
    setSelectedId,
    setPageHeading,
    appendWebRowTo,
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
  // The canvas paints the backdrop the VIEWER resolves, not blindly the one
  // the tab stores: a tab on the Default theme follows this browser's
  // appearance (docs/specs/007-editor/editor-app.md). Subscribing to the appearance here is what makes the
  // canvas repaint when it changes — resolveViewBackdrop would otherwise read a
  // module store nothing re-renders for.
  const { appearance } = useAppearance();
  const landscapePhone = useIsLandscapePhone();
  // Double-click on an element with its own edit dialog (docs/specs/009-elements/code-block.md,
  // docs/specs/009-elements/sankey.md): which dialog depends on the kind.
  const openEditDialog = (id: string) => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape') return;
    if (el.shape === 'code-block') setCodeEditOpenForId(id);
    else if (el.shape === 'sankey' && canEditSankey(can, el)) setSankeyFlowsOpenForId(id);
    else if (el.shape === 'sequence' && canEditSequence(can, el)) setSequenceOpenForId(id);
  };
  const backdrop = resolveViewBackdrop(activeTab, appearance);
  // Stock colours stored by name are drawn in their version for this canvas, on every tab and in
  // either mode (docs/specs/007-editor/editor-modes.md "One look"). Display only: the projector
  // caches per element, so an unchanged element keeps its identity and the memoised views stay quiet.
  const [projectStockColours] = useState(createStockColourProjector);
  // The plan's own Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): offered to a signed-in account that
  // edits the whole plan (not a Viewer, a Participant or a one-tab link); the index checks again on every call.
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const canManageWebhooks =
    hydrated && Boolean(accountUserId) && !isReadOnly && !participating && sessionTabScope === null;
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
  // The Canvas's props by panel, each read from EditorContext beside its own code.
  const menuProps = useCanvasMenuProps();
  const threadProps = useCanvasThreadProps();
  const sessionProps = useCanvasSessionProps();
  const layersProps = useCanvasLayerProps();

  return (
    // The tab's theme for faces that dress in it unstored (the image placeholder).
    <CanvasThemeProvider theme={activeTheme}>
      {/* The tab's tag colours (docs/specs/009-elements/tag-colours.md), for the cards that render them. */}
      <TagColoursProvider tab={activeTab}>
        {/* The tab's Text Size, scaling its boards' and Plan cards' text (fonts.md "Text size on boards and cards"). */}
        <PlanTextScaleProvider size={activeTab.defaultTextSize}>
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
            projectElement={projectStockColours.one}
            shiftDupGhostIds={shiftDupGhostIds}
            snapGuideStore={snapGuideStore}
            remoteSelectionsByElement={remoteSelectionsByElement}
            peers={peerRows}
            onCanvasPointerMove={(x, y, target) => {
              canvasPointerRef.current = pastePointer(x, y, target ?? null);
              broadcastCursor(x !== null && y !== null ? { x, y } : null);
            }}
            onSelectMarquee={selectMarquee}
            canvasTool={canvasTool}
            // Session button (docs/specs/012-collaboration/session-button.md) / Picker (docs/specs/012-collaboration/picker.md):
            // see useBehaviourElements — the press resolves what to do from the
            // element and calls the tool that already exists.
            onPressSessionButton={pressSessionButton}
            sessionStartBlocked={isReadOnly}
            {...sessionProps}
            onSetSessionConfig={isReadOnly ? undefined : setSessionConfigFor}
            // The `…` on a Behaviours element's face (docs/specs/008-canvas/canvas-and-palette.md). Anchored from the
            // ELEMENT's rect, not the trigger's, so it lands exactly where a
            // right-click on the same element would — one menu, one position,
            // whichever way you asked for it.
            {...menuProps}
            {...threadProps}
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
            canUndo={canUndo && !activeTabLocked}
            canRedo={canRedo && !activeTabLocked}
            onDropFile={isReadOnly ? undefined : dropBoardFile}
            reshapingArrowId={reshapingArrowId}
            settings={userPreferences}
            onUndo={undo}
            onRedo={redo}
            sessionTools={sessionTools}
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
            {...layersProps}
            currentProjectId={projectId}
            currentShareCode={sessionShareCode}
            onRenameCurrentProject={nameProject}
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
              onWebhooks: canManageWebhooks ? () => setWebhooksOpen(true) : undefined,
              onSearch: () => openSearchWithPrefetch(setSearchOpen, loadAllTabs),
              onOpenSettings: () => {
                setSettingsOpen(true);
                track('UI', 'Opened', 'Settings');
              },
            }}
            onDeselect={() => {
              setSelectedId(null);
              setMultiSelectedIds(new Set());
              setEditingId(null);
              setContextMenu(null);
            }}
            onSelect={selectElement}
            onBeginDrag={beginDrag}
            onBeginEdit={beginEdit}
            onCommitLabel={commitLabel}
            onAddTableRow={appendTableRowSelected}
            onAddTableColumn={appendTableColumnSelected}
            onSetPageHeading={setPageHeading}
            onAppendWebRow={isReadOnly ? undefined : appendWebRowTo}
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
            onToggleZen={embedMode ? undefined : toggleZenMode}
          />
          {projectId !== null && (
            <ItemWebhooksDialog
              open={webhooksOpen}
              onClose={() => setWebhooksOpen(false)}
              itemId={projectId}
              app="liveplanner"
              title={projectName}
              shareCode={sessionShareCode}
            />
          )}
        </PlanTextScaleProvider>
      </TagColoursProvider>
    </CanvasThemeProvider>
  );
}
