// Hover tooltip for a chart mark (pie slice / bar), shared by the chart-family
// views (spec/53). Shows the hovered datum's label + value. Positioned by
// percentage within the chart body (the `absolute inset-0` wrapper), anchored
// above its point (translate -50% / -100%). pointer-events-none so it never
// eats the hover that drives it or the element's drag. Independent of the
// legend toggle — it's the only way to read values when the legend is off.

export function ChartTooltip({
  leftPct,
  topPct,
  label,
  value,
}: {
  leftPct: number;
  topPct: number;
  label: string;
  value: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900/95 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-lg dark:bg-slate-700"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {label || '—'}: {value}
    </div>
  );
}
