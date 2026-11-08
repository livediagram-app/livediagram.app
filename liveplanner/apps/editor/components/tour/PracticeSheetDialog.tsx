'use client';

// The Sheets track of the Plan tour, Five Small Wins (docs/specs/026-plan/plan-tour.md "Sheets: Five Small Wins"): the
// practice sheet, a real Sheet (its toolbar, formula bar, grid and menus) over a store that never reaches the server,
// in a dialog of its own, with five challenges in the mission strip at its foot. The current challenge's cells glow,
// and turn green once it is done. The person's own sheet is never touched; Keep This Sheet copies the practice sheet
// into a new Sheet tab.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createShape, newPlanSheetId, type Tab } from '@liveplanner/project';
import { layoutIndex } from '@liveplanner/sheets';
import { Button, Dialog, DialogCloseButton, useMediaQuery } from '@liveplanner/ui';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { planPalette } from '@/components/plan/plan-palette';
import { SheetCellMarksContext, type CellMark } from '@/components/sheets/sheet-cell-marks';
import {
  SheetControllerProvider,
  useSheetController,
  useSheetControllerState,
} from '@/components/sheets/sheet-controller';
import type { ChartPick } from '@/components/sheets/sheet-charts';
import { SheetFormulaBar } from '@/components/sheets/SheetFormulaBar';
import { SheetGrid } from '@/components/sheets/SheetGrid';
import { SheetMenus } from '@/components/sheets/SheetMenus';
import { SheetToolbar } from '@/components/sheets/SheetToolbar';
import type { SheetStore } from '@/components/sheets/sheet-store-client';
import { useFormulaInput } from '@/components/sheets/useFormulaInput';
import { useFormulaPointRef } from '@/components/sheets/useFormulaPointRef';
import { useSheetActions } from '@/components/sheets/useSheetActions';
import type { ItemUndoStep } from '@/hooks/plan/item-undo-journal';
import { stashSheetSeeds } from '@/lib/sheet-seeds';
import { track } from '@/lib/telemetry';
import { MissionStrip } from './MissionStrip';
import { useMissions } from './missions';
import { LearnMore } from './LearnMore';
import { FINISH_STEP, planTourStepTelemetryType, sheetMissions } from './plan-tour-steps';
import {
  keptSheetSeed,
  practiceSheetCtx,
  PRACTICE_TITLE,
  startPracticeSheet,
} from './practice-sheet';
import { PracticeChart, type PracticeSeries } from './PracticeChart';

type Practice = { store: SheetStore; tabId: string; sheetId: string };

export function PracticeSheetDialog({
  onEnd,
}: {
  onEnd: (end: { outcome: 'completed' | 'skipped'; kept: boolean }) => void;
}) {
  const ctx = useEditorContext();
  const [practice, setPractice] = useState<Practice | null>(null);
  // The practice sheet's own undo (its writes are never the plan's): ⌘Z / Ctrl+Z inside the dialog.
  const undo = useRef<{ done: ItemUndoStep[]; undone: ItemUndoStep[] }>({ done: [], undone: [] });
  // The Sheet toolbar's dropdowns are drawn above the dialog while it is open (globals.css).
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-practice-sheet-open', '');
    return () => root.removeAttribute('data-practice-sheet-open');
  }, []);

  // One practice sheet a run: the bridge is read when used, so a new one each render never starts another.
  const bridge = useLatest(ctx.sheetsBridge);
  useEffect(() => {
    let live = true;
    void startPracticeSheet(bridge.current.locale, {
      undo: (step) => {
        undo.current.done.push(step);
        undo.current.undone = [];
      },
      toast: (message) => bridge.current.toast(message),
    }).then((p) => live && setPractice(p));
    return () => {
      live = false;
    };
  }, [bridge]);

  return (
    <Dialog
      open
      onClose={() => onEnd({ outcome: 'skipped', kept: false })}
      ariaLabel="Practice Sheet"
      size="3xl"
      // The Sheet holds Escape (it cancels a cell's edit): only the close button ends the practice.
      closeOnEscape={false}
      initialFocus="container"
      className="flex h-[min(46rem,calc(100dvh-3rem))] flex-col max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        onKeyDownCapture={(e) => {
          const key = e.key.toLowerCase();
          if (!(e.metaKey || e.ctrlKey) || (key !== 'z' && key !== 'y')) return;
          const redo = key === 'y' || e.shiftKey;
          const from = redo ? undo.current.undone : undo.current.done;
          const step = from.pop();
          e.preventDefault();
          e.stopPropagation();
          if (!step) return;
          if (redo) {
            step.redo();
            undo.current.done.push(step);
          } else {
            step.undo();
            undo.current.undone.push(step);
          }
        }}
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 pb-3 pt-4 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">
              Practice Sheet
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
              A small budget to practise on. Nothing here is saved unless you keep it.
            </p>
          </div>
          <DialogCloseButton compact onClick={() => onEnd({ outcome: 'skipped', kept: false })} />
        </div>
        {practice ? (
          <PracticeBody practice={practice} onEnd={onEnd} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-slate-500 dark:text-slate-400">
            Setting out the sheet…
          </div>
        )}
      </div>
    </Dialog>
  );
}

function PracticeBody({
  practice,
  onEnd,
}: {
  practice: Practice;
  onEnd: (end: { outcome: 'completed' | 'skipped'; kept: boolean }) => void;
}) {
  const ctx = useEditorContext();
  const { store, tabId, sheetId } = practice;
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  const sheet = store.sheet(sheetId)!;
  const workbook = store.workbook(tabId);
  const palette = planPalette(useCanvasSurface());
  const touch = useMediaQuery('(pointer: coarse)');
  // The chart the person made: drawn in the strip from the cells they picked (a plan places it beside the sheet).
  const [chart, setChart] = useState<PracticeSeries | null>(null);
  const c = useSheetControllerState({
    store,
    sheet,
    workbook,
    version,
    palette,
    interactive: true,
    canEdit: true,
    canShape: true,
    maximised: true,
    locale: ctx.sheetsBridge.locale,
    announce: () => {},
    toast: (m) => ctx.sheetsBridge.toast(m),
    notify: (m) => ctx.sheetsBridge.notify(m),
    placeChart: (_type, pick) => setChart(seriesOf(store, sheetId, tabId, pick)),
    chartsRemoval: () => null,
  });

  const missions = useMemo(() => sheetMissions(touch), [touch]);
  // Read afresh each render (a new version is a new sheet to read): the checks are a handful of cell reads.
  const check = practiceSheetCtx(
    sheet,
    (r, col) => workbook.value(sheetId, r, col),
    chart !== null,
  );
  const run = useMissions({
    missions,
    ctx: check,
    active: true,
    onView: (m) => track('UI', 'View', planTourStepTelemetryType(m.id)),
  });
  useEffect(() => {
    if (run.phase === 'finish') track('UI', 'View', planTourStepTelemetryType(FINISH_STEP.id));
  }, [run.phase]);

  // The current challenge's cells glow; once it is done, they are green.
  const current = run.mission ? missions.find((m) => m.id === run.mission!.id) : null;
  const marks = useMemo(() => {
    const out = new Map<string, CellMark>();
    if (current)
      for (const a1 of current.cells) out.set(a1, run.phase === 'lesson' ? 'ok' : 'glow');
    return out;
  }, [current, run.phase]);

  const keep = () => {
    track('UI', 'Selected', 'PlanTourKeepSheet');
    const seed = keptSheetSeed(store.sheet(sheetId)!);
    stashSheetSeeds([seed], { keepTitle: true });
    const tab: Tab = {
      id: crypto.randomUUID(),
      name: PRACTICE_TITLE,
      elements: [
        {
          ...createShape('plan-sheet', 0, 0),
          planSheet: { sheetId: newPlanSheetId(), copyOf: seed.id },
        },
      ],
      defaultTextSize: 'sm',
      kind: 'sheet',
    };
    const id = ctx.planTabs.addTabAfter(tab);
    onEnd({ outcome: 'completed', kept: true });
    ctx.setActiveId(id);
  };

  return (
    <SheetCellMarksContext.Provider value={marks}>
      <SheetControllerProvider value={c}>
        <div
          data-practice-sheet=""
          className="relative flex min-h-0 flex-1 flex-col"
          style={{ backgroundColor: palette.surface, color: palette.text }}
        >
          <PracticeParts />
        </div>
      </SheetControllerProvider>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <MissionStrip
          name="Five Small Wins"
          placement="dialog"
          run={run}
          onEnd={() => onEnd({ outcome: 'skipped', kept: false })}
          finish={
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
                    Five for five.
                  </h3>
                  <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                    Keep this sheet as a tab in your plan, or let it go.
                  </p>
                </div>
                {chart ? <PracticeChart series={chart} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => onEnd({ outcome: 'completed', kept: false })}>
                  Done
                </Button>
                <Button variant="secondary" size="sm" onClick={keep}>
                  Keep This Sheet
                </Button>
                <span className="flex-1" />
                <LearnMore href="/help/plan/sheets/" />
              </div>
            </div>
          }
          note={null}
        />
        {chart && run.phase !== 'finish' ? (
          <div className="mt-2 flex justify-end">
            <PracticeChart series={chart} />
          </div>
        ) : null}
      </div>
    </SheetCellMarksContext.Provider>
  );
}

// The Sheet's working parts, under its controller: the toolbar, the formula bar, the grid and its menus.
function PracticeParts() {
  const c = useSheetController();
  const actions = useSheetActions();
  const input = useFormulaInput(actions);
  const pointRef = useFormulaPointRef(c, input);
  return (
    <>
      <SheetToolbar actions={actions} />
      <SheetFormulaBar actions={actions} input={input} />
      <SheetGrid
        elementId={`practice-${c.sheet.id}`}
        actions={actions}
        input={input}
        pointRef={pointRef}
        peers={[]}
        zoom={1}
      />
      <SheetMenus actions={actions} />
    </>
  );
}

// A cell's value as a label: words and numbers as they are, anything else (an error, empty) as nothing.
const shown = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' ? String(v) : '';

// The picked cells as a chart's series: the first column's words as labels, up to two columns of numbers.
function seriesOf(
  store: SheetStore,
  sheetId: string,
  tabId: string,
  pick: ChartPick,
): PracticeSeries {
  const sheet = store.sheet(sheetId)!;
  const wb = store.workbook(tabId);
  const ix = layoutIndex(sheet.layout);
  const r1 = ix.rowPos.get(pick.range.r1) ?? 0;
  const r2 = ix.rowPos.get(pick.range.r2) ?? r1;
  const c1 = ix.colPos.get(pick.range.c1) ?? 0;
  const c2 = ix.colPos.get(pick.range.c2) ?? c1;
  const cols = Array.from({ length: c2 - c1 + 1 }, (_, i) => c1 + i);
  const headed = typeof wb.value(sheetId, r1, cols.find((c) => c !== c1) ?? c1) === 'string';
  const first = headed ? r1 + 1 : r1;
  const labelCol = typeof wb.value(sheetId, first, c1) === 'string' ? c1 : null;
  const numberCols = cols.filter((c) => c !== labelCol).slice(0, 2);
  const rows = Array.from({ length: Math.max(0, r2 - first + 1) }, (_, i) => first + i);
  return {
    names: numberCols.map((c) => (headed ? shown(wb.value(sheetId, r1, c)) : '')),
    rows: rows.map((r) => ({
      label: labelCol === null ? '' : shown(wb.value(sheetId, r, labelCol)),
      values: numberCols.map((c) => {
        const v = wb.value(sheetId, r, c);
        return typeof v === 'number' ? v : 0;
      }),
    })),
  };
}
