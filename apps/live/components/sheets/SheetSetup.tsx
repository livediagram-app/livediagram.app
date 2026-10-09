'use client';

// Setup Sheet (docs/specs/029-sheets/sheet.md "Setup Sheet"): a sheet placed from the palette shows this in place of
// its grid while it awaits setup and has no cells. Steps Start From and Style, with Cards and Columns between them for
// Plan Cards; Create Sheet writes the start, the look, the freeze and the sizes as one change. Start Blank and Import
// CSV end setup without a style.
import { useEffect, useMemo, useState } from 'react';
import { Button, CheckIcon, ChevronLeftIcon } from '@livediagram/ui';
import { cardSourceOf, findCards, type BoardStatusTypes } from '@livediagram/items';
import {
  cardsStarter,
  setupWrite,
  sheetStarter,
  single,
  type SheetCellSize,
  type SheetLook,
} from '@livediagram/sheets';
import { usePlan } from '@/components/plan/PlanContext';
import { forgetSetupStart, setupStartOf } from '@/lib/sheet-seeds';
import { useCardSearch } from '@/components/plan/CardSearchControls';
import { SetupCard } from '@/components/plan/SetupCard';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
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
const stepsFor = (start: SetupStart): StepId[] =>
  start === 'cards' ? ['start', 'cards', 'columns', 'style'] : ['start', 'style'];

const NO_STATUS_TYPES: BoardStatusTypes = new Map();

// Now, for a start's dates (the Tracker's due dates), read when Create Sheet is pressed.
const todayMs = () => Date.now();

const TELEMETRY: Record<SetupStart, string> = {
  blank: 'Blank',
  budget: 'Budget',
  tracker: 'Tracker',
  timesheet: 'Timesheet',
  contacts: 'Contacts',
  cards: 'Cards',
  csv: 'Csv',
};

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

export function SheetSetup({ onImportCsv }: { onImportCsv: () => void }) {
  const c = useSheetController();
  const plan = usePlan();
  const dark = useCanvasSurface() === 'dark';
  // Placed from Start Planning as a sheet type (Card Table, Budget, Tracker): that start, a step in.
  const preset = setupStartOf(c.sheet.id);
  const [step, setStep] = useState(preset ? 1 : 0);
  const [start, setStart] = useState<SetupStart>(preset ?? 'blank');
  const [look, setLook] = useState<SheetLook>('header');
  const [freeze, setFreeze] = useState(!!preset);
  const sheetId = c.sheet.id;
  useEffect(() => forgetSetupStart(sheetId), [sheetId]);
  const [size, setSize] = useState<SheetCellSize>('default');
  const [columns, setColumns] = useState<string[]>([...CARD_COLUMNS_REQUIRED]);
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

  // Setup ends without a style: the sheet no longer awaits it (not an undo step; nothing on the grid changed).
  const done = () =>
    c.store.write(
      c.sheet.id,
      { kind: 'layout', changes: [{ k: 'options', setupPending: false }] },
      { undoable: false },
    );
  const create = () => {
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
        : start === 'cards' || start === 'csv'
          ? null
          : sheetStarter(start, todayMs());
    const write = setupWrite(c.workbook, c.sheet.id, {
      start: starter,
      look,
      freezeHeader: freeze && !!starter,
      size,
      dark,
    });
    if (!write) return;
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

  return (
    <SetupCard
      titleId={`setup-sheet-${c.sheet.id}`}
      title="Setup Sheet"
      line="Start from a layout, your cards or a blank grid. Everything can change later from its cog."
      icon={<SheetArt size={20} />}
      help="planSheets"
      palette={c.palette}
      steps={steps.map((id) => ({ label: STEP_LABELS[id] }))}
      at={at}
      onStep={setStep}
      footer={
        <>
          {at > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setStep(at - 1)}>
              <ChevronLeftIcon size={12} />
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                track('Sheet', 'Created', TELEMETRY.blank);
                done();
                c.focusGrid();
              }}
            >
              Start Blank
            </Button>
          )}
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
        </>
      }
    >
      {current === 'start' ? (
        <SheetSetupStart
          palette={c.palette}
          start={start}
          onStart={setStart}
          plan={plan}
          live={live}
        />
      ) : current === 'cards' && plan ? (
        <SheetSetupCards palette={c.palette} plan={plan} live={live} search={search} />
      ) : current === 'columns' ? (
        <SheetSetupColumns
          palette={c.palette}
          offered={offered}
          columns={chosen}
          onColumns={setColumns}
        />
      ) : (
        <SheetSetupStyle
          palette={c.palette}
          look={look}
          onLook={setLook}
          freeze={freeze}
          onFreeze={setFreeze}
          size={size}
          onSize={setSize}
          hasRows={start !== 'blank'}
        />
      )}
    </SetupCard>
  );
}
