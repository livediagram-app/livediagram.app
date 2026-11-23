'use client';

// The From a Plan dialog's series mapping (liveworkspace/docs/specs/004-index/live-data.md "The element"): one chip per
// series the read holds, pressed while it feeds the element, numbered in the order it feeds it. Pressing an unpicked
// chip adds it at the end; pressing a picked one takes it out (the last one stays). A pie, doughnut, column or bar draws
// the first alone, so the hint says which that is.

// The order the chips stand for: every series in read order when the link names none.
export function seriesOrder(count: number, picked: readonly number[] | undefined): number[] {
  const all = Array.from({ length: count }, (_, i) => i);
  const kept = picked?.filter((i) => i < count) ?? [];
  return kept.length ? kept : all;
}

// The order after pressing `i`: added at the end, or taken out while another stays. Undefined when it is every series
// in read order, as a link that names none reads.
export function toggledSeries(
  count: number,
  picked: readonly number[] | undefined,
  i: number,
): number[] | undefined {
  const order = seriesOrder(count, picked);
  const next = order.includes(i)
    ? order.length > 1
      ? order.filter((x) => x !== i)
      : order
    : [...order, i];
  return next.length === count && next.every((x, k) => x === k) ? undefined : next;
}

export function SeriesChips({
  names,
  picked,
  onChange,
  firstAlone,
}: {
  names: readonly string[];
  picked: readonly number[] | undefined;
  onChange: (next: number[] | undefined) => void;
  // A pie, doughnut, column or bar: it draws the first picked series alone.
  firstAlone: boolean;
}) {
  const all = seriesOrder(names.length, picked);
  // A chart that draws one series shows only that one as picked.
  const order = firstAlone ? all.slice(0, 1) : all;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Series">
        {names.map((name, i) => {
          const at = order.indexOf(i);
          const on = at >= 0;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              onClick={() =>
                // One that draws a single series takes the pressed one alone.
                onChange(
                  firstAlone ? (i === 0 ? undefined : [i]) : toggledSeries(names.length, picked, i),
                )
              }
              className={`inline-flex h-7 max-w-48 cursor-pointer items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none ${
                on
                  ? 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums ${
                  on
                    ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-slate-900'
                    : 'border border-dashed border-slate-300 dark:border-slate-600'
                }`}
              >
                <span className="text-optical-centre">{on ? at + 1 : ''}</span>
              </span>
              <span className="text-optical-centre min-w-0 truncate">
                {name || `Series ${i + 1}`}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {firstAlone
          ? 'This chart draws one series. Press another to draw it instead.'
          : 'The numbered series feed it, in that order. Press one to add or remove it.'}
      </p>
    </div>
  );
}
