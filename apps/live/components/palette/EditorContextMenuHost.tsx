'use client';

import dynamic from 'next/dynamic';
import { resolveLayerId, selectionMembers } from '@livediagram/diagram';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { getTheme, shapeColorPresets, themePresetColors } from '@/lib/themes';

// Lazy like the other heavy editor chrome: the menu's chunk loads on the
// first right-click, not with the page.
const EditorContextMenu = dynamic(() =>
  import('@/components/palette/EditorContextMenu').then((m) => m.EditorContextMenu),
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
    selectedId,
    editingId,
    multiSelectedIds,
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
    commitTextAlign,
    previewTextAlign,
    bringSelectedToFront,
    sendSelectedToBack,
    layers,
    moveSelectedToLayer,
    toggleAspectLockSelected,
    setOpacitySelected,
    setTextColorSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    previewTextColor,
    commitTextColor,
    previewFillColor,
    commitFillColor,
    previewStrokeColor,
    commitStrokeColor,
    previewBorderStroke,
    commitBorderStroke,
    previewBorderStyle,
    commitBorderStyle,
    previewBorderRadius,
    commitBorderRadius,
    previewRotation,
    commitRotation,
    commitMarker,
    previewMarker,
    commitMarkerSize,
    previewMarkerSize,
    setRailCountSelected,
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
    commitShapeColorPreset,
    previewShapeColorPreset,
    resetShapeStyleSelected,
    commitArrowPreset,
    previewArrowPreset,
    clearStylePreview,
    resetArrowStyleSelected,
    commitAnimation,
    commitArrowFlow,
    commitIconAnimation,
    previewAnimation,
    previewArrowFlow,
    previewIconAnimation,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setAnimationSpeedSelected,
    setFlowSpeedSelected,
    setAnimationRepeatSelected,
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
    setArrowEndsSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    commitShapeKind,
    previewShapeKind,
    resetAspectRatioSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    openNote,
    openComments,
    openAssignAction,
  } = useEditorContext();

  if (!contextMenu || contextMenu.mode === 'canvas' || isReadOnly) return null;

  // Selection-context-menu member resolution (right-click a multi-selection
  // or group): the marquee set when one is active, else the clicked
  // element's group expansion.
  const ctxSelectedEl = selectedId
    ? (activeTab.elements.find((e) => e.id === selectedId) ?? null)
    : null;
  const ctxMemberIds =
    multiSelectedIds.size > 0
      ? [...multiSelectedIds]
      : ctxSelectedEl
        ? selectionMembers(activeTab.elements, ctxSelectedEl.id)
        : [];

  // The selection's layer for the Layer section's move-to dropdown
  // (spec/74): the single resolved layer every member shares, or null
  // when the selection spans layers.
  const ctxLayerIds = new Set(
    ctxMemberIds
      .map((id) => activeTab.elements.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => e != null)
      .map((el) => resolveLayerId(el.layerId, layers)),
  );
  const selectionLayerId = ctxLayerIds.size === 1 ? [...ctxLayerIds][0]! : null;

  return (
    <EditorContextMenu
      menu={contextMenu}
      editingId={editingId}
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
      layers={layers}
      selectionLayerId={selectionLayerId}
      onMoveSelectionToLayer={moveSelectedToLayer}
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
      onSetAnimationRepeat={setAnimationRepeatSelected}
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
      onAssignAction={openAssignAction}
      selectionElements={ctxMemberIds
        .map((id) => activeTab.elements.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => e != null)}
    />
  );
}
