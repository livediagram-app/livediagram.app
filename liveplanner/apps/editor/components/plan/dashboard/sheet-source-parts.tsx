'use client';

// What a Dashboard slot's Sheet pickers share (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet", "Sheet
// Chart"): their look, and the project's Sheets to pick from (each its title and its tab's name), fetched as the
// picker opens so every Sheet is offered.
import { useEffect, useMemo } from 'react';
import { tabsStateOf, useDashboard } from './dashboard-context';
import { TabWaiting } from './TabWaiting';
import { projectSheets, useSheetRead, useSheetStore } from './useSheetReader';

export const SECTION =
  'px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
export const ROW =
  'flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-[13px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
export const ON = 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200';
export const FIELD =
  'w-20 rounded-md border border-slate-200 bg-transparent px-2 py-1 text-[12px] uppercase text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:text-slate-200';
export const MUTED_LINE = 'px-1 text-[13px] text-slate-500 dark:text-slate-400';
export const DONE =
  'cursor-pointer rounded-md bg-brand-700 px-3 py-1 text-[12px] font-medium text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700';

// The project's Sheets, every tab fetched, and the one picked read live.
export function useSheetPicker(sheetId: string) {
  const { tabs, tabStatus, loadAllTabs } = useDashboard();
  const { store } = useSheetStore();
  useEffect(() => {
    loadAllTabs?.();
  }, [loadAllTabs]);
  const sheets = useMemo(() => projectSheets(tabs), [tabs]);
  const tabsState = tabsStateOf(tabs, tabStatus);
  const read = useSheetRead(sheetId, tabs, tabsState, loadAllTabs);
  return { tabs, store, sheets, tabsState, retryTabs: loadAllTabs, read };
}

export function SheetList({
  picker,
  sheetId,
  onPick,
}: {
  picker: ReturnType<typeof useSheetPicker>;
  sheetId: string;
  onPick: (sheetId: string) => void;
}) {
  const { sheets, store, tabsState, retryTabs } = picker;
  return (
    <section className="flex flex-col gap-1">
      <h3 className={SECTION}>Sheet</h3>
      {sheets.length === 0 && tabsState === 'failed' && retryTabs ? (
        <TabWaiting name="this plan’s sheets" status="failed" onRetry={retryTabs} />
      ) : sheets.length === 0 ? (
        <p className={MUTED_LINE}>
          {tabsState === 'loading' ? 'Finding this plan’s sheets…' : 'No sheets in this plan yet.'}
        </p>
      ) : (
        sheets.map((s) => (
          <button
            key={s.sheetId}
            type="button"
            aria-pressed={s.sheetId === sheetId}
            onClick={() => onPick(s.sheetId)}
            className={`${ROW} ${s.sheetId === sheetId ? ON : ''}`}
          >
            <span className="truncate font-medium">
              {store?.sheet(s.sheetId)?.title ?? s.tabName}
            </span>
            <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
              {s.tabName}
            </span>
          </button>
        ))
      )}
    </section>
  );
}
