'use client';

// Setup Board (docs/specs/026-plan/plan-board.md "Setup Board"): a board with no columns (a new Blank board) shows
// this in place of its columns. Three steps: the card types it is for, its columns (existing statuses to pick,
// new ones to name, in order), then its layout (swimlanes, card size, Fill Tab; skippable, starting from the board as
// it is); Create Board, on the last step only, writes them all as one change. Someone who may only view reads that the
// board is not set up yet.
import { useState } from 'react';
import { PLAN_COLUMNS_MAX, type ItemTypeDef } from '@livediagram/items';
import { ChevronLeftIcon, Button, CheckIcon, PlanCardsIcon } from '@livediagram/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { PlanBoardTileArt } from './plan-tile-art';
import type { PlanPalette } from './plan-palette';
import type { SetupColumn, SetupLayout } from './setup-board';
import { SetupColumnsStep, SetupTypesStep } from './setup-board-steps';
import { SetupLayoutStep } from './SetupLayoutStep';
import { SetupStepper } from './SetupStepper';
import { useTabElementCount } from '@/hooks/plan/plan-cover-store';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

type Step = 'types' | 'columns' | 'layout';
const STEPS: { id: Step; label: string }[] = [
  { id: 'types', label: 'Card Types' },
  { id: 'columns', label: 'Columns' },
  { id: 'layout', label: 'Layout' },
];

export function PlanSetupBoard({
  palette,
  canEdit,
  types,
  statusNames,
  onSetUp,
  onCreateType,
  initial,
  onCancel,
  layout: startLayout,
  otherElements,
}: {
  palette: PlanPalette;
  canEdit: boolean;
  // The document's card types, offered in step 1 (every one picked to start).
  types: readonly ItemTypeDef[];
  // The document's statuses, offered as existing states in step 2 (pickableStatuses).
  statusNames: ReadonlyMap<string, string>;
  onSetUp: (columns: SetupColumn[], typeIds: string[], layout: SetupLayout) => void;
  // The board's layout as it is (setupLayoutOf): what step 3 starts from, and what skipping it keeps.
  layout: SetupLayout;
  // The other elements on the tab: what Fill Tab would delete (its warning). Absent, the open tab's count less this
  // board (plan-cover-store.ts), read here only, so a board never re-renders for an element added elsewhere.
  otherElements?: number;
  // Add New Card Type, under the card types (absent while the catalogue is full).
  onCreateType?: (() => void) | undefined;
  // Run again on a board that has columns: what it starts from (the board as it is), and Cancel. Its last button
  // then reads Save Board.
  initial?: { columns: SetupColumn[]; typeIds: string[] } | undefined;
  onCancel?: (() => void) | undefined;
}) {
  const [step, setStep] = useState<Step>('types');
  const [typeIds, setTypeIds] = useState<string[]>(
    () => initial?.typeIds ?? types.map((t) => t.id),
  );
  const [columns, setColumns] = useState<SetupColumn[]>(() => initial?.columns ?? []);
  const [layout, setLayout] = useState<SetupLayout>(startLayout);
  const tabElements = useTabElementCount();
  const others = otherElements ?? Math.max(0, tabElements - 1);
  // A type made from here (Add New Card Type) joins the picks once it is saved: any type the catalogue gains while
  // the board is being set up starts ticked. Adjusted during render when the catalogue changes.
  const [known, setKnown] = useState<readonly ItemTypeDef[]>(types);
  if (known !== types) {
    const added = types.filter((t) => !known.some((k) => k.id === t.id)).map((t) => t.id);
    setKnown(types);
    if (added.length) setTypeIds((ids) => [...ids, ...added.filter((id) => !ids.includes(id))]);
  }
  const at = STEPS.findIndex((s) => s.id === step);
  return (
    <div
      // The card never outgrows the board: it is capped at its height, centred when it fits, and only the step
      // between the step bar and the footer scrolls.
      className="flex h-full overflow-hidden p-4 sm:p-6"
      onPointerDown={stop}
      onKeyDown={stop}
      onWheel={stop}
    >
      <section
        aria-labelledby="setup-board-title"
        className="m-auto flex max-h-full w-full max-w-[36rem] flex-col rounded-2xl border shadow-sm"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          color: palette.text,
        }}
      >
        <header className="flex shrink-0 items-start gap-3 px-5 pt-5">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <PlanBoardTileArt preset="kanban" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="setup-board-title" className="text-[16px] font-semibold">
              Setup Board
            </h2>
            <p className="text-[13px]" style={{ color: palette.muted }}>
              {canEdit
                ? 'Pick its cards, columns and layout. Change them any time from its cog.'
                : 'This board is not set up yet. Someone who can edit it will set it up.'}
            </p>
          </div>
          <HelpArticleLink article="planBoards" variant="icon" />
        </header>

        {canEdit ? (
          <>
            {/* The steps as a wizard stepper; a hairline under it sets it apart from the step itself. */}
            <div
              className="mt-4 shrink-0 border-b px-5 pb-4"
              style={{ borderColor: palette.border }}
            >
              <SetupStepper steps={STEPS} at={at} palette={palette} onStep={setStep} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {step === 'types' ? (
                <SetupTypesStep
                  types={types}
                  chosen={typeIds}
                  palette={palette}
                  onChange={setTypeIds}
                  onCreateType={onCreateType}
                />
              ) : step === 'columns' ? (
                <SetupColumnsStep
                  chosen={columns}
                  statusNames={statusNames}
                  typeIds={typeIds}
                  max={PLAN_COLUMNS_MAX}
                  palette={palette}
                  onChange={setColumns}
                />
              ) : (
                <SetupLayoutStep
                  layout={layout}
                  types={types.filter((t) => typeIds.includes(t.id))}
                  allTypes={types}
                  others={others}
                  saving={!!initial}
                  palette={palette}
                  onChange={setLayout}
                />
              )}
            </div>

            <footer
              className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-5 py-3"
              style={{ borderColor: palette.border }}
            >
              {step !== 'types' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStep(step === 'layout' ? 'columns' : 'types')}
                >
                  <ChevronLeftIcon size={12} />
                  Back
                </Button>
              ) : (
                <span
                  className="flex items-center gap-1.5 text-[12px]"
                  style={{ color: palette.muted }}
                >
                  <PlanCardsIcon size={14} />
                  Step 1 of 3
                </span>
              )}
              <span className="flex items-center gap-2">
                {onCancel ? (
                  <Button variant="secondary" size="sm" onClick={onCancel}>
                    Cancel
                  </Button>
                ) : null}
                {step === 'types' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={typeIds.length === 0}
                    onClick={() => setStep('columns')}
                  >
                    Next: Columns
                  </Button>
                ) : (
                  <>
                    {/* Create Board (or Save Board) is the Layout step's alone; Columns leads on to it. The step
                        starts from the board's layout, so pressing straight through keeps it. */}
                    {step === 'columns' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={columns.length === 0}
                        onClick={() => setStep('layout')}
                      >
                        Next: Layout
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={columns.length === 0}
                        onClick={() => onSetUp(columns, typeIds, layout)}
                      >
                        <CheckIcon size={12} />
                        {initial ? 'Save Board' : 'Create Board'}
                      </Button>
                    )}
                  </>
                )}
              </span>
            </footer>
          </>
        ) : (
          <div className="h-5" />
        )}
      </section>
    </div>
  );
}
