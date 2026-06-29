import { useEffect, useState } from 'react';
import { PIE_PALETTE, type LineSeries, type PieSlice } from '@livediagram/diagram';
import { hexish } from '@/components/palette/palette-controls';

// Pie-chart data editor (spec/53): one row per slice — a colour swatch
// (recolourable), a label, and a value — plus add / remove. Local draft while
// typing; commits the whole array on blur / structural change (one undo step).
export function PieDataEditor({
  slices,
  onChange,
}: {
  slices: PieSlice[];
  onChange: (slices: PieSlice[]) => void;
}) {
  const [rows, setRows] = useState<PieSlice[]>(slices);
  useEffect(() => setRows(slices), [slices]);
  const colorAt = (i: number, s: PieSlice) => s.color ?? PIE_PALETTE[i % PIE_PALETTE.length]!;
  const patch = (i: number, p: Partial<PieSlice>) =>
    setRows((r) => r.map((s, j) => (j === i ? { ...s, ...p } : s)));
  // Compact bordered field for the slice rows. The line editor lives in its own
  // (roomier) dialog now, so this is no longer shared.
  const cellInput =
    'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <label
              className="relative h-4 w-4 shrink-0 cursor-pointer rounded-[3px] border border-slate-300 dark:border-slate-600"
              style={{ backgroundColor: colorAt(i, s) }}
              aria-label="Slice colour"
            >
              <input
                type="color"
                value={hexish(colorAt(i, s))}
                onChange={(e) =>
                  onChange(rows.map((r, j) => (j === i ? { ...r, color: e.target.value } : r)))
                }
                className="absolute h-0 w-0 opacity-0"
              />
            </label>
            <input
              className={`${cellInput} flex-1`}
              value={s.label}
              placeholder="Label"
              onChange={(e) => patch(i, { label: e.target.value })}
              onBlur={() => onChange(rows)}
            />
            <input
              className={`${cellInput} w-12 text-right tabular-nums`}
              type="number"
              min={0}
              value={s.value}
              aria-label="Value"
              onChange={(e) => patch(i, { value: Math.max(0, Number(e.target.value) || 0) })}
              onBlur={() => onChange(rows)}
            />
            <button
              type="button"
              aria-label="Remove slice"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-rose-50 enabled:hover:text-rose-600 disabled:opacity-30 dark:enabled:hover:bg-rose-500/15"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...rows, { label: `Item ${rows.length + 1}`, value: 10 }])}
        className="mt-1.5 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
      >
        + Add slice
      </button>
    </div>
  );
}

// Line-chart data summary (spec/53): the 2-D grid is too wide for the narrow
// menu, so the Data category just lists the series (a colour dot + name) and an
// "Edit data" button that opens the full grid + CSV import in a modal.
export function LineDataSummary({ series, onEdit }: { series: LineSeries[]; onEdit: () => void }) {
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {series.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: s.color ?? PIE_PALETTE[i % PIE_PALETTE.length]! }}
            />
            <span className="truncate">{s.name || `Series ${i + 1}`}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-1.5 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
      >
        Edit data
      </button>
    </div>
  );
}
