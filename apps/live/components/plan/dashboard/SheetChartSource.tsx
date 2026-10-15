'use client';

// Choose a Chart (docs/specs/026-plan/plan-tabs.md "Sheet Chart"), an Editor's: a popover of the document's Sheets,
// then, for the Sheet picked, the charts already drawn from it (a copy of one fills the slot) or a new one over a
// range typed as A1, of a type (Bar, Line, Pie). A choice hands the slot its chart element and closes the picker.
import { useMemo, useState } from 'react';
import {
  CHART_TYPE_LABELS,
  CHART_TYPES,
  type ChartType,
  type ShapeElement,
} from '@livediagram/document';
import { CompactEmptyState, lucideGlyph } from '@livediagram/ui';
import { lucideChartColumn } from '@livediagram/icons/lucide';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
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
import {
  NOT_A_RANGE,
  newSlotChart,
  sheetChartLabel,
  sheetChartsOf,
  slotChartFrom,
} from './sheet-chart-choice';

const ChartGlyph = lucideGlyph(lucideChartColumn, 14);

export function SheetChartSource({
  anchor,
  initialSheetId = '',
  onChoose,
  onClose,
}: {
  anchor: HTMLElement;
  // The Sheet the slot's chart reads now (Change Chart), picked to start.
  initialSheetId?: string;
  onChoose: (chart: ShapeElement) => void;
  onClose: () => void;
}) {
  const [sheetId, setSheetId] = useState(initialSheetId);
  const picker = useSheetPicker(sheetId);
  const { read, tabs } = picker;
  const charts = useMemo(() => (sheetId ? sheetChartsOf(tabs, sheetId) : []), [tabs, sheetId]);
  const choose = (chart: ShapeElement) => {
    onChoose(chart);
    onClose();
  };
  return (
    <AnchoredPopover anchor={anchor} name="Choose a Chart" width={320} onClose={onClose}>
      <div className="flex max-h-[min(70vh,32rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <SheetList picker={picker} sheetId={sheetId} onPick={setSheetId} />
        {read.state === 'ready' ? (
          <>
            <section aria-label="Its Charts" className="flex flex-col gap-1">
              <h3 className={SECTION}>Its Charts</h3>
              {charts.length === 0 ? (
                <CompactEmptyState
                  size="small"
                  icon={<ChartGlyph />}
                  title="No charts yet"
                  description="Charts on this sheet show up here; New Chart below makes one."
                />
              ) : (
                charts.map((el) => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => choose(slotChartFrom(el))}
                    className={ROW}
                  >
                    <span className="truncate">{sheetChartLabel(el, read.sheet)}</span>
                  </button>
                ))
              )}
            </section>
            <NewChart sheet={read.sheet} onAdd={choose} />
          </>
        ) : read.state === 'loading' ? (
          <p className={MUTED_LINE}>Loading {read.name}…</p>
        ) : read.state === 'failed' ? (
          <TabWaiting name={read.name} status="failed" onRetry={read.retry} />
        ) : null}
      </div>
    </AnchoredPopover>
  );
}

function NewChart({
  sheet,
  onAdd,
}: {
  sheet: Parameters<typeof newSlotChart>[0];
  onAdd: (chart: ShapeElement) => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<ChartType>('column');
  const [problem, setProblem] = useState(false);
  return (
    <form
      aria-label="New Chart"
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const chart = newSlotChart(sheet, text, kind);
        setProblem(!chart);
        if (chart) onAdd(chart);
      }}
    >
      <h3 className={SECTION}>New Chart</h3>
      <label className="flex items-center gap-2 px-1">
        <span className="w-10 text-[12px] text-slate-500 dark:text-slate-400">Range</span>
        <input
          aria-label="Range"
          value={text}
          placeholder="A1:C6"
          onChange={(e) => {
            setText(e.target.value);
            setProblem(false);
          }}
          className={FIELD.replace('w-20', 'w-28')}
        />
        {problem ? (
          <span role="alert" className="text-[11px] text-red-600 dark:text-red-400">
            {NOT_A_RANGE}
          </span>
        ) : null}
      </label>
      <div className="flex items-center gap-2 px-1">
        <span className="w-10 text-[12px] text-slate-500 dark:text-slate-400">Type</span>
        <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1">
          {CHART_TYPES.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[12px] transition ${kind === k ? `border-brand-400 ${ON} dark:border-brand-500/60` : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              {CHART_TYPE_LABELS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className={DONE}>
          Add Chart
        </button>
      </div>
    </form>
  );
}
