'use client';

// The quick style panel's pen rows on a whiteboard (docs/specs/023-whiteboard/whiteboard.md "The
// quick style panel stays"): colour and width for the selected pen strokes, or for the pen in hand
// when nothing is selected, so picking up a pen already offers its style.

import { BorderStrokeIcon } from '@/components/palette/palette-style-previews';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import type { PenWidthId, QuickPenStyle } from '@/lib/quick-style-pen';
import { WHITEBOARD_PEN_WIDTHS } from '@/lib/whiteboard-prefs';
import { QuickRadioRow, type QuickRowDensity } from './quick-style-rows';

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
  return (
    <>
      <QuickRadioRow
        title="Pen colour"
        testId="quick-style-pen-colour"
        showTitle={showTitles}
        density={density}
        options={pen.colour.options.map((o) => ({ ...o, content: null }))}
        value={pen.colour.value}
        onChoose={quickStyle.setPenColour}
      />
      <QuickRadioRow
        title="Pen width"
        testId="quick-style-pen-width"
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
