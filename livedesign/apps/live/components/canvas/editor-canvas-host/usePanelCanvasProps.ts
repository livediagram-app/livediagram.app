import { useEditorContext } from '@/app/design/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { describeOne } from '@/lib/element-names';
import { track } from '@/lib/telemetry';
import { brushPageId, pageBrushPreview } from '@liveworkspace/workbench/lib/format-page-brush';

// The Canvas props for the floating panels and docks (EditorCanvasHost): the minimap, Layers, the
// laser, spotlight, eraser and format panels, Theme & canvas, and the Collaborate panel's comment and
// action rows.
export function usePanelCanvasProps() {
  const {
    activeTab,
    layers,
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
    setCanvasThemeTab,
    setCommentsPanelPosition,
    setMapPosition,
    setSelectedId,
    pagesMode,
  } = useEditorContext();
  // The element the format brush is loaded from (docs/specs/010-palette/stickers.md), for the panel's
  // preview. Resolved here rather than in the panel so the panel stays a
  // renderer and never reaches into the tab.
  // A page's background in the brush (docs/specs/007-editor/pages-mode.md "Copying a background").
  const brushedPage = pagesMode?.pages.find((pg) => pg.id === brushPageId(formatSourceId));
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
    formatBrushSource: brushedPage
      ? pageBrushPreview(brushedPage)
      : formatSource
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
    commentRows: commentRows,
    commentsPanelPosition: commentsPanelPosition,
    onMoveCommentsPanel: (x, y) => setCommentsPanelPosition({ x, y }),
    onResetCommentsPanel: () => setCommentsPanelPosition(null),
    onOpenCommentsForElement: (id) => {
      setSelectedId(id);
      openComments(id);
    },
    actionRows: actionRows,
    onOpenActionForElement: (id) => {
      setSelectedId(id);
      openActionPopover(id);
    },
    onToggleActionDone: isReadOnly
      ? undefined
      : (id, done, actionId) => (done ? completeAction(id, actionId) : reopenAction(id, actionId)),
  } satisfies Partial<CanvasProps>;
}
