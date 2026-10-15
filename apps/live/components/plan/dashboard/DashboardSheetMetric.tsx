'use client';

// A figure from a Sheet in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet"): a Sheet Figure
// (one cell, large, with a bar toward its target), a Column Summary (a column's total, average, lowest, highest or
// count, a sparkline under it) or a Trend (a column's latest number, its change from the one before, a sparkline), read
// live from the sheet, as the sheet formats it. Until its source is chosen it offers Choose a Sheet; once chosen, an
// Editor changes it from Change Source in the slot's cog (SlotSection). Anyone may read it.
import { useMemo, useRef, useState } from 'react';
import type { SheetMetricContent } from '@livediagram/document';
import { percentDone } from '@livediagram/plan-art';
import { lucideGlyph } from '@livediagram/ui';
import { lucideTable } from '@livediagram/icons/lucide';
import { tabsStateOf, useDashboard } from './dashboard-context';
import { TabWaiting } from './TabWaiting';
import { Missing, useBoxSize } from './DashboardSlotContent';
import { SheetMetricSource } from './SheetMetricSource';
import { useSheetRead } from './useSheetReader';
import { sheetMetricShown } from './sheet-metric-shown';
import { SHEET_METRIC_NAMES } from '@/components/palette/palette-dashboard-tiles';

const SheetGlyph = lucideGlyph(lucideTable, 15);

const GREEN = 'text-emerald-600 dark:text-emerald-400';
const RED = 'text-red-600 dark:text-red-400';
const MUTED = 'text-slate-500 dark:text-slate-400';

function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`)
    .join(' ');
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="h-8 w-full text-brand-500 dark:text-brand-400"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DashboardSheetMetric({
  slotId,
  content,
}: {
  slotId: string;
  content: SheetMetricContent;
}) {
  // Measured on a box every state draws, so the size is there once the figure arrives after Loading.
  const boxRef = useRef<HTMLDivElement>(null);
  const size = useBoxSize(boxRef);
  return (
    <div ref={boxRef} className="h-full">
      <SheetMetricBody slotId={slotId} content={content} size={size} />
    </div>
  );
}

function SheetMetricBody({
  slotId,
  content,
  size,
}: {
  slotId: string;
  content: SheetMetricContent;
  size: { width: number; height: number } | null;
}) {
  const { tabs, tabStatus, canEdit, actions, loadAllTabs } = useDashboard();
  const read = useSheetRead(content.sheetId, tabs, tabsStateOf(tabs, tabStatus), loadAllTabs);
  const [pickerAt, setPickerAt] = useState<HTMLElement | null>(null);
  // The workbook changes in place: the store's version says when it is to be read again.
  const version = read.state === 'ready' ? read.version : -1;
  const sheet = read.state === 'ready' ? read.sheet : null;
  const shown = useMemo(
    () => (read.state === 'ready' ? sheetMetricShown(content, read) : null),
    // oxlint-disable-next-line react-hooks-js/exhaustive-deps
    [content, version, sheet],
  );
  const name = SHEET_METRIC_NAMES[content.metric];
  const picker = pickerAt ? (
    <SheetMetricSource
      anchor={pickerAt}
      content={content}
      onChange={(next) => actions.setSlotContent(slotId, next)}
      onClose={() => setPickerAt(null)}
    />
  ) : null;
  const choose = (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(e) => setPickerAt(e.currentTarget)}
      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:text-brand-300"
    >
      Choose a Sheet
    </button>
  );
  if (read.state === 'gone') return <Missing message="This sheet was deleted." slotId={slotId} />;
  if (read.state === 'none' || shown === 'unset')
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{name}</span>
        {canEdit ? choose : <span className={`text-[12px] ${MUTED}`}>Waiting for its sheet.</span>}
        {picker}
      </div>
    );
  if (read.state === 'failed')
    return <TabWaiting name={read.name} status="failed" onRetry={read.retry} />;
  if (read.state === 'loading' || !shown)
    return (
      <p aria-live="polite" className={`p-4 text-[13px] ${MUTED}`}>
        Loading {read.state === 'loading' ? read.name : 'the sheet'}…
      </p>
    );
  if (shown === 'cell-gone')
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <span className={`text-[13px] ${MUTED}`}>The cell it read was deleted.</span>
        {canEdit ? choose : null}
        {picker}
      </div>
    );
  const compact = (size?.height ?? 200) < 150;
  const heroPx = Math.max(
    24,
    Math.min(56, Math.round(Math.min(size?.width ?? 240, (size?.height ?? 160) * 1.6) / 6)),
  );
  return (
    <div
      role="group"
      aria-label={`${shown.label}: ${shown.hero}${shown.progress ? ` of ${shown.progress.of}` : ''}`}
      className="relative flex h-full flex-col gap-2 overflow-hidden p-4"
    >
      <div className="flex min-w-0 items-center gap-2 pr-10">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
        >
          <SheetGlyph />
        </span>
        <span
          className={`min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider ${MUTED}`}
        >
          {shown.label}
        </span>
      </div>
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className="font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-slate-50"
          style={{ fontSize: heroPx }}
        >
          {shown.hero}
        </span>
        {shown.progress ? (
          <span className={`truncate text-[13px] ${MUTED}`}>of {shown.progress.of}</span>
        ) : null}
      </div>
      {shown.change ? (
        <span
          className={`text-[12px] font-medium tabular-nums ${shown.change.dir === 'up' ? GREEN : shown.change.dir === 'down' ? RED : MUTED}`}
        >
          {shown.change.text}
        </span>
      ) : null}
      {shown.progress ? (
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-[width] duration-short motion-reduce:transition-none ${shown.progress.met ? 'bg-emerald-500' : 'bg-brand-500'}`}
              style={{ width: `${shown.progress.share * 100}%` }}
            />
          </div>
          <span
            className={`text-[12px] font-medium tabular-nums ${shown.progress.met ? GREEN : MUTED}`}
          >
            {percentDone(shown.progress.share, 1)}%
          </span>
        </div>
      ) : null}
      {shown.spark && !compact ? (
        <div className="mt-auto">
          <Sparkline values={shown.spark} />
        </div>
      ) : null}
      {compact ? null : <span className={`truncate text-[11px] ${MUTED}`}>{shown.line}</span>}
      {picker}
    </div>
  );
}
