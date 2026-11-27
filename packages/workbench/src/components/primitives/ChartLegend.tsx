// The legend shared by the chart-family element views (pie, bar, line): a
// colour-swatch + label per datum, painted into the strip the chart layout
// reserves (`legend` from chartFrame — docs/specs/009-elements/pie-chart.md). A left/right legend stacks in
// a column; a top/bottom legend wraps in a centred row. Renders nothing when
// the strip is too small to read, so callers can always mount it. `colorAt`
// resolves each datum's swatch colour (explicit slice colour, else the
// palette), matching how the chart body colours its slices / bars.

import { chartLegendGaps } from '@liveworkspace/element-model/chart-style';

// A datum and a legend side, as every product's chart elements store them (its PieSlice and
// ChartLegendPosition).
type PieSlice = { label: string; value: number; color?: string };
type ChartLegendPosition = 'top' | 'right' | 'bottom' | 'left';

type LegendRect = {
  show: boolean;
  pos: ChartLegendPosition;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function ChartLegend({
  items,
  colorAt,
  legend,
  textColor,
  fontFamily,
  fontPx,
}: {
  items: readonly PieSlice[];
  colorAt: (index: number, item: PieSlice) => string;
  legend: LegendRect;
  textColor: string;
  fontFamily?: string;
  // The row text size, from the chart's Text Size (legendFontPx, docs/specs/009-elements/pie-chart.md).
  fontPx: number;
}) {
  // The swatch keeps its proportion to the words beside it.
  const swatch = Math.round(fontPx * 0.8);
  // The same air as the export's key (chart-style.ts chartLegendGaps): its row gap is the export's item gap less the
  // 2px the strip's padding adds.
  const gap = chartLegendGaps(fontPx);
  const vertical = legend.pos === 'left' || legend.pos === 'right';
  if (!legend.show || (vertical ? legend.w < 48 : legend.h < 18)) return null;
  return (
    <div
      className={`pointer-events-none absolute flex overflow-hidden ${
        vertical
          ? 'flex-col justify-center gap-0.5'
          : 'flex-row flex-wrap content-center justify-center gap-y-0.5'
      }`}
      style={{
        left: legend.x,
        top: legend.y,
        width: legend.w,
        height: legend.h,
        padding: 2,
        columnGap: vertical ? undefined : gap.item - 2,
        color: textColor,
        fontFamily,
      }}
      aria-hidden
    >
      {items.map((item, i) => (
        // max-w-full: a name longer than the strip is cut with an ellipsis (its span's `truncate`) rather than
        // widening its row past the chart, where the strip's overflow would clip its swatch and both ends.
        <div
          key={i}
          className="flex max-w-full items-center leading-tight"
          style={{ gap: gap.swatch }}
        >
          <span
            className="inline-block shrink-0 rounded-full"
            style={{ width: swatch, height: swatch, backgroundColor: colorAt(i, item) }}
          />
          <span className="truncate" style={{ fontSize: fontPx }}>
            {item.label || '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
