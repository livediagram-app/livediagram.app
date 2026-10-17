'use client';

// The quick style panel's marker rows on a whiteboard (docs/specs/023-drawing-mode/drawing-mode.md "The
// quick style panel stays"): colour and width for the selected marker strokes, or for the marker in
// hand when nothing is selected, so picking up a marker already offers its style. Quick choices
// only, one row each: Marker colour is the nine stock colours, Ink first, then More colours (the
// colour picker, where the document's custom colours live); then Marker width.

import { PenWidthIcon } from './whiteboard/PenWidthIcon';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import type { PenColourChoice, QuickPenStyle } from '@/lib/quick-style-pen';
import type { BoardColourSection } from '@/lib/quick-style';
import { WHITEBOARD_PEN_WIDTHS } from '@/lib/whiteboard-prefs';
import { QuickRadioRow } from './quick-style-rows';
import { QUICK_ROW_TARGETS } from './quick-style-metrics';
import { QuickMoreColours } from './QuickMoreColours';
import { standardGroup } from '@/components/colour/colour-options';
import { useCanvasSurface } from './CanvasSurfaceContext';

export function QuickPenRows({
  pen,
  quickStyle,
  showTitles,
}: {
  pen: QuickPenStyle;
  quickStyle: QuickStyleApi;
  showTitles: boolean;
}) {
  const surface = useCanvasSurface();
  const swatches = (options: QuickPenStyle['colour']['options']) =>
    options.map((o) => ({ ...o, content: null }));
  return (
    <>
      <QuickRadioRow
        title="Marker colour"
        testId="quick-style-marker-colour"
        showTitle={showTitles}
        options={swatches(pen.colour.options)}
        columns={QUICK_ROW_TARGETS}
        value={pen.colour.value}
        onChoose={quickStyle.setPenColour}
        more={
          // The main pen keeps the board's ink: its row is the ink alone, with nothing more.
          pen.colour.options.length > 1 ? (
            <QuickMoreColours
              rowTitle="Marker colour"
              value={pen.colour.value}
              standard={standardGroup('strong', surface, 'name')}
              onPick={quickStyle.setPenColour}
            />
          ) : null
        }
      />
      <QuickRadioRow
        title="Marker width"
        testId="quick-style-marker-width"
        showTitle={showTitles}
        options={WHITEBOARD_PEN_WIDTHS.map((w) => ({
          value: w.id,
          name: w.label,
          content: <PenWidthIcon width={w.id} />,
        }))}
        // All six widths in one row, thinnest first.
        columns={WHITEBOARD_PEN_WIDTHS.length}
        value={pen.width.value}
        onChoose={quickStyle.setPenWidth}
      />
    </>
  );
}

// A whiteboard's Stroke or Text colour row (docs/specs/023-drawing-mode/drawing-mode.md "The quick style
// panel stays"): the whiteboard's colours, as Marker colour offers them, custom colours in More
// colours.
export function BoardColourRow({
  title,
  testId,
  section,
  onChoose,
  showTitles,
}: {
  title: string;
  testId: string;
  section: BoardColourSection;
  onChoose: (colour: PenColourChoice) => void;
  showTitles: boolean;
}) {
  const surface = useCanvasSurface();
  const swatches = (options: BoardColourSection['options']) =>
    options.map((o) => ({ ...o, content: null }));
  return (
    <QuickRadioRow
      title={title}
      testId={testId}
      showTitle={showTitles}
      options={swatches(section.options)}
      columns={QUICK_ROW_TARGETS}
      value={section.value}
      onChoose={onChoose}
      more={
        <QuickMoreColours
          rowTitle={title}
          value={section.value}
          standard={standardGroup('strong', surface, 'name')}
          onPick={onChoose}
        />
      }
    />
  );
}
