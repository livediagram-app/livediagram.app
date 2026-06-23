// The legend shared by the chart-family element views (pie, bar, line): a
// colour-swatch + label per datum, painted into the strip the chart layout
// reserves (`legend` from chartFrame — spec/53). A left/right legend stacks in
// a column; a top/bottom legend wraps in a centred row. Renders nothing when
// the strip is too small to read, so callers can always mount it. `colorAt`
// resolves each datum's swatch colour (explicit slice colour, else the
// palette), matching how the chart body colours its slices / bars.

import type { ChartLegendPosition, PieSlice } from '@livediagram/diagram';

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
}: {
  items: readonly PieSlice[];
  colorAt: (index: number, item: PieSlice) => string;
  legend: LegendRect;
  textColor: string;
  fontFamily?: string;
}) {
  const vertical = legend.pos === 'left' || legend.pos === 'right';
  if (!legend.show || (vertical ? legend.w < 48 : legend.h < 18)) return null;
  return (
    <div
      className={`pointer-events-none absolute flex overflow-hidden ${
        vertical
          ? 'flex-col justify-center gap-0.5'
          : 'flex-row flex-wrap content-center justify-center gap-x-2 gap-y-0.5'
      }`}
      style={{
        left: legend.x,
        top: legend.y,
        width: legend.w,
        height: legend.h,
        padding: 2,
        color: textColor,
        fontFamily,
      }}
      aria-hidden
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1 leading-tight">
          <span
            className="inline-block shrink-0 rounded-[2px]"
            style={{ width: 9, height: 9, backgroundColor: colorAt(i, item) }}
          />
          <span className="truncate text-[11px]">{item.label || '—'}</span>
        </div>
      ))}
    </div>
  );
}
