import {
  chartPaletteColors,
  legendFontPx,
  PIE_PALETTE,
  type ShapeElement,
} from '@livediagram/diagram';

// The legend's canvas view (docs/specs/009-elements/pie-chart.md): a themed card of colour-coded rows, one
// dot and one label each. A key, not a chart, so nothing here is clickable:
// the colours and the words are edited from the context menu's Legend section,
// which is where every other data shape's rows are edited.
//
// A row with no colour of its own takes the chart ramp by index, so a legend
// dropped beside a chart matches it without being told to, and adding a row
// picks up the next colour rather than leaving a blank swatch.
export function LegendView({
  element,
  accent,
  fill,
  textColor,
  fontFamily,
}: {
  element: ShapeElement;
  accent: string;
  fill: string;
  textColor: string;
  fontFamily?: string;
}) {
  const items = element.legendItems ?? [];
  const colors = chartPaletteColors(element.chartPalette) ?? PIE_PALETTE;
  // Text Size (docs/specs/009-elements/pie-chart.md) scales the rows, and the dot keeps its proportion to
  // the words beside it.
  const fontPx = legendFontPx(element.textSize);
  const dotPx = Math.round(fontPx * 0.75);
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-lg border"
      style={{ backgroundColor: fill, borderColor: accent, fontFamily }}
    >
      <div className="flex h-full flex-col gap-1.5 overflow-hidden p-3">
        {items.map((item, index) => (
          <div key={index} className="flex min-h-5 shrink-0 items-center gap-2">
            <span
              className="inline-block shrink-0 rounded-full"
              style={{
                width: dotPx,
                height: dotPx,
                backgroundColor: item.color ?? colors[index % colors.length]!,
              }}
              aria-hidden
            />
            <span className="truncate leading-tight" style={{ color: textColor, fontSize: fontPx }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
