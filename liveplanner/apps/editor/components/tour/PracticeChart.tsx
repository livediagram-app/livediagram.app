'use client';

// The chart the Sheets track's Chart It challenge makes (docs/specs/026-plan/plan-tour.md "Sheets: Five Small Wins"),
// drawn small in the mission strip from the cells the person picked: grouped columns, up to two series, a legend, and
// each column's value on hover. Its series colours are validated for colour-blind separation on both surfaces
// (light #7c5cff / #0d9488, dark #8b6dff / #0f9d8e); the legend names them, so colour never carries identity alone.

export type PracticeSeries = {
  // The series' names (the picked columns' headers), up to two.
  names: string[];
  rows: { label: string; values: number[] }[];
};

const W = 216;
const H = 76;
const AXIS = 14;
const SERIES_FILL = [
  'fill-[#7c5cff] dark:fill-[#8b6dff]',
  'fill-[#0d9488] dark:fill-[#0f9d8e]',
] as const;
const SERIES_SWATCH = ['bg-[#7c5cff] dark:bg-[#8b6dff]', 'bg-[#0d9488] dark:bg-[#0f9d8e]'] as const;

export function PracticeChart({ series }: { series: PracticeSeries }) {
  const count = Math.max(1, series.names.length);
  const max = Math.max(1, ...series.rows.flatMap((r) => r.values));
  const group = series.rows.length > 0 ? W / series.rows.length : W;
  const bar = Math.max(3, Math.min(10, (group - 6) / count - 2));
  const plot = H - AXIS;
  const summary = series.rows
    .map((r) => `${r.label}: ${r.values.map((v, i) => `${series.names[i] || 'value'} ${v}`).join(', ')}`)
    .join('; ');
  return (
    <figure className="m-0 flex shrink-0 flex-col gap-1">
      <svg
        role="img"
        aria-label={`Your chart. ${summary}`}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible"
      >
        <line
          x1={0}
          x2={W}
          y1={plot + 0.5}
          y2={plot + 0.5}
          className="stroke-slate-300 dark:stroke-slate-600"
        />
        {series.rows.map((row, gi) => {
          const x0 = gi * group + (group - (bar + 2) * count + 2) / 2;
          return (
            <g key={gi}>
              {row.values.map((v, si) => {
                const h = Math.max(1, (v / max) * (plot - 4));
                return (
                  <rect
                    key={si}
                    x={x0 + si * (bar + 2)}
                    y={plot - h}
                    width={bar}
                    height={h}
                    rx={2}
                    className={SERIES_FILL[si] ?? SERIES_FILL[0]}
                  >
                    <title>{`${row.label}${series.names[si] ? `, ${series.names[si]}` : ''}: ${v}`}</title>
                  </rect>
                );
              })}
              <text
                x={gi * group + group / 2}
                y={H - 2}
                textAnchor="middle"
                className="fill-slate-500 text-[9px] dark:fill-slate-400"
              >
                {row.label.length > 7 ? `${row.label.slice(0, 6)}…` : row.label}
              </text>
            </g>
          );
        })}
      </svg>
      {series.names.length > 1 ? (
        <figcaption className="flex gap-3 text-[11px] text-slate-600 dark:text-slate-300">
          {series.names.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span aria-hidden className={`h-2 w-2 rounded-sm ${SERIES_SWATCH[i] ?? SERIES_SWATCH[0]}`} />
              {name || `Series ${i + 1}`}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
