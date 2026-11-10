import { HINT_CARD_SURFACE } from '@liveworkspace/ui';
import { changeText, type TooltipRow } from './hover-model';
import { Swatch } from './Swatch';

// The one tooltip every dashboard chart shows for a bucket (liveworkspace/docs/specs/008-telemetry/telemetry.md
// "Tooltips"): the design system's hover-card surface, the bucket as its heading, a row per line (swatch, name,
// count, change), largest first, and the Total under a rule. The emphasised line's row is bold; hovering a row of a
// pinned tooltip emphasises its line.
export function ChartTooltip({
  heading,
  rows,
  total,
  change,
  emphasised,
  onEmphasis,
  hint,
}: {
  heading: string;
  rows: readonly TooltipRow[];
  total: TooltipRow | null;
  change: boolean;
  emphasised: string | null;
  onEmphasis: (key: string | null) => void;
  hint?: string;
}) {
  const row = (r: TooltipRow, isTotal: boolean) => (
    <li
      key={r.key}
      data-row={r.key}
      onPointerEnter={() => onEmphasis(r.key)}
      onPointerLeave={() => onEmphasis(null)}
      className={`flex items-center gap-2 text-xs ${
        emphasised === r.key || isTotal ? 'font-semibold' : ''
      }`}
    >
      {isTotal ? <span aria-hidden className="w-4 shrink-0" /> : <Swatch series={r.series} />}
      <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{r.label}</span>
      <span className="pl-2 font-medium tabular-nums text-slate-900 dark:text-slate-100">
        {r.text}
      </span>
      {change ? (
        <span className="w-10 shrink-0 text-right text-[11px] font-normal tabular-nums text-slate-500 dark:text-slate-400">
          {r.change ? changeText(r.change) : ''}
        </span>
      ) : null}
    </li>
  );
  return (
    <div className={`${HINT_CARD_SURFACE} w-max min-w-48 max-w-72 px-3 py-2`}>
      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{heading}</p>
      <ul className="mt-1.5 space-y-1">{rows.map((r) => row(r, false))}</ul>
      {total ? (
        <ul className="mt-1.5 border-t border-slate-200 pt-1.5 dark:border-slate-700">
          {row(total, true)}
        </ul>
      ) : null}
      {hint ? (
        <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
