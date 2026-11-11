// The Format panel's props for the Canvas (docs/specs/010-palette/stickers.md): its groups and mode, what the brush
// holds for the preview, and where the panel stands, read from EditorContext. Split from EditorCanvasHost, which
// spreads them into the Canvas.
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { describeOne } from '@/lib/element-names';

export function useCanvasFormatProps(): Pick<
  CanvasProps,
  | 'formatConfig'
  | 'onToggleFormatGroup'
  | 'onSetFormatMode'
  | 'formatBrushSource'
  | 'formatPanelPosition'
  | 'onMoveFormatPanel'
  | 'onResetFormatPanel'
> {
  const {
    activeTab,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatPanelPosition,
    setFormatPanelPosition,
    formatSourceId,
  } = useEditorContext();
  // The element the format brush is loaded from (docs/specs/010-palette/stickers.md), for the panel's
  // preview. Resolved here rather than in the panel so the panel stays a
  // renderer and never reaches into the tab.
  const formatSource = formatSourceId
    ? (activeTab.elements.find((el) => el.id === formatSourceId) ?? null)
    : null;
  return {
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
  };
}
