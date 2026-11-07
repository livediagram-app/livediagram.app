'use client';

import { useCallback } from 'react';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { EMPTY_SELECTION, type Selection } from '@liveworkspace/workbench/lib/selection-store';
import dynamic from 'next/dynamic';
import { tagColoursOf } from '@livehuddle/document';
import { track } from '@/lib/telemetry';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useColourPalette } from '@/hooks/ui/useColourPalette';
import { getTheme, shapeColorPresets, tableColorPresets, themeChartPalette } from '@/lib/themes';

// Lazy like the other heavy editor chrome: the menu's chunk loads on the
// first right-click, not with the page.
const EditorContextMenu = dynamic(
  () => import('@/components/palette/EditorContextMenu').then((m) => m.EditorContextMenu),
  { ssr: false },
);

// A Participant's or Viewer's menu, loaded on its first right-click too.
const ReadOnlyElementMenuHost = dynamic(
  () => import('./ReadOnlyElementMenuHost').then((m) => m.ReadOnlyElementMenuHost),
  { ssr: false },
);

// The element / multi-selection context menu's wiring, lifted out of
// EditorView (which carried ~100 lines of prop plumbing for it). Reads
// everything straight from EditorContext — the same host pattern as
// EditorModals / EditorAnchoredPopovers — and resolves the selection
// member set the menu's multi variant acts on.
export function EditorContextMenuHost() {
  const {
    contextMenu,
    activeTab,
    isReadOnly,
    setTagColour,
    editingId,
    closeContextMenu,
    openLinkPicker,
    removeIconFromElement,
    imageContext,
    removeImageFromElement,
    applyElementLink,
    commitInlineIcon,
    previewInlineIcon,
    commitIconSize,
    previewIconSize,
    commitIconWeight,
    previewIconWeight,
    commitTextAlign,
    previewTextAlign,
    bringSelectedToFront,
    sendSelectedToBack,
    toggleAspectLockSelected,
    setOpacitySelected,
    setTextColorSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    previewTextColor,
    commitTextColor,
    previewFillColor,
    commitCodeTheme,
    previewCodeTheme,
    commitTablePreset,
    previewTablePreset,
    commitChartPalette,
    previewChartPalette,
    setLabelFillSelected,
    commitLabelFill,
    previewLabelFill,
    commitHeaderFill,
    previewHeaderFill,
    setHeaderFillSelected,
    setArrowheadColorSelected,
    commitArrowheadColor,
    previewArrowheadColor,
    commitFillColor,
    previewStrokeColor,
    commitStrokeColor,
    previewBorderStroke,
    commitBorderStroke,
    previewBorderStyle,
    commitBorderStyle,
    previewBorderRadius,
    commitBorderRadius,
    setShadowSelected,
    previewShadow,
    commitShadow,
    previewFinish,
    commitFinish,
    previewRotation,
    commitRotation,
    commitMarker,
    previewMarker,
    commitMarkerSize,
    previewMarkerSize,
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartValuesSelected,
    setChartAxisSelected,
    setChartRightAxisSelected,
    setChartLegendPositionSelected,
    setChartTypeSelected,
    setLineDataOpenForId,
    setCodeEditOpenForId,
    setCodeWrapSelected,
    setLegendItemsSelected,
    setChecklistItemsSelected,
    toggleChecklistItem,
    setWebRowsSelected,
    setHeroCaptionSelected,
    setChairFacingSelected,
    setRoomDoorSelected,
    setStageSelected,
    setScreenUrlSelected,
    setClockZonesSelected,
    setJukeboxSourceSelected,
    applyElementDelta,
    can,
    setPortalTargetSelected,
    setPortalNameSelected,
    createLinkedPortal,
    tabs,
    commitShapeColorPreset,
    previewShapeColorPreset,
    resetShapeStyleSelected,
    commitArrowPreset,
    previewArrowPreset,
    clearStylePreview,
    previewElementStyle,
    commitElementStyle,
    burstSelectedStyle,
    commitElements,
    resetArrowStyleSelected,
    commitSetAnimation,
    commitArrowFlow,
    commitIconAnimation,
    previewSetAnimation,
    previewArrowFlow,
    previewIconAnimation,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setSetAnimationSpeedSelected,
    setFlowSpeedSelected,
    setSetAnimationRepeatSelected,
    setIconAnimationRepeatSelected,
    setFlowRepeatSelected,
    resetColorsSelected,
    toggleTextStyleSelected,
    commitTextSize,
    previewTextSize,
    commitFont,
    previewFont,
    commitPadding,
    previewPadding,
    setArrowThicknessSelected,
    setArrowStyleSelected,
    setArrowStrokeStyleSelected,
    setArrowRouteBehindSelected,
    setArrowExactStartSelected,
    setLaneUprightTitleSelected,
    setArrowEndsSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    commitShapeKind,
    previewShapeKind,
    resetAspectRatioSelected,
    setSizeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    openNote,
    openComments,
    openAssignAction,
  } = useEditorContext();
  // The selection the menu acts on, read from the store while a menu is open: a closed menu never
  // renders for a selection change (docs/specs/008-canvas/blueprints/selection-store.md).
  const menuOpen = !!contextMenu && contextMenu.mode !== 'canvas' && !isReadOnly;
  const { selectedId, multiSelectedIds } = useSelectionOf(
    useCallback((sel: Selection) => (menuOpen ? sel : EMPTY_SELECTION), [menuOpen]),
  );

  const { swatches } = useColourPalette();

  // A Participant or a Viewer gets its own short menu, holding only what its role may do
  // (ReadOnlyElementMenuHost), so nothing below needs a second `isReadOnly` guard: everything past
  // this line is running for an editor by construction.
  if (isReadOnly) return contextMenu?.mode === 'element' ? <ReadOnlyElementMenuHost /> : null;
  if (!contextMenu || contextMenu.mode === 'canvas') return null;

  // Selection-context-menu member resolution (right-click a multi-selection):
  // the marquee set when one is active, else the clicked element.
  const ctxSelectedEl = selectedId
    ? (activeTab.elements.find((e) => e.id === selectedId) ?? null)
    : null;
  const ctxMemberIds =
    multiSelectedIds.size > 0 ? [...multiSelectedIds] : ctxSelectedEl ? [ctxSelectedEl.id] : [];
  // An Arcade Machine's Clear High Scores (docs/specs/009-elements/social-pieces.md "Clearing"): one delta, the room's
  // like a posted score, so nobody's undo brings the table back.
  const clearArcadeScores = (elementId: string) => {
    applyElementDelta(elementId, { kind: 'arcade-clear' });
    track('Element', 'Changed', 'Arcade-machine');
  };

  return (
    <EditorContextMenu
      // Remount when the menu changes target: a right-click on a DIFFERENT
      // element should read as a new menu — it closes and animates in at the
      // new sticky, rather than sliding across fully-formed. Re-targeting the
      // same element keeps the key (and the state object), so that case stays
      // a true no-op with no animation restart. The id only changes on the
      // right-button RELEASE, so the entrance never fires under a held button.
      key={contextMenu.mode === 'element' ? contextMenu.elementId : contextMenu.mode}
      menu={contextMenu}
      editingId={editingId}
      elements={activeTab.elements}
      tabFont={activeTab.font}
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
      onSetIconWeight={commitIconWeight}
      onPreviewIconWeight={previewIconWeight}
      onSetTextAlign={commitTextAlign}
      onPreviewTextAlign={previewTextAlign}
      onSetLaneUprightTitle={setLaneUprightTitleSelected}
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
      onSetArrowheadColor={setArrowheadColorSelected}
      onPreviewArrowheadColor={previewArrowheadColor}
      onCommitArrowheadColor={commitArrowheadColor}
      onSetLabelFill={setLabelFillSelected}
      onPreviewLabelFill={previewLabelFill}
      onCommitLabelFill={commitLabelFill}
      onSetHeaderFill={setHeaderFillSelected}
      onPreviewHeaderFill={previewHeaderFill}
      onCommitHeaderFill={commitHeaderFill}
      onPreviewStrokeColor={previewStrokeColor}
      onCommitStrokeColor={commitStrokeColor}
      onPreviewBorderStroke={previewBorderStroke}
      onCommitBorderStroke={commitBorderStroke}
      onPreviewBorderStyle={previewBorderStyle}
      onCommitBorderStyle={commitBorderStyle}
      onPreviewBorderRadius={previewBorderRadius}
      onCommitBorderRadius={commitBorderRadius}
      onSetShadow={setShadowSelected}
      onPreviewShadow={previewShadow}
      onCommitShadow={commitShadow}
      onPreviewFinish={previewFinish}
      onCommitFinish={commitFinish}
      onPreviewRotation={previewRotation}
      onCommitRotation={commitRotation}
      onSetMarker={commitMarker}
      onPreviewMarker={previewMarker}
      onSetMarkerSize={commitMarkerSize}
      onPreviewMarkerSize={previewMarkerSize}
      onSetRating={setRatingSelected}
      onSetRatingAnim={setRatingAnimSelected}
      onSetRatingAnimSpeed={setRatingAnimSpeedSelected}
      onSetRatingAnimRepeat={setRatingAnimRepeatSelected}
      onSetPieData={setPieDataSelected}
      onSetPieAnim={setPieAnimSelected}
      onSetPieAnimSpeed={setPieAnimSpeedSelected}
      onSetPieAnimRepeat={setPieAnimRepeatSelected}
      onSetChartLegend={setChartLegendSelected}
      onSetChartValues={setChartValuesSelected}
      onSetChartAxis={setChartAxisSelected}
      onSetChartRightAxis={setChartRightAxisSelected}
      onSetChartLegendPosition={setChartLegendPositionSelected}
      onSetChartType={setChartTypeSelected}
      onEditLineData={setLineDataOpenForId}
      onEditCodeBlock={setCodeEditOpenForId}
      onSetCodeWrap={setCodeWrapSelected}
      onSetLegendItems={setLegendItemsSelected}
      chartThemeRamp={themeChartPalette(getTheme(activeTab.theme))}
      onSetChecklistItems={setChecklistItemsSelected}
      onToggleChecklistItem={toggleChecklistItem}
      onSetWebRows={setWebRowsSelected}
      onSetHeroCaption={setHeroCaptionSelected}
      onSetChairFacing={setChairFacingSelected}
      onSetRoomDoor={setRoomDoorSelected}
      onSetStage={setStageSelected}
      onSetScreenUrl={setScreenUrlSelected}
      onSetClockZones={setClockZonesSelected}
      onSetJukeboxSource={setJukeboxSourceSelected}
      onClearArcadeScores={can.level === 'edit' ? clearArcadeScores : undefined}
      onSetPortalTarget={setPortalTargetSelected}
      onSetPortalName={setPortalNameSelected}
      onCreateLinkedPortal={createLinkedPortal}
      tabs={tabs}
      activeTabId={activeTab.id}
      shapeColorPresets={shapeColorPresets(getTheme(activeTab.theme))}
      onApplyShapeColorPreset={commitShapeColorPreset}
      onPreviewShapeColorPreset={previewShapeColorPreset}
      onResetShapeStyle={resetShapeStyleSelected}
      onApplyArrowPreset={commitArrowPreset}
      onPreviewArrowPreset={previewArrowPreset}
      onPreviewStyleEnd={clearStylePreview}
      elementStyle={{
        preview: (map) => previewElementStyle(map),
        end: clearStylePreview,
        commit: (map, telemetryType) => commitElementStyle(map, telemetryType),
        burst: burstSelectedStyle,
        commitTab: (map, telemetryType) => {
          commitElements(map);
          track('Element', 'Changed', telemetryType);
        },
      }}
      onApplyCodeTheme={commitCodeTheme}
      onPreviewCodeTheme={previewCodeTheme}
      tableColorPresets={tableColorPresets(getTheme(activeTab.theme))}
      onApplyTablePreset={commitTablePreset}
      onPreviewTablePreset={previewTablePreset}
      onApplyChartPalette={commitChartPalette}
      onPreviewChartPalette={previewChartPalette}
      onResetArrowStyle={resetArrowStyleSelected}
      onSetSetAnimation={commitSetAnimation}
      onSetArrowFlow={commitArrowFlow}
      onSetIconAnimation={commitIconAnimation}
      onPreviewSetAnimation={previewSetAnimation}
      onPreviewArrowFlow={previewArrowFlow}
      onPreviewIconAnimation={previewIconAnimation}
      onAnimationPreviewEnd={clearStylePreview}
      onSetIconAnimationSpeed={setIconAnimationSpeedSelected}
      onSetProgress={setProgressSelected}
      onSetProgressAnim={setProgressAnimSelected}
      onSetProgressAnimSpeed={setProgressAnimSpeedSelected}
      onSetProgressAnimRepeat={setProgressAnimRepeatSelected}
      onSetSetAnimationSpeed={setSetAnimationSpeedSelected}
      onSetFlowSpeed={setFlowSpeedSelected}
      onSetSetAnimationRepeat={setSetAnimationRepeatSelected}
      onSetIconAnimationRepeat={setIconAnimationRepeatSelected}
      onSetFlowRepeat={setFlowRepeatSelected}
      onResetColors={resetColorsSelected}
      onToggleTextBold={() => toggleTextStyleSelected('textBold')}
      onToggleTextItalic={() => toggleTextStyleSelected('textItalic')}
      onToggleTextUnderline={() => toggleTextStyleSelected('textUnderline')}
      onToggleTextStrikethrough={() => toggleTextStyleSelected('textStrikethrough')}
      onSetTextSize={commitTextSize}
      onPreviewTextSize={previewTextSize}
      onSetFont={commitFont}
      onPreviewFont={previewFont}
      onSetPadding={commitPadding}
      onPreviewPadding={previewPadding}
      onSetArrowThickness={setArrowThicknessSelected}
      onSetArrowStyle={setArrowStyleSelected}
      onSetArrowStrokeStyle={setArrowStrokeStyleSelected}
      onSetArrowRouteBehind={setArrowRouteBehindSelected}
      onSetArrowExactStart={setArrowExactStartSelected}
      onSetArrowEnds={setArrowEndsSelected}
      onSetArrowheadSize={setArrowheadSizeSelected}
      onSetArrowheadShape={setArrowheadShapeSelected}
      onSetShapeKind={commitShapeKind}
      onPreviewShapeKind={previewShapeKind}
      onResetAspectRatio={resetAspectRatioSelected}
      onSetSize={setSizeSelected}
      colourPalette={swatches}
      tagColours={tagColoursOf(activeTab)}
      onSetTagColour={setTagColour}
      onToggleTableHeaderRow={setTableHeaderRowSelected}
      onToggleTableHeaderColumn={setTableHeaderColumnSelected}
      onToggleTableZebra={setTableZebraSelected}
      onOpenNote={openNote}
      onOpenComments={openComments}
      onAssignAction={openAssignAction}
      selectionElements={ctxMemberIds
        .map((id) => activeTab.elements.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => e != null)}
    />
  );
}
