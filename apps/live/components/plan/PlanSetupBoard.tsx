'use client';

// Setup Board (docs/specs/026-plan/plan-board.md "Setup Board"): a board with no columns (a new Blank board) shows
// this in place of its columns. Two steps: the card types it is for, then its columns (existing statuses to pick,
// new ones to name, in order); Create Board writes both as one change. Someone who may only view reads that the
// board is not set up yet.
import { useState } from 'react';
import { PLAN_COLUMNS_MAX, type ItemTypeDef } from '@livediagram/items';
import { ChevronLeftIcon, Button, CheckIcon, PlanCardsIcon } from '@livediagram/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { PlanBoardTileArt } from './plan-tile-art';
import type { PlanPalette } from './plan-palette';
import type { SetupColumn } from './setup-board';
import { SetupColumnsStep, SetupTypesStep } from './setup-board-steps';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

type Step = 'types' | 'columns';
const STEPS: { id: Step; label: string }[] = [
  { id: 'types', label: 'Card Types' },
  { id: 'columns', label: 'Columns' },
];

export function PlanSetupBoard({
  palette,
  canEdit,
  types,
  statusNames,
  onSetUp,
  onCreateType,
}: {
  palette: PlanPalette;
  canEdit: boolean;
  // The document's card types, offered in step 1 (every one picked to start).
  types: readonly ItemTypeDef[];
  // The document's statuses, offered as existing states in step 2 (pickableStatuses).
  statusNames: ReadonlyMap<string, string>;
  onSetUp: (columns: SetupColumn[], typeIds: string[]) => void;
  // Add New Card Type, under the card types (absent while the catalogue is full).
  onCreateType?: (() => void) | undefined;
}) {
  const [step, setStep] = useState<Step>('types');
  const [typeIds, setTypeIds] = useState<string[]>(() => types.map((t) => t.id));
  const [columns, setColumns] = useState<SetupColumn[]>([]);
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
                ? 'Choose what goes on this board and the columns it moves through. Both can change later from its cog.'
                : 'This board is not set up yet. Someone who can edit it chooses its cards and columns.'}
            </p>
          </div>
          <HelpArticleLink article="planBoards" variant="icon" />
        </header>

        {canEdit ? (
          <>
            {/* The steps: done ones ticked, the current one in the brand colour; a done step can be gone back to. */}
            <ol aria-label="Steps" className="mt-4 flex shrink-0 items-center gap-2 px-5">
              {STEPS.map((s, i) => {
                const current = i === at;
                const done = i < at;
                return (
                  <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      aria-current={current ? 'step' : undefined}
                      disabled={!done}
                      onClick={() => setStep(s.id)}
                      className={`flex min-w-0 items-center gap-2 rounded-full text-[13px] font-medium ${
                        done ? 'cursor-pointer' : 'cursor-default'
                      }`}
                      style={{ color: current || done ? palette.text : palette.muted }}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ${
                          current || done ? 'bg-brand-500 text-white dark:bg-brand-600' : 'border'
                        }`}
                        style={current || done ? undefined : { borderColor: palette.cardBorder }}
                      >
                        {done ? (
                          <CheckIcon size={12} />
                        ) : (
                          <span className="text-optical-centre">{i + 1}</span>
                        )}
                      </span>
                      <span className="truncate">{s.label}</span>
                    </button>
                    {i < STEPS.length - 1 ? (
                      <span
                        aria-hidden
                        className={`h-0.5 flex-1 rounded-full ${done ? 'bg-brand-500' : ''}`}
                        style={done ? undefined : { backgroundColor: palette.cardBorder }}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {step === 'types' ? (
                <SetupTypesStep
                  types={types}
                  chosen={typeIds}
                  palette={palette}
                  onChange={setTypeIds}
                  onCreateType={onCreateType}
                />
              ) : (
                <SetupColumnsStep
                  chosen={columns}
                  statusNames={statusNames}
                  max={PLAN_COLUMNS_MAX}
                  palette={palette}
                  onChange={setColumns}
                />
              )}
            </div>

            <footer
              className="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3"
              style={{ borderColor: palette.border }}
            >
              {step === 'columns' ? (
                <Button variant="secondary" size="sm" onClick={() => setStep('types')}>
                  <ChevronLeftIcon size={12} />
                  Back
                </Button>
              ) : (
                <span
                  className="flex items-center gap-1.5 text-[12px]"
                  style={{ color: palette.muted }}
                >
                  <PlanCardsIcon size={14} />
                  Step 1 of 2
                </span>
              )}
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
                <Button
                  variant="primary"
                  size="sm"
                  disabled={columns.length === 0}
                  onClick={() => onSetUp(columns, typeIds)}
                >
                  <CheckIcon size={12} />
                  Create Board
                </Button>
              )}
            </footer>
          </>
        ) : (
          <div className="h-5" />
        )}
      </section>
    </div>
  );
}
