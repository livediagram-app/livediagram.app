'use client';

// Setup Sheet (docs/specs/029-sheets/sheet.md "Setup Sheet"): the dialog a sheet awaiting setup with no cells opens
// (SetupSheetHost), for this person only. Steps Start From and Style, with Cards and Columns between them for Plan
// Cards; Create Sheet writes the start, the look, the freeze and the sizes as one change. Start Blank and Import CSV
// end setup without a style. Closed before it finishes, its step and picks are kept for when it opens again
// (lib/setup-dialog-store.ts drafts). Loaded on its own, only when opened.
import { useEffect, useMemo, useState } from 'react';
import { Button, CheckIcon, ChevronLeftIcon } from '@liveplanner/ui';
import { chartTypeOf } from '@liveplanner/project';
import { cardSourceOf, findCards, type BoardStatusTypes } from '@liveplanner/items';
import {
  cardsStarter,
  designWrite,
  isSheetTemplateId,
  setupWrite,
  sheetTemplate,
  single,
  TEMPLATE_LOOK,
  type SheetCellSize,
  type SheetLook,
} from '@liveplanner/sheets';
import { usePlan } from '@/components/plan/PlanContext';
import { forgetSetupStart, setupStartOf } from '@/lib/sheet-seeds';
import { useCardSearch } from '@/components/plan/CardSearchControls';
import { SetupDialog, useSetupPalette } from '@/components/plan/SetupDialog';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { dropSetupDraft, readSetupDraft, saveSetupDraft } from '@/lib/setup-dialog-store';
import { track } from '@/lib/telemetry';
import { useSheetController } from './sheet-controller';
import { SheetArt } from './sheet-art';
import {
  CARD_COLUMNS_REQUIRED,
  SheetSetupCards,
  SheetSetupColumns,
  SheetSetupStart,
  columnsForCards,
  type SetupStart,
} from './SheetSetupStart';
import { SheetSetupStyle } from './SheetSetupStyle';

// The wizard's steps: a start from Plan Cards adds Cards (which cards) and Columns (their fields) before Style.
type StepId = 'start' | 'cards' | 'columns' | 'style';
const STEP_LABELS: Record<StepId, string> = {
  start: 'Start From',
  cards: 'Cards',
  columns: 'Columns',
  style: 'Style',
};
// What the dialog keeps when closed before it finishes.
type SheetDraft = {
  step: number;
  start: SetupStart;
  look: SheetLook;
  freeze: boolean;
  size: SheetCellSize;
  columns: string[];
};

const stepsFor = (start: SetupStart): StepId[] =>
  start === 'cards' ? ['start', 'cards', 'columns', 'style'] : ['start', 'style'];

const NO_STATUS_TYPES: BoardStatusTypes = new Map();

// Now, for a template's dates (the Tracker's due dates, the Timesheet's week), read when Create Sheet is pressed.
const todayMs = () => Date.now();

// `Sheet · Created · <Start>` (docs/specs/017-telemetry/telemetry.md): a closed set, one per start.
const TELEMETRY: Record<SetupStart, string> = {
  blank: 'Blank',
  budget: 'Budget',
  tracker: 'Tracker',
  timesheet: 'Timesheet',
  contacts: 'Contacts',
  invoice: 'Invoice',
  expenses: 'ExpenseReport',
  pipeline: 'SalesPipeline',
  inventory: 'Inventory',
  threats: 'ThreatRegister',
  drivers: 'DriverModel',
  'value-stream': 'ValueStream',
  guests: 'GuestList',
  grades: 'GradeBook',
  habits: 'HabitTracker',
  loan: 'LoanCalculator',
  cards: 'Cards',
  csv: 'Csv',
};

// The look Style starts on: a template's own Banded, else Header.
const lookFor = (start: SetupStart | undefined): SheetLook =>
  isSheetTemplateId(start) ? TEMPLATE_LOOK : 'header';

// The card type new rows of an imported table take (sheet.md "Card tables"): the one type the import was filtered
// to, else the type most of its cards have.
export function importType(
  cards: readonly { type: string }[],
  filters: readonly { by: string; key: string }[],
): string {
  const typed = filters.filter((f) => f.by === 'type');
  if (typed.length === 1) return typed[0]!.key;
  const count = new Map<string, number>();
  for (const c of cards) count.set(c.type, (count.get(c.type) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'task';
}

export function SheetSetup({
  onImportCsv,
  onClose,
  onFinish,
  returnFocus,
  open = true,
}: {
  onImportCsv: () => void;
  // Not now, Close, Escape or the backdrop: the sheet stays awaiting setup.
  onClose: () => void;
  // Called just before this person's own write that ends setup; the dialog closes with it.
  onFinish: () => void;
  returnFocus?: () => void;
  open?: boolean;
}) {
  const c = useSheetController();
  const plan = usePlan();
  const palette = useSetupPalette();
  // The tints follow the canvas surface at the moment of setup, whatever the app's look.
  const dark = useCanvasSurface() === 'dark';
  const sheetId = c.sheet.id;
  const [draft] = useState(() => readSetupDraft<SheetDraft>(sheetId));
  // Placed from Start Planning as a sheet type (Card Table, Budget, Tracker): that start, a step in.
  const preset = draft ? undefined : setupStartOf(sheetId);
  const [step, setStep] = useState(draft?.step ?? (preset ? 1 : 0));
  const [start, setStartOnly] = useState<SetupStart>(draft?.start ?? preset ?? 'blank');
  const [look, setLook] = useState<SheetLook>(draft?.look ?? lookFor(preset));
  // A new start brings its own first look (a template's Banded).
  const setStart = (s: SetupStart) => {
    setStartOnly(s);
    setLook(lookFor(s));
  };
  const [freeze, setFreeze] = useState(draft?.freeze ?? !!preset);
  useEffect(() => forgetSetupStart(sheetId), [sheetId]);
  const [size, setSize] = useState<SheetCellSize>(draft?.size ?? 'default');
  const [columns, setColumns] = useState<string[]>(
    () => draft?.columns ?? [...CARD_COLUMNS_REQUIRED],
  );
  // Kept as it changes, so a close by any way leaves it ready for next time.
  useEffect(() => {
    saveSetupDraft(sheetId, { step, start, look, freeze, size, columns } satisfies SheetDraft);
  }, [sheetId, step, start, look, freeze, size, columns]);
  const boardStatuses = plan?.statusTypes ?? NO_STATUS_TYPES;
  const live = useMemo(
    () => findCards(plan?.items.values() ?? [], { query: '', show: 'all', boardStatuses }),
    [plan?.items, boardStatuses],
  );
  const search = useCardSearch(
    plan ?? { items: new Map(), types: [], statusNames: new Map() },
    live,
    { boardStatuses },
  );

  // This person ends setup: no draft to keep, and no news when the sheet stops awaiting it.
  const finish = () => {
    dropSetupDraft(sheetId);
    onFinish();
  };
  // Setup ends without a style: the sheet no longer awaits it (not an undo step; nothing on the grid changed).
  const done = () => {
    finish();
    c.store.write(
      c.sheet.id,
      { kind: 'layout', changes: [{ k: 'options', setupPending: false }] },
      { undoable: false },
    );
  };
  const create = () => {
    if (isSheetTemplateId(start)) {
      const made = designWrite(c.workbook, c.sheet.id, sheetTemplate(start, todayMs()), {
        look,
        freezeHeader: freeze,
        size,
        dark,
      });
      if (!made) return;
      finish();
      if (!c.write(made.write, 'Setup')) return;
      track('Sheet', 'Created', TELEMETRY[start]);
      // The template's charts, over its cells (each one undo step, as Insert Chart's).
      for (const ch of made.charts)
        c.placeChart?.(
          chartTypeOf({ shape: ch.kind })!,
          { range: ch.range, ...(ch.cols ? { cols: ch.cols } : {}) },
          ch.anchor,
          {
            size: { width: ch.width, height: ch.height },
            palette: ch.palette,
            template: true,
          },
        );
      c.setSelection(single({ r: 0, c: 0 }));
      c.focusGrid();
      return;
    }
    const starter =
      start === 'cards' && plan
        ? (() => {
            const cards = [...search.found].sort((a, b) => a.key - b.key);
            const source = cardSourceOf(cards, plan.types, { statusNames: plan.statusNames });
            return cardsStarter(
              chosen,
              cards,
              (card, f) => source.fieldOf(card, f),
              importType(cards, search.filters),
            );
          })()
        : null;
    const write = setupWrite(c.workbook, c.sheet.id, {
      start: starter,
      look,
      freezeHeader: freeze && !!starter,
      size,
      dark,
    });
    if (!write) return;
    finish();
    if (c.write(write, 'Setup')) {
      track('Sheet', 'Created', TELEMETRY[start]);
      c.setSelection(single({ r: 0, c: 0 }));
      c.focusGrid();
    }
  };
  const steps = stepsFor(start);
  const at = Math.min(step, steps.length - 1);
  const current = steps[at]!;
  const next = () => {
    if (start === 'csv') {
      track('Sheet', 'Created', TELEMETRY.csv);
      done();
      onImportCsv();
      return;
    }
    // Blank styles nothing but its gridlines and sizes, and has no header to freeze.
    if (current === 'start') setFreeze(start !== 'blank');
    setStep(at + 1);
  };
  const cardsEmpty = current === 'cards' && search.found.length === 0;
  // The columns the cards found can fill; a pick their types no longer have is dropped.
  const offered = useMemo(
    () => columnsForCards(search.found, plan?.types ?? []),
    [search.found, plan?.types],
  );
  const chosen = columns.filter((x) => offered.includes(x));
  const nextLabel =
    start === 'csv' && current === 'start'
      ? 'Choose File…'
      : `Next: ${STEP_LABELS[steps[at + 1] ?? 'style']}`;

  const primary = current === 'style' ? create : cardsEmpty ? undefined : next;
  const startBlank = () => {
    track('Sheet', 'Created', TELEMETRY.blank);
    done();
    c.focusGrid();
  };

  return (
    <SetupDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      titleId={`setup-sheet-${sheetId}`}
      title="Set up your sheet"
      line="Start from a layout, your cards or a blank grid. Everything can change later from its cog."
      icon={<SheetArt size={20} />}
      help="planSheets"
      palette={palette}
      wide
      steps={steps.map((id) => ({ label: STEP_LABELS[id] }))}
      at={at}
      onStep={setStep}
      onPrimary={primary}
      footer={
        <>
          {at > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setStep(at - 1)}>
              <ChevronLeftIcon size={12} />
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={startBlank}>
              Start Blank
            </Button>
          )}
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Not now
            </Button>
            {current !== 'style' ? (
              <Button variant="primary" size="sm" disabled={cardsEmpty} onClick={next}>
                {nextLabel}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={create}>
                <CheckIcon size={12} />
                Create Sheet
              </Button>
            )}
          </span>
        </>
      }
    >
      {current === 'start' ? (
        <SheetSetupStart
          palette={palette}
          start={start}
          onStart={setStart}
          plan={plan}
          live={live}
        />
      ) : current === 'cards' && plan ? (
        <SheetSetupCards palette={palette} plan={plan} live={live} search={search} />
      ) : current === 'columns' ? (
        <SheetSetupColumns
          palette={palette}
          offered={offered}
          columns={chosen}
          onColumns={setColumns}
        />
      ) : (
        <SheetSetupStyle
          palette={palette}
          look={look}
          onLook={setLook}
          freeze={freeze}
          onFreeze={setFreeze}
          size={size}
          onSize={setSize}
          hasRows={start !== 'blank'}
        />
      )}
    </SetupDialog>
  );
}
