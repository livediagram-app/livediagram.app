// Hover readout for a chart mark (pie slice / bar), shared by the chart-family
// views (docs/specs/009-elements/pie-chart.md). Shows the hovered datum's label + value. Positioned by
// percentage within the chart body (the `absolute inset-0` wrapper), anchored
// above its point (translate -50% / -100%). pointer-events-none so it never
// eats the hover that drives it or the element's drag. Independent of the
// legend toggle — it's the only way to read values when the legend is off.

export function ChartReadout({
  leftPct,
  topPct,
  label,
  value,
  align = 'center',
}: {
  leftPct: number;
  topPct: number;
  label: string;
  // A number for a chart's datum; a ready-made phrase for a Sankey band or node (docs/specs/009-elements/sankey.md).
  value: number | string;
  // Which edge sits at the point: centred by default; 'start' or 'end' near a side, so it grows inward and never
  // runs out of a small box (a Sankey's preview in its Flows dialog).
  align?: 'start' | 'center' | 'end';
}) {
  const shift =
    align === 'start'
      ? 'translate-x-0'
      : align === 'end'
        ? '-translate-x-full'
        : '-translate-x-1/2';
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-[var(--z-panel)] ${shift} -translate-y-full whitespace-nowrap rounded-md bg-slate-900/95 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-lg dark:bg-slate-700`}
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {label || '—'}: {value}
    </div>
  );
}
