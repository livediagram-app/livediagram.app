'use client';

import { useCallback } from 'react';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { EMPTY_SELECTION, type Selection } from '@/lib/selection-store';
import dynamic from 'next/dynamic';
import {
  DEFAULT_MIND_FLOW,
  DEFAULT_MIND_SPACING,
  isMindNode,
  logoPageAt,
  mindFlowOf,
  mindRootOf,
  mindSpacingOf,
  resolveLayerId,
  withMindBranches,
  type ShapeElement,
  flowchartDirectionOf,
  flowchartStepTypeOf,
  isFlowchartLane,
  isFlowchartStep,
  tagColoursOf,
} from '@liveplanner/document';
import type { FlowchartMenuHandlers } from '@/components/flowchart/FlowchartMenuSections';
import { track } from '@/lib/telemetry';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useColourPalette } from '@/hooks/ui/useColourPalette';
import { getTheme, shapeColorPresets, tableColorPresets, themeChartPalette } from '@/lib/themes';
import { canEditSankey } from '@/lib/sankey-edit';
import { canEditSequence } from '@/lib/sequence-edit';
import { panelEnabled } from '@/lib/user-preferences';

// Lazy like the other heavy editor chrome: the menu's chunk loads on the
// first right-click, not with the page.
const EditorContextMenu = dynamic(
  () => import('@/components/palette/EditorContextMenu').then((m) => m.EditorContextMenu),
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
    userPreferences,
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
    copySelection,
    deleteSelected,
    setEsKindOf,
    createBlocked,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
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
    unlinkChartSelected,
    setLineDataOpenForId,
    setCodeEditOpenForId,
    setCodeWrapSelected,
    setLegendItemsSelected,
    sankey,
    setSankeyFlowsOpenForId,
    setSequenceOpenForId,
    can,
    setMindFlowSelected,
    setMindSpacingSelected,
    flowchartActions,
    selectMarquee,
    tidyMindMapSelected,
    mindOutline,
    setChecklistItemsSelected,
    toggleChecklistItem,
    setEntityFieldsSelected,
    setWebRowsSelected,
    setHeroCaptionSelected,
    setDecisionStatusSelected,
    setDecisionDateSelected,
    setDecisionDriversSelected,
    setPortalTargetSelected,
    setPortalNameSelected,
    createLinkedPortal,
    setSessionConfigSelected,
    setPickerSourceSelected,
    setPickerOptionsSelected,
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
    commitWordmark,
    previewWordmark,
    pagesMode,
    canCombine,
    combineSelected,
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

  // A view-only session never gets an element context menu at all, so
  // nothing below needs a second `isReadOnly` guard — everything past
  // this line is running for an editor by construction.
  if (!contextMenu || contextMenu.mode === 'canvas' || isReadOnly) return null;

  // Selection-context-menu member resolution (right-click a multi-selection):
  // the marquee set when one is active, else the clicked element.
  const ctxSelectedEl = selectedId
    ? (activeTab.elements.find((e) => e.id === selectedId) ?? null)
    : null;
  const ctxMemberIds =
    multiSelectedIds.size > 0 ? [...multiSelectedIds] : ctxSelectedEl ? [ctxSelectedEl.id] : [];

  // A Sankey's menu sections (docs/specs/009-elements/sankey.md "The menu"), for someone who may edit it.
  const sankeyMenu =
    ctxSelectedEl?.type === 'shape' &&
    ctxSelectedEl.shape === 'sankey' &&
    canEditSankey(can, ctxSelectedEl)
      ? {
          palette: themeChartPalette(getTheme(activeTab.theme)),
          onEditFlows: setSankeyFlowsOpenForId,
          onSetNodeColor: sankey.setSankeyNodeColorSelected,
          onSetOption: sankey.setSankeyOptionSelected,
        }
      : undefined;

  // The Flowchart section (docs/specs/009-elements/flowchart.md): on a step or a chart's lane, for an
  // Editor on an unlocked element; the step's type and its chart's direction resolved here.
  const flowchartMenu: FlowchartMenuHandlers | undefined =
    ctxSelectedEl &&
    (isFlowchartStep(ctxSelectedEl) || isFlowchartLane(ctxSelectedEl)) &&
    can.level === 'edit' &&
    ctxSelectedEl.locked !== true
      ? {
          stepType: isFlowchartStep(ctxSelectedEl)
            ? flowchartStepTypeOf(ctxSelectedEl.shape)
            : undefined,
          direction: flowchartDirectionOf(activeTab.elements, ctxSelectedEl.flowchartId!),
          onSetStepType: flowchartActions.setStepTypeSelected,
          onSetDirection: flowchartActions.setDirectionSelected,
          onAddLane: flowchartActions.addLaneSelected,
          onTidy: flowchartActions.tidySelected,
        }
      : undefined;

  // The flow the selected node's MAP grows in (docs/specs/009-elements/mind-node.md). Resolved here
  // because it lives on the tree's root, which the menu cannot walk to from
  // the node in hand.
  const menuMindNode = ctxSelectedEl && isMindNode(ctxSelectedEl) ? ctxSelectedEl : null;
  const menuMindFlow = menuMindNode
    ? mindFlowOf(activeTab.elements, menuMindNode)
    : DEFAULT_MIND_FLOW;
  // Its spacing, from the same root (docs/specs/009-elements/mind-node.md "Spacing").
  const menuMindSpacing = menuMindNode
    ? mindSpacingOf(activeTab.elements, menuMindNode)
    : DEFAULT_MIND_SPACING;
  // Select Branch / Select Whole Map: the node (or its root) with everything under it and the lines between, through
  // the marquee commit, so a one-node branch is a single selection and a locked-by-other node is left out.
  const selectMindBranchOf = (node: ShapeElement | null) => {
    if (!node) return;
    selectMarquee(new Set(withMindBranches(activeTab.elements, new Set([node.id]))));
    track('Element', 'Selected', 'MindBranch');
  };
  const menuMindRoot = menuMindNode ? mindRootOf(activeTab.elements, menuMindNode) : null;

  // The selection's layer for the Layer section's move-to dropdown
  // (docs/specs/006-document/layers.md): the single resolved layer every member shares, or null
  // when the selection spans layers.
  const ctxLayerIds = new Set(
    ctxMemberIds
      .map((id) => activeTab.elements.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => e != null)
      .map((el) => resolveLayerId(el.layerId, layers)),
  );
  const selectionLayerId = ctxLayerIds.size === 1 ? [...ctxLayerIds][0]! : null;

  // Wordmark type is offered for a text element whose centre is on a logo page
  // (docs/specs/007-editor/logo-pages.md "Wordmark type").
  const wordmarkOffered =
    !!pagesMode &&
    ctxSelectedEl?.type === 'text' &&
    !!logoPageAt(pagesMode.pages, {
      x: ctxSelectedEl.x + ctxSelectedEl.width / 2,
      y: ctxSelectedEl.y + ctxSelectedEl.height / 2,
    });

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
      // Event-storming note verbs (docs/specs/021-event-storming/event-storming.md). Front/back here are the
      // IN-LAYER stack (same as the selection popover), not the layer
      // moves above: on a workshop board the notes share one band and
      // "bring to front" means "over the note it overlaps".
      onCutElement={() => {
        copySelection({ cut: true });
        // A Cut keeps the sheets of its Sheets for the paste: it never asks (sheet-store.md "Deleting a sheet").
        deleteSelected({ cut: true });
      }}
      onCopyElement={copySelection}
      onDuplicateElement={duplicateSelected}
      onDeleteElement={deleteSelected}
      onSetEsKind={
        createBlocked || contextMenu.mode !== 'element'
          ? undefined
          : (kind) => setEsKindOf(contextMenu.elementId, kind)
      }
      onStackFront={stackSelectedFront}
      onStackBack={stackSelectedBack}
      layers={layers}
      selectionLayerId={selectionLayerId}
      // "Move to layer" goes with the Layers panel's Settings switch
      // (docs/specs/007-editor/user-preferences.md); layers keep applying either way.
      onMoveSelectionToLayer={
        panelEnabled(userPreferences, 'layersPanelEnabled') ? moveSelectedToLayer : undefined
      }
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
      onUnlinkChart={unlinkChartSelected}
      onEditLineData={setLineDataOpenForId}
      onEditCodeBlock={setCodeEditOpenForId}
      onSetCodeWrap={setCodeWrapSelected}
      onSetLegendItems={setLegendItemsSelected}
      sankey={sankeyMenu}
      onEditSequence={
        ctxSelectedEl?.type === 'shape' &&
        ctxSelectedEl.shape === 'sequence' &&
        canEditSequence(can, ctxSelectedEl)
          ? setSequenceOpenForId
          : undefined
      }
      chartThemeRamp={themeChartPalette(getTheme(activeTab.theme))}
      flowchart={flowchartMenu}
      mindFlow={menuMindFlow}
      onSetMindFlow={setMindFlowSelected}
      onTidyMindMap={tidyMindMapSelected}
      onEditMindOutline={
        menuMindRoot && mindOutline.canEdit(menuMindRoot.id)
          ? () => mindOutline.open(menuMindRoot.id)
          : undefined
      }
      mindSpacing={menuMindSpacing}
      onSetMindSpacing={setMindSpacingSelected}
      onSelectMindBranch={() => selectMindBranchOf(menuMindNode)}
      onSelectMindMap={() => selectMindBranchOf(menuMindRoot)}
      onSetChecklistItems={setChecklistItemsSelected}
      onToggleChecklistItem={toggleChecklistItem}
      onSetEntityFields={setEntityFieldsSelected}
      onSetWebRows={setWebRowsSelected}
      onSetHeroCaption={setHeroCaptionSelected}
      onSetDecisionStatus={setDecisionStatusSelected}
      onSetDecisionDate={setDecisionDateSelected}
      onSetDecisionDrivers={setDecisionDriversSelected}
      onSetPortalTarget={setPortalTargetSelected}
      onSetPortalName={setPortalNameSelected}
      onCreateLinkedPortal={createLinkedPortal}
      onSetSession={setSessionConfigSelected}
      onSetPickerSource={setPickerSourceSelected}
      onSetPickerOptions={setPickerOptionsSelected}
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
      wordmarkOffered={wordmarkOffered}
      onCombine={canCombine() ? (op) => void combineSelected(op) : undefined}
      onMirrorCopy={pagesMode?.logo?.canMirrorCopy() ? pagesMode.logo.mirrorCopy : undefined}
      onSetWordmark={commitWordmark}
      onPreviewWordmark={previewWordmark}
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
