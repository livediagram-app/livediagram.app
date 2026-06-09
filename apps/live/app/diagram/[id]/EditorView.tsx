'use client';

import dynamic from 'next/dynamic';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR, isBoxed } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { getTheme, type ThemeId } from '@/lib/themes';
import { apiAddComment, apiDeleteComment } from '@/lib/api-client';
import type { UserPreferences } from '@/lib/user-preferences';
import { Canvas } from '@/components/Canvas';
import { EditorHeader } from '@/components/EditorHeader';
import { TabBar } from '@/components/TabBar';
import { deriveTabLoadState } from './editor-page-helpers';
import { useEditorContext } from './EditorContext';

const EditorContextMenu = dynamic(() =>
  import('@/components/EditorContextMenu').then((m) => m.EditorContextMenu),
);
const TabLinkPicker = dynamic(() =>
  import('@/components/TabLinkPicker').then((m) => m.TabLinkPicker),
);
const CommentThreadPopover = dynamic(() =>
  import('@/components/CommentThreadPopover').then((m) => m.CommentThreadPopover),
);
const ExportTabDialog = dynamic(() =>
  import('@/components/ExportTabDialog').then((m) => m.ExportTabDialog),
);
const ImportTabDialog = dynamic(() =>
  import('@/components/ImportTabDialog').then((m) => m.ImportTabDialog),
);
const ShareDialog = dynamic(() => import('@/components/ShareDialog').then((m) => m.ShareDialog));
const NotePopover = dynamic(() => import('@/components/NotePopover').then((m) => m.NotePopover));
const SearchPanel = dynamic(() => import('@/components/SearchPanel').then((m) => m.SearchPanel));
const ImagePicker = dynamic(() => import('@/components/ImagePicker').then((m) => m.ImagePicker));
const ShortcutsDialog = dynamic(() =>
  import('@/components/ShortcutsDialog').then((m) => m.ShortcutsDialog),
);
const SettingsDialog = dynamic(() =>
  import('@/components/SettingsDialog').then((m) => m.SettingsDialog),
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
    activeTabLocked,
    activityMinimized,
    activityPosition,
    addArrow,
    addComment,
    addImage,
    addImageFromGallery,
    addIcon,
    dropIconOnElement,
    removeIconFromElement,
    addShape,
    addSticky,
    addTable,
    addTab,
    addText,
    aiCapable,
    aiPanelPosition,
    aiPanelVisible,
    anyWelcomeOpen,
    applyAiElements,
    applyImageToElement,
    autoAlignTab,
    beginAnchorDrag,
    beginArrowCurveDrag,
    beginArrowElbowDrag,
    beginArrowTranslate,
    beginDrag,
    beginEdit,
    beginEndpointDrag,
    beginFormatPainter,
    beginFreehand,
    beginGroup,
    beginRotate,
    bringSelectedToFront,
    broadcastCursor,
    broadcastLaser,
    cancelDrawShape,
    cancelEdit,
    canRedo,
    canUndo,
    canvasMainRef,
    canvasTool,
    changeLog,
    changeLogLoading,
    chooseTemplate,
    clearActivityForActiveTab,
    clearLinkSelected,
    clearTabContent,
    clerkDisplayName,
    clerkUserId,
    closeComments,
    closeContextMenu,
    closeImagePicker,
    closeNote,
    commentRows,
    commentsPanelPosition,
    commentThreadOpenId,
    commitDraw,
    commitFreehand,
    commitLabel,
    commitTable,
    contextMenu,
    contextPosition,
    copying,
    createFolder,
    createShareLink,
    deleteComment,
    deleteDiagram,
    deleteFolder,
    deleteMultiSelected,
    deleteSelected,
    deleteTab,
    diagramId,
    diagramList,
    diagramListLoading,
    diagramName,
    diagramOwnerColor,
    diagramOwnerId,
    diagramOwnerName,
    diagramShareable,
    dismissSharedDiagram,
    duplicateConnectSelected,
    duplicateDiagram,
    duplicateMultiSelected,
    duplicateSelected,
    duplicateTab,
    editCursorAtEnd,
    editingId,
    editorExpandSignal,
    effectiveTemplatePickerMode,
    exitFormatPainter,
    exitGroupMode,
    explorerPosition,
    exportOpen,
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
    imagePickerOpenFor,
    importError,
    importIntoActiveTab,
    importOpen,
    setImportOpen,
    isOwner,
    isPinchingRef,
    isReadOnly,
    laserTrailRows,
    linkActiveTabTo,
    linkPickerAnchorEl,
    linkPickerOpenForId,
    livePresence,
    loadedTabIds,
    makeCopy,
    moveDiagramToFolder,
    multiSelectedIds,
    nameConfirmed,
    newDiagram,
    noteOpenId,
    openComments,
    openDiagram,
    openNote,
    openTabAccordion,
    openTemplatePicker,
    palettePosition,
    participantsByTab,
    pendingDraw,
    redo,
    refreshRecentImages,
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
    resetElementsToTheme,
    resolveThread,
    retryActiveTabLoad,
    revertChange,
    revokeShareLink,
    savedAt,
    saveStatus,
    searchOpen,
    selectedId,
    selectElement,
    selectMarquee,
    selfParticipant,
    sendSelectedToBack,
    sessionRole,
    sessionShareCode,
    setActiveId,
    setActivityMinimized,
    setActivityPosition,
    setAiPanelPosition,
    setArrowEndsSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    setTableHeaderFillSelected,
    setTableHeaderTextColorSelected,
    setArrowStrokeStyleSelected,
    setArrowStyleSelected,
    setArrowThicknessSelected,
    setBackgroundColor,
    setBackgroundOpacity,
    setBackgroundPattern,
    setBorderRadiusSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setCanvasTool,
    setCommentsPanelPosition,
    setContextMenu,
    setContextPosition,
    setDiagramLinkSelected,
    setDiagramName,
    setDiagramSharePassword,
    setEditingId,
    setExplorerPosition,
    setExportOpen,
    setFillColorSelected,
    setFormatSourceId,
    setGroupSourceId,
    setLinkPickerOpenForId,
    setLinkSelected,
    setMultiSelectedIds,
    setNote,
    setOpacitySelected,
    setPaddingSelected,
    setPalettePosition,
    setPatternColor,
    setSearchOpen,
    setSelectedId,
    setSettingsOpen,
    setShapeKindSelected,
    setShareDialogOpen,
    setShortcutsEnabled,
    setShortcutsOpen,
    setStrokeColorSelected,
    setTabAccordionsOpen,
    setTextAlignSelected,
    setFontSelected,
    setTextColorSelected,
    setTextSizeSelected,
    setTabFont,
    setTabDefaultTextSize,
    setTheme,
    settingsOpen,
    setUserPreferences,
    setViewportOffset,
    setViewportZoom,
    sharedDiagrams,
    shareDialogOpen,
    shareLinks,
    sharePassword,
    shareUrlFor,
    shortcutsEnabled,
    shortcutsOpen,
    skipTemplatePicker,
    snapGuides,
    distGuides,
    tabAccordionsOpen,
    tabLoadErrors,
    tabs,
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
    unresolveThread,
    updateParticipantName,
    userPreferences,
    viewportOffset,
    viewportZoom,
    writeUserPreferences,
  } = ctx;
  // Lazy per-tab load gate (spec/13): show a blocking loader / error
  // over the canvas while the active tab's content is still being
  // fetched, so the user never edits a blank placeholder whose autosave
  // would overwrite the real server row.
  const tabLoadState = deriveTabLoadState({
    hydrated,
    hasDiagram: !!diagramId,
    loaded: loadedTabIds.has(activeId),
    errored: tabLoadErrors.has(activeId),
    elementsLength: activeTab.elements.length,
    templateChosen: activeTab.templateChosen === true,
  });
  return (
    <div className="flex h-dvh flex-col">
      {/* Zen / focus mode (spec/26) hides the header entirely so the
          canvas gets the full height. */}
      {zenMode ? null : (
        <EditorHeader
          diagramName={diagramName}
          hideTitle={anyWelcomeOpen}
          showShare={isOwner && hydrated && !anyWelcomeOpen}
          shareable={diagramShareable}
          // Visitors see "Make a copy" instead of "Share": same slot,
          // different action. Hidden during the welcome flow so the
          // first-paint chrome stays minimal, and during hydration so
          // we don't render the button before we know whether the user
          // is the owner.
          onMakeCopy={!isOwner && hydrated && !anyWelcomeOpen && diagramId ? makeCopy : undefined}
          copying={copying}
          readOnly={isReadOnly}
          brandAccent={getTheme(activeTab.theme).elementStroke ?? undefined}
          onOpenShare={() => {
            setShareDialogOpen(true);
            track('UI', 'Opened', 'Share');
          }}
          onRename={(next) => {
            const prev = diagramName.trim();
            const nextTrim = next.trim();
            setDiagramName(next);
            if (nextTrim && nextTrim !== prev) track('Diagram', 'Renamed');
          }}
        />
      )}
      {exportOpen ? (
        <ExportTabDialog
          tab={activeTab}
          diagramName={diagramName}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
      {importOpen ? (
        <ImportTabDialog
          tabName={activeTab.name}
          onImport={importIntoActiveTab}
          onClose={() => setImportOpen(false)}
        />
      ) : null}
      {shareDialogOpen ? (
        <ShareDialog
          participant={selfParticipant}
          links={shareLinks}
          sharePassword={sharePassword}
          shareUrlFor={shareUrlFor}
          nameConfirmed={nameConfirmed}
          // Signed-in via Clerk → name is locked to the account
          // display name (same rule as the welcome modal, spec/04).
          // Guests pass undefined so the input + shuffle stay live.
          lockedName={clerkUserId ? clerkDisplayName : null}
          onSaveName={updateParticipantName}
          onCreateLink={createShareLink}
          onRevokeLink={revokeShareLink}
          onSetPassword={setDiagramSharePassword}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
      <Canvas
        tabName={activeTab.name}
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
        tabPatternColor={activeTab.patternColor ?? DEFAULT_PATTERN_COLOR}
        tabFont={activeTab.font}
        tabDefaultTextSize={activeTab.defaultTextSize}
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
        selectedId={selectedId}
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
        onDuplicateMultiSelected={duplicateMultiSelected}
        onDeleteMultiSelected={deleteMultiSelected}
        onGroupMultiSelected={groupMultiSelected}
        onToggleLockMultiSelected={toggleLockMultiSelected}
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
        onDropIcon={isReadOnly ? undefined : dropIconOnElement}
        onAddTable={addTable}
        onAddText={addText}
        onAddSticky={addSticky}
        onAddImage={addImage}
        onAddArrow={addArrow}
        onBeginFreehand={beginFreehand}
        pendingDraw={pendingDraw}
        onCommitDraw={commitDraw}
        onCommitFreehand={commitFreehand}
        recogniseShapes={userPreferences.recogniseShapes === true}
        minimalPanels={userPreferences.minimalPanels === true}
        onToggleRecogniseShapes={() => {
          const next: UserPreferences = {
            ...userPreferences,
            recogniseShapes: userPreferences.recogniseShapes !== true,
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
        onDismissShared={dismissSharedDiagram}
        onOpenFullExplorer={() => window.location.assign(`${window.location.origin}/live/explorer`)}
        diagramListLoading={diagramListLoading}
        changeLog={changeLog.filter((entry) => entry.tabId === activeId)}
        changeLogLoading={changeLogLoading}
        activityPosition={activityPosition}
        activityMinimized={activityMinimized}
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
        contextPosition={contextPosition}
        tabAccordionsOpen={tabAccordionsOpen}
        setTabAccordionsOpen={setTabAccordionsOpen}
        editorExpandSignal={editorExpandSignal}
        onMoveContext={(x, y) => setContextPosition({ x, y })}
        onResetContext={() => setContextPosition(null)}
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
          if (nextTrim && nextTrim !== prev) track('Diagram', 'Renamed');
        }}
        onDeleteDiagram={deleteDiagram}
        onDuplicateDiagram={(id) => void duplicateDiagram(id)}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onMoveDiagramToFolder={moveDiagramToFolder}
        onDeselect={() => {
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
        onOpenElementContextMenu={
          isReadOnly
            ? undefined
            : (id, sx, sy) => setContextMenu({ mode: 'element', elementId: id, x: sx, y: sy })
        }
        onCanvasContextMenu={
          isReadOnly ? undefined : (sx, sy) => setContextMenu({ mode: 'canvas', x: sx, y: sy })
        }
        onBeginDrag={beginDrag}
        onBeginRotate={beginRotate}
        onBeginAnchorDrag={beginAnchorDrag}
        onBeginEdit={beginEdit}
        onCommitLabel={commitLabel}
        onCommitTable={commitTable}
        onCancelEdit={cancelEdit}
        onBeginEndpointDrag={beginEndpointDrag}
        onBeginArrowTranslate={beginArrowTranslate}
        onBeginArrowCurveDrag={beginArrowCurveDrag}
        onBeginArrowElbowDrag={beginArrowElbowDrag}
        onShiftSelect={toggleInMultiSelect}
        onBeginFormatPainter={beginFormatPainter}
        onCancelFormatPainter={exitFormatPainter}
        onBeginGroup={beginGroup}
        onCancelGroup={exitGroupMode}
        onUngroup={ungroupSelected}
        onBringToFront={bringSelectedToFront}
        onSendToBack={sendSelectedToBack}
        onSetTextSize={setTextSizeSelected}
        onSetTextAlign={setTextAlignSelected}
        onToggleTextBold={() => toggleTextStyleSelected('textBold')}
        onToggleTextItalic={() => toggleTextStyleSelected('textItalic')}
        onToggleTextUnderline={() => toggleTextStyleSelected('textUnderline')}
        onToggleTextStrikethrough={() => toggleTextStyleSelected('textStrikethrough')}
        onSetFont={setFontSelected}
        onSetFillColor={setFillColorSelected}
        onSetStrokeColor={setStrokeColorSelected}
        onSetTextColor={setTextColorSelected}
        onSetOpacity={setOpacitySelected}
        onResetColors={resetColorsSelected}
        onSetPadding={setPaddingSelected}
        onSetArrowEnds={setArrowEndsSelected}
        onSetArrowThickness={setArrowThicknessSelected}
        onSetArrowheadSize={setArrowheadSizeSelected}
        onSetArrowheadShape={setArrowheadShapeSelected}
        onToggleTableHeaderRow={setTableHeaderRowSelected}
        onToggleTableHeaderColumn={setTableHeaderColumnSelected}
        onToggleTableZebra={setTableZebraSelected}
        onSetTableHeaderFill={setTableHeaderFillSelected}
        onSetTableHeaderTextColor={setTableHeaderTextColorSelected}
        onSetArrowStyle={setArrowStyleSelected}
        onSetArrowStrokeStyle={setArrowStrokeStyleSelected}
        onSetShapeKind={setShapeKindSelected}
        onSetBorderStroke={setBorderStrokeSelected}
        onSetBorderStyle={setBorderStyleSelected}
        onSetBorderRadius={setBorderRadiusSelected}
        onFollowLink={followLink}
        onOpenComments={openComments}
        onOpenNote={openNote}
        imageContext={imageContext}
        showTemplatePicker={
          // The identity / join card (name entry) shows for EVERYONE
          // including view-role visitors: it only writes their own
          // participant row, so there's no 403, and they should set a
          // name before others see them in presence.
          identityOnlyScreenOpen ||
          // The template-CHOOSING variant stays editor-only: a viewer
          // can't commit a template (every write 403s), so it'd be a
          // dead-end. Wait for the active tab's content to land first,
          // or the empty-elements / templateChosen-unset placeholder
          // briefly trips the gate after hydration and flashes "pick a
          // template" before the real content pops in. `loadedTabIds
          // .has(activeId)` flips true once the lazy fetch resolves.
          (!isReadOnly &&
            hydrated &&
            loadedTabIds.has(activeId) &&
            activeTab.elements.length === 0 &&
            activeTab.templateChosen !== true)
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
        onSetTheme={setTheme}
        onSetTabFont={setTabFont}
        onSetTabDefaultTextSize={setTabDefaultTextSize}
        onResetElementsToTheme={resetElementsToTheme}
        importError={importError}
        onAutoAlign={hydrated && !anyWelcomeOpen && !isReadOnly ? autoAlignTab : undefined}
        canAutoAlign={activeTab.elements.length > 0 && !activeTabLocked}
        imageDiagramId={!isReadOnly && diagramId ? diagramId : undefined}
        imageShareCode={sessionShareCode}
        onAddImageFromGallery={!isReadOnly && diagramId ? addImageFromGallery : undefined}
        onSetBackgroundPattern={setBackgroundPattern}
        onSetBackgroundColor={setBackgroundColor}
        onSetBackgroundOpacity={setBackgroundOpacity}
        onSetPatternColor={setPatternColor}
        onToggleAspectLock={toggleAspectLockSelected}
        onDuplicateConnect={duplicateConnectSelected}
        onToggleLockSelected={toggleLockSelected}
        onDeleteSelected={deleteSelected}
        onDuplicateSelected={duplicateSelected}
        onCanvasDoubleClick={handleCanvasDoubleClick}
        tabLoadState={tabLoadState}
        onRetryTabLoad={retryActiveTabLoad}
        zenMode={zenMode}
        onToggleZen={toggleZenMode}
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
              }
            : undefined
        }
      />
      {anyWelcomeOpen || zenMode ? null : (
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
          onExportTab={() => setExportOpen(true)}
          otherDiagrams={diagramList.filter((d) => d.id !== diagramId)}
          onCopyTabTo={linkActiveTabTo}
          onToggleLockTab={toggleActiveTabLock}
          onReorder={reorderTabs}
          readOnly={isReadOnly}
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
          onOpenSearch={() => setSearchOpen(true)}
        />
      )}
      {searchOpen ? (
        <SearchPanel
          diagrams={diagramList.map((d) => ({ id: d.id, name: d.name }))}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
          tabs={tabs}
          currentTabId={activeId}
          onSelectDiagram={(id) => {
            openDiagram(id);
          }}
          onSelectTab={(tabId) => {
            setActiveId(tabId);
            setSelectedId(null);
          }}
          onSelectElement={(tabId, elementId) => {
            setActiveId(tabId);
            setSelectedId(elementId);
          }}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
      {shortcutsOpen ? (
        <ShortcutsDialog
          enabled={shortcutsEnabled}
          onToggleEnabled={setShortcutsEnabled}
          onClose={() => setShortcutsOpen(false)}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsDialog
          settings={userPreferences}
          onChange={(next) => {
            setUserPreferences(next);
            // Pass the resolved owner id so the new prefs round-trip
            // to D1 (spec/20). selfParticipant?.id is null until the
            // identity effect resolves it, but settingsOpen can't be
            // true until the user clicks the gear, which only renders
            // after that effect ran, so the id is always set here.
            writeUserPreferences(next, selfParticipant?.id ?? null);
          }}
          onClose={() => setSettingsOpen(false)}
          aiCapable={aiCapable}
        />
      ) : null}
      {commentThreadOpenId !== null
        ? (() => {
            const target = activeTab.elements.find(
              (el) => el.id === commentThreadOpenId && isBoxed(el),
            );
            if (!target || !isBoxed(target)) return null;
            return (
              <CommentThreadPopover
                elementId={target.id}
                thread={target.commentThread}
                onAddComment={(text) => {
                  addComment(target.id, text);
                  track('Comment', 'Added');
                  // View-role visitors don't autosave the tab, so
                  // their addComment via the local commit alone
                  // would vanish on refresh. Persist via the
                  // dedicated POST /tabs/<id>/comments endpoint
                  // (the only write path open to view-role) so the
                  // viewer's contribution lives in D1 like an
                  // owner / editor's would.
                  if (isReadOnly && diagramId) {
                    void apiAddComment(
                      selfParticipant.id,
                      diagramId,
                      activeTab.id,
                      target.id,
                      text,
                      sessionShareCode,
                    ).catch(() => {});
                  }
                }}
                onDeleteComment={(cid) => {
                  deleteComment(target.id, cid);
                  track('Comment', 'Deleted');
                  // View-role visitors don't autosave the tab, so the
                  // local delete alone would resurrect on refresh.
                  // Persist via the dedicated DELETE endpoint (the
                  // server re-checks authorId === caller, so a viewer
                  // can only land their own deletes). Owners / editors
                  // persist via the normal tab autosave.
                  if (isReadOnly && diagramId) {
                    void apiDeleteComment(
                      selfParticipant.id,
                      diagramId,
                      activeTab.id,
                      cid,
                      sessionShareCode,
                    ).catch(() => {});
                  }
                }}
                onResolve={() => {
                  resolveThread(target.id);
                  track('Comment', 'Resolved');
                }}
                onUnresolve={() => {
                  unresolveThread(target.id);
                  track('Comment', 'Unresolved');
                }}
                onClose={closeComments}
                readOnly={isReadOnly}
                selfId={selfParticipant.id}
              />
            );
          })()
        : null}
      {noteOpenId !== null
        ? (() => {
            const target = activeTab.elements.find((el) => el.id === noteOpenId && isBoxed(el));
            if (!target || !isBoxed(target)) return null;
            return (
              <NotePopover
                elementId={target.id}
                initial={target.note ?? ''}
                readOnly={isReadOnly}
                onCommit={(next) => {
                  const prev = (target.note ?? '').trim();
                  const nextTrim = next.trim();
                  setNote(target.id, next);
                  if (prev === nextTrim) return;
                  if (!prev && nextTrim) track('Note', 'Added');
                  else if (prev && !nextTrim) track('Note', 'Deleted');
                  else track('Note', 'Changed');
                }}
                onClose={closeNote}
              />
            );
          })()
        : null}
      {contextMenu && !isReadOnly ? (
        <EditorContextMenu
          menu={contextMenu}
          elements={activeTab.elements}
          onClose={closeContextMenu}
          onLinkElement={setLinkPickerOpenForId}
          onRemoveIcon={removeIconFromElement}
          onBringToFront={bringSelectedToFront}
          onSendToBack={sendSelectedToBack}
          onOpenNote={openNote}
          onOpenComments={openComments}
          onChangeTheme={() => openTabAccordion('theme')}
          onChangeCanvas={() => openTabAccordion('canvas')}
          onAutoAlign={autoAlignTab}
          onAddShape={addShape}
          onAddSticky={addSticky}
        />
      ) : null}
      {linkPickerOpenForId !== null && linkPickerAnchorEl && !isReadOnly ? (
        <TabLinkPicker
          anchor={linkPickerAnchorEl}
          tabs={tabs}
          currentTabId={activeId}
          linkedTabId={(() => {
            const el = activeTab.elements.find((e) => e.id === linkPickerOpenForId);
            return el && el.link && el.link.kind === 'tab' ? el.link.tabId : null;
          })()}
          linkedDiagramId={(() => {
            const el = activeTab.elements.find((e) => e.id === linkPickerOpenForId);
            return el && el.link && el.link.kind === 'diagram' ? el.link.diagramId : null;
          })()}
          recentDiagrams={diagramList
            .filter((d) => d.id !== diagramId)
            .slice(0, 5)
            .map((d) => ({ id: d.id, name: d.name }))}
          onSelect={(tabId) => {
            setLinkSelected(tabId);
            setLinkPickerOpenForId(null);
            track('Element', 'Linked', 'Tab');
          }}
          onSelectDiagram={(d) => {
            setDiagramLinkSelected(d);
            setLinkPickerOpenForId(null);
            track('Element', 'Linked', 'Diagram');
          }}
          onClear={() => {
            clearLinkSelected();
            setLinkPickerOpenForId(null);
            track('Element', 'Unlinked');
          }}
          onClose={() => setLinkPickerOpenForId(null)}
        />
      ) : null}
      {imagePickerOpenFor && diagramId && !isReadOnly ? (
        <ImagePicker
          ownerId={selfParticipant.id}
          diagramId={diagramId}
          forElementId={imagePickerOpenFor.forElementId}
          currentImageId={(() => {
            const targetId = imagePickerOpenFor.forElementId;
            if (!targetId) return null;
            const el = activeTab.elements.find((e) => e.id === targetId);
            return el && isBoxed(el) && el.type === 'image' ? el.imageId : null;
          })()}
          onRemove={
            imagePickerOpenFor.forElementId
              ? () => removeImageFromElement(imagePickerOpenFor.forElementId!)
              : undefined
          }
          onSelect={(image) => {
            if (imagePickerOpenFor.forElementId) {
              applyImageToElement(imagePickerOpenFor.forElementId, image);
            } else {
              closeImagePicker();
            }
            // Refresh the Current Tab → Images accordion so the
            // just-uploaded image surfaces without a diagram reload.
            refreshRecentImages(selfParticipant.id);
          }}
          onClose={closeImagePicker}
        />
      ) : null}
    </div>
  );
}
