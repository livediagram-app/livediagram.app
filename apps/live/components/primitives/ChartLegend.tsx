// The right-hand legend shared by the chart-family element views (pie, bar, …):
// a stacked colour-swatch + label per datum, right-aligned in a fixed-width
// column. Renders nothing when the column is too narrow to read (`legendW`
// under 48px), so callers can always mount it. `colorAt` resolves each datum's
// swatch colour (explicit slice colour, else the palette), matching how the
// chart body colours its slices / bars.

import type { PieSlice } from '@livediagram/diagram';

export function ChartLegend({
  items,
  colorAt,
  legendW,
  textColor,
  fontFamily,
}: {
  items: readonly PieSlice[];
  colorAt: (index: number, item: PieSlice) => string;
  legendW: number;
  textColor: string;
  fontFamily?: string;
}) {
  if (legendW < 48) return null;
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-center gap-0.5 overflow-hidden pr-1"
      style={{ width: legendW, color: textColor, fontFamily }}
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
