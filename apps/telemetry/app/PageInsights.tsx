'use client';

// The Pages tab's small insight cards (spec/150): a single derived number.

const CARD =
  'flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900';

export function PageInsightTile({
  title,
  value,
  unit,
  detail,
}: {
  title: string;
  value: number | null;
  unit?: string;
  detail: string;
}) {
  return (
    <div className={CARD}>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {value === null ? 'n/a' : value.toLocaleString()}
        </span>
        {value !== null && unit ? <span className="text-xs text-slate-400">{unit}</span> : null}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}
