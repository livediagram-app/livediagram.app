'use client';

import {
  brushPageId,
  pageBrushPreview,
  pagePaintPress,
} from '@liveworkspace/workbench/lib/format-page-brush';
import { useDeadPageBrush } from '@liveworkspace/workbench/hooks/editor/useDeadPageBrush';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { describeOne } from '@/lib/element-names';

// The format brush's canvas props for EditorCanvasHost: what the brush holds, for the Format panel's preview,
// and a page press while the brush holds a page's background.
export function useCanvasHostBrush(): Pick<CanvasProps, 'onFormatPagePress' | 'formatBrushSource'> {
  const { activeTab, canvasTool, formatConfig, formatSourceId, pagesMode, setFormatSourceId } =
    useEditorContext();
  // The element the format brush is loaded from (docs/specs/010-palette/stickers.md), for the panel's
  // preview. Resolved here rather than in the panel so the panel stays a
  // renderer and never reaches into the tab.
  // A page's background in the brush (docs/specs/007-editor/pages-mode.md "Copying a background").
  const brushedPage = pagesMode?.pages.find((pg) => pg.id === brushPageId(formatSourceId));
  useDeadPageBrush(
    formatSourceId,
    pagesMode?.pages.map((pg) => pg.id),
    setFormatSourceId,
  );
  const formatSource = formatSourceId
    ? (activeTab.elements.find((el) => el.id === formatSourceId) ?? null)
    : null;
  return {
    onFormatPagePress:
      canvasTool === 'format' && pagesMode?.edit
        ? (pageId) => {
            // A page's background as the brush, painted page to page (docs/specs/007-editor/
            // pages-mode.md "Copying a background").
            // A brush whose page has gone is emptied as the page goes (useDeadPageBrush), so this
            // press arms the pressed page at once.
            const press = pagePaintPress(formatSourceId, pageId, formatConfig.mode === 'keep');
            // A refused paint (a locked page) keeps the brush:
            // only a paint empties a Paint once brush.
            if (press.paint && !pagesMode.edit?.copyBackground(press.paint.from, press.paint.to))
              return;
            if (press.next !== formatSourceId) setFormatSourceId(press.next);
          }
        : undefined,
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
  };
}
