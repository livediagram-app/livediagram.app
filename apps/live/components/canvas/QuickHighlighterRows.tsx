'use client';

// The quick style panel's Highlighter rows (docs/specs/008-canvas/highlighter.md "Settings"): colour
// and width for the selected highlights, or for the armed Highlighter tile's next stroke when
// nothing is selected. The marker's own five colours and three widths, in the same row rhythm as a
// whiteboard marker's (QuickPenRows).

import { BorderStrokeIcon } from '@/components/palette/palette-style-previews';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import { HIGHLIGHTER_WIDTHS, type HighlighterWidthId } from '@/lib/highlighter-config';
import type { QuickHighlighterStyle } from '@/lib/quick-style-highlighter';
import { QuickRadioRow } from './quick-style-rows';
import { QUICK_ROW_TARGETS } from './quick-style-metrics';
import { QuickMoreColours } from './QuickMoreColours';
import { standardGroup } from '@/components/colour/colour-options';

// The widths drawn with the border-width previews, thinnest first.
const WIDTH_PREVIEW: Record<HighlighterWidthId, 'thin' | 'medium' | 'thick'> = {
  thin: 'thin',
  medium: 'medium',
  bold: 'thick',
};

export function QuickHighlighterRows({
  highlighter,
  quickStyle,
  showTitles,
}: {
  highlighter: QuickHighlighterStyle;
  quickStyle: QuickStyleApi;
  showTitles: boolean;
}) {
  return (
    <>
      <QuickRadioRow
        title="Highlighter colour"
        testId="quick-style-highlighter-colour"
        showTitle={showTitles}
        options={highlighter.colour.options.map((o) => ({ ...o, content: null }))}
        columns={QUICK_ROW_TARGETS}
        value={highlighter.colour.value}
        onChoose={quickStyle.setHighlighterColour}
        more={
          <QuickMoreColours
            rowTitle="Highlighter colour"
            value={highlighter.colour.value}
            standard={standardGroup('soft', 'light', 'hex')}
            onPick={quickStyle.setHighlighterColour}
          />
        }
      />
      <QuickRadioRow
        title="Highlighter width"
        testId="quick-style-highlighter-width"
        showTitle={showTitles}
        options={HIGHLIGHTER_WIDTHS.map((w) => ({
          value: w.id,
          name: w.label,
          content: <BorderStrokeIcon value={WIDTH_PREVIEW[w.id]} />,
        }))}
        value={highlighter.width.value}
        onChoose={quickStyle.setHighlighterWidth}
      />
    </>
  );
}
