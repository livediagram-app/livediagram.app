'use client';

// The quick style panel's marker rows on a whiteboard (docs/specs/023-whiteboard/whiteboard.md "The
// quick style panel stays"): colour and width for the selected marker strokes, or for the marker in
// hand when nothing is selected, so picking up a marker already offers its style. Quick choices
// only: Marker colour is the eight stock colours, Ink first; Custom colours, the tab's own, follow
// only when the tab has any; then Marker width.

import { BorderStrokeIcon } from '@/components/palette/palette-style-previews';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import type { PenWidthId, QuickPenStyle } from '@/lib/quick-style-pen';
import { WHITEBOARD_PEN_WIDTHS } from '@/lib/whiteboard-prefs';
import { QuickRadioRow, type QuickRowDensity } from './quick-style-rows';
import { QUICK_ROW_TARGETS } from './quick-style-metrics';

// The pens' widths drawn with the border-width previews, thinnest first.
const WIDTH_PREVIEW: Record<PenWidthId, 'thin' | 'medium' | 'thick'> = {
  fine: 'thin',
  medium: 'medium',
  bold: 'thick',
};

export function QuickPenRows({
  pen,
  quickStyle,
  showTitles,
  density,
}: {
  pen: QuickPenStyle;
  quickStyle: QuickStyleApi;
  showTitles: boolean;
  density: QuickRowDensity;
}) {
  const swatches = (options: QuickPenStyle['colour']['options']) =>
    options.map((o) => ({ ...o, content: null }));
  return (
    <>
      <QuickRadioRow
        title="Marker colour"
        testId="quick-style-marker-colour"
        showTitle={showTitles}
        density={density}
        options={swatches(pen.colour.options)}
        columns={QUICK_ROW_TARGETS.pen}
        value={pen.colour.value}
        onChoose={quickStyle.setPenColour}
      />
      {pen.colour.custom.length > 0 ? (
        <QuickRadioRow
          title="Custom colours"
          testId="quick-style-marker-custom"
          showTitle={showTitles}
          density={density}
          options={swatches(pen.colour.custom)}
          columns={QUICK_ROW_TARGETS.pen}
          value={pen.colour.value}
          onChoose={quickStyle.setPenColour}
        />
      ) : null}
      <QuickRadioRow
        title="Marker width"
        testId="quick-style-marker-width"
        showTitle={showTitles}
        density={density}
        options={WHITEBOARD_PEN_WIDTHS.map((w) => ({
          value: w.id as PenWidthId,
          name: w.label,
          content: <BorderStrokeIcon value={WIDTH_PREVIEW[w.id as PenWidthId]} />,
        }))}
        value={pen.width.value}
        onChoose={quickStyle.setPenWidth}
      />
    </>
  );
}
