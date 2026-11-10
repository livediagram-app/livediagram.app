import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { describeOne } from '@/lib/element-names';
import { track } from '@/lib/telemetry';

// The Canvas props for the floating panels and docks (EditorCanvasHost): the minimap, Layers, the
// laser, spotlight, eraser and format panels, the Slide Deck, Theme & canvas, Tidy Up, and the Collaborate
// panel's comment and action rows.
export function usePanelCanvasProps({
  stableSlideDeck,
}: {
  stableSlideDeck: ReturnType<typeof useEditorContext>['slideDeck'];
}) {
  const {
    activeTab,
    scrollIntoView,
    activeTabLocked,
    slideDeckPanelPosition,
    setSlideDeckPanelPosition,
    layers,
    activeLayerId,
    layerCounts,
    laserPanelPosition,
    spotlightPanelPosition,
    setSpotlightPanelPosition,
    eraserPanelPosition,
    setEraserPanelPosition,
    eraserConfig,
    onChangeEraserField,
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
    actionRows,
    commentRows,
    commentsPanelPosition,
    embedMode,
    formatSourceId,
    isReadOnly,
    mapPosition,
    openActionPopover,
    completeAction,
    reopenAction,
    openComments,
    canvasThemeTab,
    setCanvasThemeTab,
    setCommentsPanelPosition,
    setMapPosition,
    setSelectedId,
    autoAlignTab,
    autoLayoutTab,
    previewCleanup,
    endCleanupPreview,
    assessCleanupKind,
  } = useEditorContext();
  // The Collaborate panel's jump to a conversation card (docs/specs/012-collaboration/assigned-actions.md §5):
  // true when the row's element is that kind of card, now centred in view.
  const jumpToCard = (id: string, shape: 'comment-pin' | 'action-card'): boolean => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape' || el.shape !== shape) return false;
    scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    return true;
  };
  // The element the format brush is loaded from (docs/specs/010-palette/stickers.md), for the panel's
  // preview. Resolved here rather than in the panel so the panel stays a
  // renderer and never reaches into the tab.
  const formatSource = formatSourceId
    ? (activeTab.elements.find((el) => el.id === formatSourceId) ?? null)
    : null;
  return {
    mapPosition: mapPosition,
    onMoveMap: (x, y) =>
      // Equality-guarded so a drag tick that resolves to the same spot
      // doesn't spin the render loop (max update depth).
      setMapPosition((p) => (p && p.x === x && p.y === y ? p : { x, y })),
    onResetMap: () => setMapPosition((p) => (p === null ? p : null)),
    layers: layers,
    activeLayerId: activeLayerId,
    layerCounts: layerCounts,
    laserPanelPosition: laserPanelPosition,
    spotlightPanelPosition: spotlightPanelPosition,
    eraserPanelPosition: eraserPanelPosition,
    eraserConfig: eraserConfig,
    onChangeEraserField: onChangeEraserField,
    formatConfig: formatConfig,
    onToggleFormatGroup: onToggleFormatGroup,
    onSetFormatMode: onSetFormatMode,
    // What the brush holds, described for the panel's preview (docs/specs/010-palette/stickers.md):
    // the loaded element's name and the three colours the swatch draws.
    formatBrushSource: formatSource
      ? {
          name: describeOne(formatSource),
          fill: 'fillColor' in formatSource ? formatSource.fillColor : undefined,
          stroke: 'strokeColor' in formatSource ? formatSource.strokeColor : undefined,
          textColor: 'textColor' in formatSource ? formatSource.textColor : undefined,
        }
      : null,
    formatPanelPosition: formatPanelPosition,
    onMoveFormatPanel: (x, y) => setFormatPanelPosition({ x, y }),
    onResetFormatPanel: () => setFormatPanelPosition(null),
    // Slide Deck (docs/specs/012-collaboration/presentation-mode.md): the deck itself plus its panel's placement.
    slideDeck: stableSlideDeck,
    slideDeckPanelPosition: slideDeckPanelPosition,
    onMoveSlideDeckPanel: (x, y) => setSlideDeckPanelPosition({ x, y }),
    onResetSlideDeckPanel: () => setSlideDeckPanelPosition(null),
    onMoveEraserPanel: (x, y) => setEraserPanelPosition({ x, y }),
    onResetEraserPanel: () => setEraserPanelPosition(null),
    onMoveSpotlightPanel: (x, y) => setSpotlightPanelPosition({ x, y }),
    onResetSpotlightPanel: () => setSpotlightPanelPosition(null),
    laserConfig: laserConfig,
    onChangeLaserField: onChangeLaserField,
    onMoveLaserPanel: (x, y) => setLaserPanelPosition({ x, y }),
    onResetLaserPanel: () => setLaserPanelPosition(null),
    // Bottom-dock Theme & canvas button (docs/specs/011-theme/canvas-and-theme-dialog.md): opens the
    // CanvasThemeDialog on its home, the Looks and the Fine-tune rows.
    onOpenCanvasTheme:
      isReadOnly || embedMode
        ? undefined
        : () => {
            setCanvasThemeTab('looks');
            track('UI', 'Opened', 'ThemePicker');
          },
    canvasThemeOpen: canvasThemeTab !== null,
    // Diagram mode's Tidy Up button (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button"): an
    // Editor's, so a Participant or Viewer (read-only for structure) and an embed get no button.
    tidyUp:
      isReadOnly || embedMode
        ? undefined
        : {
            run: (kind, judged) =>
              kind === 'align' ? autoAlignTab({ judged }) : autoLayoutTab(kind, { judged }),
            preview: previewCleanup,
            endPreview: endCleanupPreview,
            assess: assessCleanupKind,
            blocked: activeTabLocked,
          },
    onSelectLayer: setActiveLayer,
    onAddLayer: addLayer,
    onRemoveLayer: removeLayer,
    onRenameLayer: renameLayer,
    onToggleLayerVisibility: toggleLayerVisibility,
    onToggleLayerLock: toggleLayerLock,
    onReorderLayer: reorderLayer,
    onMergeLayer: mergeActiveLayer,
    onSetLayerOpacity: setLayerOpacityLive,
    onClearLayer: clearLayer,
    onHideOtherLayers: hideOtherLayersOp,
    layerPreviewId: layerPreviewId,
    onPreviewLayer: setLayerPreviewId,
    commentRows: commentRows,
    commentsPanelPosition: commentsPanelPosition,
    onMoveCommentsPanel: (x, y) => setCommentsPanelPosition({ x, y }),
    onResetCommentsPanel: () => setCommentsPanelPosition(null),
    onOpenCommentsForElement: (id) => {
      setSelectedId(id);
      // A Comment panel IS the thread (docs/specs/012-collaboration/assigned-actions.md §5): go to it
      // rather than open a popover repeating it beside the card.
      if (!jumpToCard(id, 'comment-pin')) openComments(id);
    },
    actionRows: actionRows,
    onOpenActionForElement: (id) => {
      setSelectedId(id);
      // An Action panel IS the action: the same jump.
      if (!jumpToCard(id, 'action-card')) openActionPopover(id);
    },
    onToggleActionDone: isReadOnly
      ? undefined
      : (id, done, actionId) => (done ? completeAction(id, actionId) : reopenAction(id, actionId)),
  } satisfies Partial<CanvasProps>;
}
