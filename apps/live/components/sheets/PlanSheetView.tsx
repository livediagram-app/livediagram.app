'use client';

// The Sheet element (docs/specs/029-sheets/sheet.md; blueprint sheet-element.md "Editor components"): its sheet from
// the store, drawn as header, toolbar, formula bar, grid and status bar in the board colours of the tab's theme.
// Takes input in Plan mode only; elsewhere it is drawn and moved like any element, and a double-click offers Plan.
// Maximises as a board does: one stable tree inside MaximisableSlot, so nothing is lost either way. Loaded as its
// own chunk, with the engine, only when a Sheet is drawn.
import { useCardTableSync, type CardTablePush } from './useCardTableSync';
import { SheetSetup } from './SheetSetup';
import { usePublishSheetSettings } from './sheet-settings-registry';
import { placeSheetChart } from './sheet-charts';
import { Button } from '@livediagram/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatA1, normaliseRange, formatRange, quoteSheet, single } from '@livediagram/sheets';
import type { ShapeElement } from '@livediagram/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePlan } from '@/components/plan/PlanContext';
import { planOwnColours, planPalette } from '@/components/plan/plan-palette';
import { MaximisableSlot } from '@/components/plan/MaximisedPlanLayer';
import { useBoardMaximised } from '@/hooks/plan/useBoardMaximised';
import { useSheetsBridgeContext } from '@/hooks/sheets/useSheetsBridge';
import { useSheetModel } from './useSheetModel';
import {
  SheetControllerProvider,
  useSheetController,
  useSheetControllerState,
} from './sheet-controller';
import { SheetHeader } from './SheetHeader';
import { SheetToolbar } from './SheetToolbar';
import { SheetFormulaBar } from './SheetFormulaBar';
import { SheetGrid } from './SheetGrid';
import { SheetStatusBar } from './SheetStatusBar';
import { SheetFindBar } from './SheetFindBar';
import { SheetMenus } from './SheetMenus';
import { useSheetActions } from './useSheetActions';
import { useFormulaInput } from './useFormulaInput';
import { insertReference, referenceSlot } from './formula-assist';
import { importCsvText } from './sheet-csv';
import { SheetFace } from './SheetFace';
import type { PointRef } from './useSheetPointer';
import { clearPointingTarget, setPointingTarget } from './sheet-pointing';
import { useLatest } from '@/hooks/ui/useLatest';
import { listenForSheetSelect } from '@/lib/sheet-select-request';

const RADIUS = 12;

export function PlanSheetView({
  element,
  fontFamily,
}: {
  element: ShapeElement;
  fontFamily?: string;
}) {
  const bridge = useSheetsBridgeContext();
  const plan = usePlan();
  const palette = planPalette(useCanvasSurface(), planOwnColours(element));
  const interactive = !!plan?.planInput && !!bridge;
  // Maximised for this person, or filling its tab for everyone (sheet.md "Fill Tab"); filling wins, as a board's.
  const { maximised, filled } = useBoardMaximised(element.id, interactive);
  // Outside the editor (no bridge): the frame and its title only.
  if (!bridge) return <SheetFace palette={palette} title="Sheet" message="" />;
  return (
    <MaximisableSlot
      id={element.id}
      maximised={maximised}
      fill={filled}
      placeholder={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: RADIUS,
        borderWidth: 1,
        borderStyle: 'solid',
      }}
    >
      <SheetBody
        element={element}
        fontFamily={fontFamily}
        // Filling its tab, it lays out as maximised (the header hides Maximise and Focus: useFillsTab).
        maximised={maximised || filled}
        interactive={interactive}
      />
    </MaximisableSlot>
  );
}

function SheetBody({
  element,
  fontFamily,
  maximised,
  interactive,
}: {
  element: ShapeElement;
  fontFamily?: string;
  maximised: boolean;
  interactive: boolean;
}) {
  const bridge = useSheetsBridgeContext()!;
  const plan = usePlan();
  const palette = planPalette(useCanvasSurface(), planOwnColours(element));
  const model = useSheetModel(element, bridge, plan);
  const [hint, setHint] = useState(false);
  if (!model.sheet) {
    const loading = model.status === 'loading' || model.status === undefined;
    return (
      <SheetFace
        palette={palette}
        title="Sheet"
        loading={model.status !== 'error' && (loading || !!element.planSheet?.copyOf)}
        message={
          model.status === 'error'
            ? "Couldn't load this sheet"
            : loading || element.planSheet?.copyOf
              ? 'Opening Sheet'
              : 'This sheet is no longer in this document'
        }
        action={
          model.status === 'error'
            ? { label: 'Try Again', run: () => void model.store.loadTab(bridge.activeTabId, true) }
            : !loading && !element.planSheet?.copyOf && bridge.canEdit
              ? {
                  label: 'Remove',
                  run: () =>
                    bridge.commitElements((els) => els.filter((el) => el.id !== element.id)),
                }
              : undefined
        }
      />
    );
  }
  return (
    <div
      className="absolute inset-0 isolate flex flex-col overflow-hidden border"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        color: palette.text,
        borderRadius: RADIUS,
        ...(fontFamily ? { fontFamily } : {}),
      }}
      onDoubleClick={interactive ? undefined : () => setHint(true)}
    >
      <SheetWorkspace
        element={element}
        model={model}
        palette={palette}
        interactive={interactive}
        canEdit={interactive && bridge.canEdit}
        maximised={maximised}
        fontFamily={fontFamily}
      />
      {hint && !interactive ? (
        <div
          role="dialog"
          aria-label="Switch to Plan"
          className="absolute left-1/2 top-1/2 z-40 w-max max-w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-lg border px-4 py-3 text-[13px] shadow-lg"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p>Switch to Plan to edit this sheet</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setHint(false)}>
              Not Now
            </Button>
            <Button
              variant="primary"
              size="xs"

              onClick={() => {
                setHint(false);
                bridge.switchToPlan();
              }}
            >
              Switch to Plan
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SheetWorkspace({
  element,
  model,
  palette,
  interactive,
  canEdit,
  maximised,
  fontFamily,
}: {
  element: ShapeElement;
  model: ReturnType<typeof useSheetModel>;
  palette: ReturnType<typeof planPalette>;
  interactive: boolean;
  canEdit: boolean;
  maximised: boolean;
  fontFamily?: string;
}) {
  const bridge = useSheetsBridgeContext()!;
  const plan = usePlan();
  // Card tables push this person's writes to the cards (useCardTableSync sets it).
  const cardPush = useRef<CardTablePush | null>(null);
  const setCardPush = useCallback((push: CardTablePush | null) => {
    cardPush.current = push;
  }, []);
  const c = useSheetControllerState({
    store: model.store,
    sheet: model.sheet!,
    workbook: model.workbook,
    version: model.version,
    palette,
    interactive,
    canEdit,
    maximised,
    locale: bridge.locale,
    announce: (m) => plan?.announce(m),
    toast: bridge.toast,
    notify: bridge.notify,
    placeChart: (kind, range) => placeSheetChart(bridge, element, model.sheet!.id, kind, range),
    onWrote: (before, write) => cardPush.current?.(before, write),
  });
  return (
    <SheetControllerProvider value={c}>
      <SheetParts
        setCardPush={setCardPush}
        element={element}
        canEdit={canEdit}
        interactive={interactive}
        fontFamily={fontFamily}
      />
    </SheetControllerProvider>
  );
}

function SheetParts({
  setCardPush,
  element,
  canEdit,
  interactive,
  fontFamily,
}: {
  setCardPush: (push: CardTablePush | null) => void;
  element: ShapeElement;
  canEdit: boolean;
  interactive: boolean;
  fontFamily?: string;
}) {
  const bridge = useSheetsBridgeContext()!;
  const actions = useSheetActions();
  const input = useFormulaInput(actions);
  const c = useSheetController();
  useCardTableSync(c, setCardPush);
  const file = useRef<HTMLInputElement | null>(null);
  const [importText, setImportText] = useState<string | null>(null);
  // Where the last pointed reference sits in the draft, so a drag grows it into a range.
  const pointed = useRef<{ start: number; end: number } | null>(null);
  const pointRef = useCallback<PointRef>(
    (from, to, sheet) => {
      const e = c.editing;
      if (!e || !e.draft.startsWith('=')) return false;
      const slot =
        from.r === to.r && from.c === to.c ? referenceSlot(e.draft, input.caret) : pointed.current;
      if (!slot) return false;
      const cells =
        from.r === to.r && from.c === to.c
          ? formatA1(to.r, to.c)
          : formatRange(normaliseRange(from, to));
      const text = sheet ? `${quoteSheet(sheet)}!${cells}` : cells;
      const next = insertReference(e.draft, slot, text);
      pointed.current = next.slot;
      c.setEditing({ ...e, draft: next.draft });
      input.setCaret(next.caret);
      return true;
    },
    [c, input],
  );
  // While this sheet writes a formula, the tab's other sheets point into it.
  const latestPoint = useLatest(pointRef);
  const latestCaret = useLatest(input.caret);
  const writingFormula = !!c.editing?.draft.startsWith('=');
  useEffect(() => {
    if (!writingFormula) return;
    const id = c.sheet.id;
    setPointingTarget({
      sheetId: id,
      tabId: c.sheet.tabId,
      point: (from, to, sheet) => latestPoint.current(from, to, sheet),
      refocus: () => {
        const el = document.querySelector<HTMLTextAreaElement>(`[data-sheet-editor="${id}"]`);
        if (!el) return;
        el.focus({ preventScroll: true });
        el.setSelectionRange(latestCaret.current, latestCaret.current);
      },
    });
    return () => clearPointingTarget(c.sheet.id);
  }, [writingFormula, c.sheet.id, c.sheet.tabId, latestPoint, latestCaret]);
  const onImportCsv = () => file.current?.click();
  // Setup Sheet (sheet.md "Setup Sheet"): a placed sheet awaiting setup shows it while it has no cells; cells
  // arriving any other way (a peer, an agent, an import) end setup, so a sheet cleared later never shows it again.
  const pending = c.sheet.layout.setupPending === true;
  const settingUp = pending && c.sheet.cells.size === 0 && canEdit && interactive;
  const filled = pending && c.sheet.cells.size > 0 && canEdit;
  useEffect(() => {
    if (filled)
      c.store.write(
        c.sheet.id,
        { kind: 'layout', changes: [{ k: 'options', setupPending: false }] },
        { undoable: false },
      );
  }, [filled, c.store, c.sheet.id]);
  // A cell selected from outside the Sheet (the Plan tour's Formulas step).
  const { setSelection } = c;
  useEffect(
    () => listenForSheetSelect(c.sheet.id, (at) => setSelection(single(at))),
    [c.sheet.id, setSelection],
  );
  // The cog's settings for the element menu's Sheet flyout (sheet-settings-registry).
  usePublishSheetSettings(element.id, { controller: c, actions, onImportCsv });
  const readFile = async (f: File) => {
    const text = await f.text();
    if (c.sheet.cells.size === 0) importCsvText(c, text, 'replace');
    else setImportText(text);
  };
  return (
    <div
      className="contents"
      onFocus={() => c.setFocused(true)}
      onBlur={(e) => {
        // Still within the Sheet (its grid, formula bar, a menu it opened): it keeps the keys.
        const next = e.relatedTarget;
        if (
          next instanceof Element &&
          (e.currentTarget.contains(next) || next.closest('[data-menu-surface]'))
        )
          return;
        c.setFocused(false);
      }}
    >
      <SheetHeader
        elementId={element.id}
        bounds={element}
        actions={actions}
        onImportCsv={onImportCsv}
      />
      {settingUp ? (
        <div className="min-h-0 flex-1">
          <SheetSetup onImportCsv={onImportCsv} />
        </div>
      ) : (
        <>
          {canEdit ? <SheetToolbar actions={actions} /> : null}
          {interactive ? <SheetFormulaBar actions={actions} input={input} /> : null}
          <SheetGrid
            elementId={element.id}
            actions={actions}
            input={input}
            pointRef={pointRef}
            peers={bridge.peers}
            fontFamily={fontFamily}
          />
          {interactive ? <SheetStatusBar /> : null}
        </>
      )}
      {c.findOpen ? <SheetFindBar /> : null}
      {interactive ? <SheetMenus actions={actions} /> : null}
      <input
        ref={file}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void readFile(f);
        }}
      />
      {importText !== null ? (
        <div
          role="dialog"
          aria-label="Import CSV"
          className="absolute left-1/2 top-1/2 z-40 w-72 -translate-x-1/2 -translate-y-1/2 rounded-lg border px-4 py-3 text-[13px] shadow-lg"
          style={{ backgroundColor: c.palette.surface, borderColor: c.palette.border }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="font-semibold">Import CSV</p>
          <p className="mt-1" style={{ color: c.palette.muted }}>
            This sheet already has cells.
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setImportText(null)}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                importCsvText(c, importText, 'insert');
                setImportText(null);
              }}
            >
              Insert at Selection
            </Button>
            <Button
              variant="primary"
              size="xs"

              onClick={() => {
                importCsvText(c, importText, 'replace');
                setImportText(null);
              }}
            >
              Replace Sheet
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
