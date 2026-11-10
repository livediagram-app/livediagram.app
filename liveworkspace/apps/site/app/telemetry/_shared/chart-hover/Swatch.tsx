import type { HoverSeries } from './hover-model';

// A line's swatch, in a legend or a tooltip row: a short stroke in the line's colour, dashed for a dashed line. Its
// `data-app` scopes `var(--color-brand-500)` to the line's app, and `className` colours a `currentColor` line.
export function Swatch({
  series,
}: {
  series: Pick<HoverSeries, 'app' | 'dashed' | 'className' | 'color'>;
}) {
  return (
    <span
      aria-hidden
      data-app={series.app}
      className={`inline-block w-4 shrink-0 border-t-2 ${series.dashed ? 'border-dashed' : ''} ${
        series.className ?? ''
      }`}
      style={{ borderColor: series.color }}
    />
  );
}
