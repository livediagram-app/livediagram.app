'use client';

// The Quick Style bar's marker rows (docs/specs/023-draw-mode/drawing-tools.md "The Quick Style bar"): colour and
// width for the selected marker strokes, or for the marker in hand when nothing is selected, so picking up a marker
// already offers its style. Quick choices only, one row per popover: Marker colour is the nine stock colours, Ink
// first, then More colours (the colour picker, where the design's custom colours live); Marker width the six widths.

import { PenWidthIcon } from './whiteboard/PenWidthIcon';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import type { QuickPenStyle } from '@/lib/quick-style-pen';
import { WHITEBOARD_PEN_WIDTHS } from '@/lib/whiteboard-prefs';
import { QuickRadioRow } from './quick-style-rows';
import { QUICK_ROW_TARGETS } from './quick-style-metrics';
import { QuickMoreColours } from './QuickMoreColours';
import { standardGroup } from '@/components/colour/colour-options';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { ColourChip, ValueGlyph } from './quick-style-icons';

// While the rows style the marker in hand rather than the selection, the popover says so.
const inHand = (pen: QuickPenStyle) =>
  pen.subject.kind === 'pen' ? `In hand: ${pen.subject.name}` : undefined;

export function QuickPenColourRow({
  pen,
  quickStyle,
  showTitle = true,
}: {
  pen: QuickPenStyle;
  quickStyle: QuickStyleApi;
  // Off in a phone's sheet, whose heading names the row.
  showTitle?: boolean;
}) {
  const surface = useCanvasSurface();
  return (
    <QuickRadioRow
      title="Marker colour"
      testId="quick-style-marker-colour"
      showTitle={showTitle}
      note={inHand(pen)}
      options={pen.colour.options.map((o) => ({ ...o, content: null }))}
      columns={QUICK_ROW_TARGETS}
      value={pen.colour.value}
      onChoose={quickStyle.setPenColour}
      more={
        // The main marker keeps the canvas ink: its row is the ink alone, with nothing more.
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
  );
}

export function QuickPenWidthRow({
  pen,
  quickStyle,
  showTitle = true,
}: {
  pen: QuickPenStyle;
  quickStyle: QuickStyleApi;
  // Off in a phone's sheet, whose heading names the row.
  showTitle?: boolean;
}) {
  return (
    <QuickRadioRow
      title="Marker width"
      testId="quick-style-marker-width"
      showTitle={showTitle}
      note={inHand(pen)}
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
  );
}

/** The Marker button's dot: the colour in force (a custom colour as itself), split when the strokes disagree. */
export function QuickPenColourIcon({ pen }: { pen: QuickPenStyle }) {
  const { value, options } = pen.colour;
  const paint =
    value === null
      ? null
      : (options.find((o) => o.value === value)?.swatch ?? (value.startsWith('#') ? value : null));
  return <ColourChip kind="dot" paint={paint} />;
}

/** The Size button: the width in force, the default's muted when the strokes disagree. */
export function QuickPenWidthIcon({ pen }: { pen: QuickPenStyle }) {
  const v = pen.width.value;
  return (
    <ValueGlyph mixed={v === null}>
      <PenWidthIcon width={v ?? 'medium'} />
    </ValueGlyph>
  );
}
