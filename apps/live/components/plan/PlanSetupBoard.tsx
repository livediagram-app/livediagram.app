'use client';

// Setup Board (docs/specs/026-plan/plan-board.md "Setup Board"): a board with no columns (a new Blank board) shows
// this in place of its columns. Two steps: the card types it is for, then its columns (existing statuses to pick,
// new ones to name, in order); Create Board writes both as one change. Someone who may only view reads that the
// board is not set up yet.
import { useState } from 'react';
import { PLAN_COLUMNS_MAX, type ItemTypeDef } from '@livediagram/items';
import { ChevronLeftIcon, Button, CheckIcon, GlyphDisc, PlanCardsIcon } from '@livediagram/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { PlanBoardTileArt } from './plan-tile-art';
import type { PlanPalette } from './plan-palette';
import type { SetupColumn } from './setup-board';
import { SetupColumnsStep, SetupTypesStep } from './setup-board-steps';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

type Step = 'types' | 'columns';
const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: 'types', label: 'Card Types', hint: 'Which cards go on it' },
  { id: 'columns', label: 'Columns', hint: 'The stages they move through' },
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
            {/* The steps as two equal tiles across the card: the current one tinted, a done one ticked (and a way
                back), the next one quiet. */}
            <ol
              aria-label="Steps"
              // A hairline under the steps sets them apart from the step itself.
              className="mt-4 grid shrink-0 grid-cols-2 gap-2 border-b px-5 pb-4"
              style={{ borderColor: palette.border }}
            >
              {STEPS.map((x, i) => {
                const current = i === at;
                const done = i < at;
                return (
                  <li key={x.id} className="min-w-0">
                    <button
                      type="button"
                      aria-current={current ? 'step' : undefined}
                      disabled={!done}
                      onClick={() => setStep(x.id)}
                      className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                        current
                          ? 'border-brand-400 bg-brand-50/70 dark:border-brand-500/60 dark:bg-brand-500/10'
                          : done
                            ? 'cursor-pointer hover:border-brand-300'
                            : 'cursor-default'
                      }`}
                      style={current ? undefined : { borderColor: palette.cardBorder }}
                    >
                      <GlyphDisc
                        size={24}
                        className={`text-[12px] font-semibold tabular-nums ${
                          current || done ? 'bg-brand-500 text-white dark:bg-brand-600' : 'border'
                        }`}
                        style={
                          current || done
                            ? undefined
                            : { borderColor: palette.cardBorder, color: palette.muted }
                        }
                      >
                        {done ? <CheckIcon size={12} /> : String(i + 1)}
                      </GlyphDisc>
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="truncate text-[13px] font-semibold"
                          style={{ color: current || done ? palette.text : palette.muted }}
                        >
                          {x.label}
                        </span>
                        <span className="truncate text-[11px]" style={{ color: palette.muted }}>
                          {x.hint}
                        </span>
                      </span>
                    </button>
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
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={columns.length === 0}
                    onClick={() => onSetUp(columns, typeIds)}
                  >
                    <CheckIcon size={12} />
                    {initial ? 'Save Board' : 'Create Board'}
                  </Button>
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
