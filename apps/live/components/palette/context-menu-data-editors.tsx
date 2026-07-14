import { useEffect, useState } from 'react';
import {
  CHECKLIST_MAX_ITEMS,
  CHECKLIST_MAX_TEXT,
  PIE_PALETTE,
  type ChecklistItem,
  type LineSeries,
  type PieSlice,
} from '@livediagram/diagram';
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

// Checklist rows editor (spec/83): one row per item — a done toggle, the row
// text, and remove — plus add. Same draft-while-typing / commit-on-blur
// contract as PieDataEditor (one undo step per blur / structural change).
export function ChecklistRowsEditor({
  items,
  onChange,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const [rows, setRows] = useState<ChecklistItem[]>(items);
  useEffect(() => setRows(items), [items]);
  const cellInput =
    'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={item.done}
              aria-label={`Row ${i + 1} done`}
              onChange={(e) =>
                onChange(rows.map((r, j) => (j === i ? { ...r, done: e.target.checked } : r)))
              }
              className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand-500"
            />
            <input
              className={`${cellInput} flex-1`}
              value={item.text}
              placeholder="Task"
              maxLength={CHECKLIST_MAX_TEXT}
              onChange={(e) =>
                setRows((r) => r.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)))
              }
              onBlur={() => onChange(rows)}
            />
            <button
              type="button"
              aria-label="Remove row"
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
        disabled={rows.length >= CHECKLIST_MAX_ITEMS}
        onClick={() => onChange([...rows, { text: '', done: false }])}
        className="mt-1.5 inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition enabled:cursor-pointer enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15"
      >
        + Add row
      </button>
    </div>
  );
}

// Code block summary (spec/82): a multi-line editor is too big for the menu,
// so the Code category shows the language + line count and an "Edit code"
// button that opens the modal — the LineDataSummary pattern.
export function CodeSummary({
  code,
  language,
  onEdit,
}: {
  code: string;
  language: string;
  onEdit: () => void;
}) {
  const lineCount = code.trim().length === 0 ? 0 : code.split('\n').length;
  return (
    <div className="px-2 py-1.5">
      <p className="text-[11px] text-slate-700 dark:text-slate-200">
        {lineCount === 0
          ? 'No code yet'
          : `${lineCount} ${lineCount === 1 ? 'line' : 'lines'} · ${language === 'plain' ? 'plain text' : language}`}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="mt-1.5 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
      >
        Edit code
      </button>
    </div>
  );
}
