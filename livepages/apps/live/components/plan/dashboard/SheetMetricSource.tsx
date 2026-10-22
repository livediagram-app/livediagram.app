'use client';

// A figure from a Sheet's source (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet"), an Editor's: a popover of
// the document's Sheets, then, for a Sheet Figure, its labelled numbers or a cell typed as A1 and an optional target the
// same way; for a Column Summary or a Trend, the columns holding numbers (and a summary's stat). Each choice lands as
// one step; the popover closes once the source is whole.
import { useMemo, useState } from 'react';
import {
  COLUMN_STAT_NAMES,
  COLUMN_STATS,
  a1OfRef,
  cellRefFromA1,
  figureSuggestions,
  numberColumns,
  type SheetCellRef,
} from '@livepages/sheets';
import type { SheetMetricContent } from '@livepages/document';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { useSheetRead } from './useSheetReader';
import {
  DONE,
  FIELD,
  MUTED_LINE,
  ON,
  ROW,
  SECTION,
  SheetList,
  useSheetPicker,
} from './sheet-source-parts';
import { TabWaiting } from './TabWaiting';

export function SheetMetricSource({
  anchor,
  content,
  onChange,
  onClose,
}: {
  anchor: HTMLElement;
  content: SheetMetricContent;
  onChange: (next: SheetMetricContent) => void;
  onClose: () => void;
}) {
  const picker = useSheetPicker(content.sheetId);
  const { read } = picker;
  const set = (patch: Partial<SheetMetricContent>) => onChange({ ...content, ...patch });
  const pickSheet = (sheetId: string) => {
    if (sheetId === content.sheetId) return;
    // Another sheet: its cells and columns are its own, so what was chosen on the last goes.
    onChange({ type: 'sheet-metric', metric: content.metric, sheetId });
  };
  return (
    <AnchoredPopover anchor={anchor} name="Choose a Sheet" width={320} onClose={onClose}>
      <div className="flex max-h-[min(70vh,32rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <SheetList picker={picker} sheetId={content.sheetId} onPick={pickSheet} />
        {read.state === 'ready' ? (
          content.metric === 'figure' ? (
            <FigureSource read={read} content={content} set={set} onDone={onClose} />
          ) : (
            <ColumnSource read={read} content={content} set={set} onDone={onClose} />
          )
        ) : read.state === 'loading' ? (
          <p className={MUTED_LINE}>Loading {read.name}…</p>
        ) : read.state === 'failed' ? (
          <TabWaiting name={read.name} status="failed" onRetry={read.retry} />
        ) : null}
      </div>
    </AnchoredPopover>
  );
}

type Ready = Extract<ReturnType<typeof useSheetRead>, { state: 'ready' }>;

function CellPicker({
  read,
  label,
  value,
  onPick,
}: {
  read: Ready;
  label: string;
  value: SheetCellRef | undefined;
  onPick: (ref: SheetCellRef | undefined) => void;
}) {
  const suggestions = useMemo(
    () => figureSuggestions(read.wb, read.sheet, read.locale),
    // The workbook changes in place: the store's version says when.
    // oxlint-disable-next-line react/exhaustive-deps
    [read.wb, read.sheet, read.locale, read.version],
  );
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState(false);
  const current = value ? a1OfRef(read.sheet, value) : null;
  return (
    <section className="flex flex-col gap-1">
      <h3 className={SECTION}>{label}</h3>
      {suggestions.map((f) => {
        const on = !!value && value.r === f.ref.r && value.c === f.ref.c;
        return (
          <button
            key={`${f.ref.r}:${f.ref.c}`}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(f.ref)}
            className={`${ROW} ${on ? ON : ''}`}
          >
            <span className="truncate">{f.label}</span>
            <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
              {f.text} · {f.a1}
            </span>
          </button>
        );
      })}
      <form
        className="flex items-center gap-2 px-1 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          const ref = cellRefFromA1(read.sheet, typed);
          setProblem(!ref);
          if (ref) onPick(ref);
        }}
      >
        <span className="text-[12px] text-slate-500 dark:text-slate-400">Or a cell</span>
        <input
          aria-label={`${label} cell`}
          value={typed}
          placeholder={current ?? 'B6'}
          onChange={(e) => {
            setTyped(e.target.value);
            setProblem(false);
          }}
          className={FIELD}
        />
        {problem ? (
          <span role="alert" className="text-[11px] text-red-600 dark:text-red-400">
            Not a cell on this sheet
          </span>
        ) : null}
      </form>
    </section>
  );
}

function FigureSource({
  read,
  content,
  set,
  onDone,
}: {
  read: Ready;
  content: SheetMetricContent;
  set: (patch: Partial<SheetMetricContent>) => void;
  onDone: () => void;
}) {
  return (
    <>
      <CellPicker
        read={read}
        label="Figure"
        value={content.cell}
        onPick={(cell) => set({ cell })}
      />
      {content.cell ? (
        <>
          <CellPicker
            read={read}
            label="Target (Optional)"
            value={content.target}
            onPick={(target) => set({ target })}
          />
          <div className="flex justify-end gap-2">
            {content.target ? (
              <button
                type="button"
                onClick={() => {
                  const { target: _drop, ...rest } = content;
                  set({ ...rest, target: undefined });
                }}
                className="cursor-pointer rounded-md px-2.5 py-1 text-[12px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                No Target
              </button>
            ) : null}
            <button type="button" onClick={onDone} className={DONE}>
              Done
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}

function ColumnSource({
  read,
  content,
  set,
  onDone,
}: {
  read: Ready;
  content: SheetMetricContent;
  set: (patch: Partial<SheetMetricContent>) => void;
  onDone: () => void;
}) {
  const columns = useMemo(
    () => numberColumns(read.wb, read.sheet),
    // oxlint-disable-next-line react/exhaustive-deps
    [read.wb, read.sheet, read.version],
  );
  return (
    <>
      <section className="flex flex-col gap-1">
        <h3 className={SECTION}>Column</h3>
        {columns.length === 0 ? (
          <p className={MUTED_LINE}>This sheet has no column of numbers yet.</p>
        ) : (
          columns.map((col) => (
            <button
              key={col.c}
              type="button"
              aria-pressed={content.col === col.c}
              onClick={() => {
                set({
                  col: col.c,
                  ...(content.metric === 'summary' ? { stat: content.stat ?? 'sum' } : {}),
                });
                if (content.metric === 'trend') onDone();
              }}
              className={`${ROW} ${content.col === col.c ? ON : ''}`}
            >
              <span className="truncate">{col.label}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {col.values.length} {col.values.length === 1 ? 'number' : 'numbers'}
              </span>
            </button>
          ))
        )}
      </section>
      {content.metric === 'summary' && content.col ? (
        <section className="flex flex-col gap-1.5">
          <h3 className={SECTION}>Show</h3>
          <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1">
            {COLUMN_STATS.map((s) => {
              const on = (content.stat ?? 'sum') === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ stat: s })}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[12px] transition ${on ? 'border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-500/60 dark:bg-brand-500/15 dark:text-brand-200' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  {COLUMN_STAT_NAMES[s]}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onDone} className={DONE}>
              Done
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
