'use client';

// The quick style panel's marker rows on a whiteboard (docs/specs/023-draw-mode/draw-mode.md "The
// quick style panel stays"): colour and width for the selected marker strokes, or for the marker in
// hand when nothing is selected, so picking up a marker already offers its style. Quick choices
// only: Marker colour is the nine stock colours, Ink first; Custom colours, the tab's own, follow
// only when the tab has any; then Marker width.

import { PenWidthIcon } from './whiteboard/PenWidthIcon';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import type { PenColourChoice, PenWidthId, QuickPenStyle } from '@/lib/quick-style-pen';
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
      {pen.colour.custom.length > 0 ? (
        <QuickRadioRow
          title="Custom colours"
          testId="quick-style-marker-custom"
          showTitle={showTitles}
          options={swatches(pen.colour.custom)}
          columns={QUICK_ROW_TARGETS}
          value={pen.colour.value}
          onChoose={quickStyle.setPenColour}
        />
      ) : null}
      <QuickRadioRow
        title="Marker width"
        testId="quick-style-marker-width"
        showTitle={showTitles}
        options={WHITEBOARD_PEN_WIDTHS.map((w) => ({
          value: w.id as PenWidthId,
          name: w.label,
          content: <PenWidthIcon width={w.id as PenWidthId} />,
        }))}
        value={pen.width.value}
        onChoose={quickStyle.setPenWidth}
      />
    </>
  );
}

// A whiteboard's Stroke or Text colour row (docs/specs/023-draw-mode/draw-mode.md "The quick style
// panel stays"): the whiteboard's colours, as Marker colour offers them, and the tab's custom
// colours below when it has any.
export function BoardColourRows({
  title,
  customTitle,
  testId,
  section,
  onChoose,
  showTitles,
}: {
  title: string;
  // The custom row's own name, so it reads apart from the Marker colour row's.
  customTitle: string;
  testId: string;
  section: BoardColourSection;
  onChoose: (colour: PenColourChoice) => void;
  showTitles: boolean;
}) {
  const surface = useCanvasSurface();
  const swatches = (options: BoardColourSection['options']) =>
    options.map((o) => ({ ...o, content: null }));
  return (
    <>
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
      {section.custom.length > 0 ? (
        <QuickRadioRow
          title={customTitle}
          testId={`${testId}-custom`}
          showTitle={showTitles}
          options={swatches(section.custom)}
          columns={QUICK_ROW_TARGETS}
          value={section.value}
          onChoose={onChoose}
        />
      ) : null}
    </>
  );
}
