import type { ComponentProps, ReactNode } from 'react';
import { ChartLegend } from '@/components/primitives/ChartLegend';

// What every chart element is drawn on (spec/53): the positioned box, the
// full-bleed SVG the marks live in, the hover tooltip, and the legend strip.
//
// The bar, line and pie views each carried their own copy: the same wrapper
// div, the same seven SVG attributes, and the same five legend props, with
// only the marks and the tooltip's position differing. Three copies of a frame
// is how one of them ends up with a different viewBox or a legend that stops
// inheriting the element's font.
//
// The tooltip arrives as a node rather than coordinates, because where it
// points is the one part that is genuinely per-chart: a bar knows its slot, a
// wedge its centroid, a line its sample.
export function ChartSurface({
  w,
  h,
  items,
  colorAt,
  legend,
  textColor,
  fontFamily,
  tooltip,
  children,
}: ComponentProps<typeof ChartLegend> & {
  // The element's own coordinate space, from chartFrame(). The SVG scales to
  // the element's real size, so marks are authored against these numbers.
  w: number;
  h: number;
  // Rendered only when something is hovered; the caller decides where.
  tooltip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0">
      {/* pointer-events-none: hit-testing rides the element's own box, so the
          marks never swallow a drag or a selection click. */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {children}
      </svg>
      {tooltip}
      <ChartLegend
        items={items}
        colorAt={colorAt}
        legend={legend}
        textColor={textColor}
        fontFamily={fontFamily}
      />
    </div>
  );
}
