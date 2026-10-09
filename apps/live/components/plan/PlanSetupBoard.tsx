'use client';

// Setup Board (docs/specs/026-plan/plan-board.md "Setup Board"): a board with no columns (a new Blank board) shows
// this in place of its columns. Three steps: the card types it is for, its columns (existing statuses to pick,
// new ones to name, in order), then its layout (swimlanes, card size, Fill Tab; skippable, starting from the board as
// it is); Create Board, on the last step only, writes them all as one change. Someone who may only view reads that the
// board is not set up yet.
import { useState } from 'react';
import { PLAN_COLUMNS_MAX, type ItemTypeDef } from '@livediagram/items';
import { ChevronLeftIcon, Button, CheckIcon, PlanCardsIcon } from '@livediagram/ui';
import { PlanBoardTileArt } from './plan-tile-art';
import type { PlanPalette } from './plan-palette';
import type { SetupColumn, SetupLayout } from './setup-board';
import { SetupColumnsStep, SetupTypesStep } from './setup-board-steps';
import { SetupLayoutStep } from './SetupLayoutStep';
import { SetupCard } from './SetupCard';
import { useTabElementCount } from '@/hooks/plan/plan-cover-store';

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
  // The document's card types, offered in step 1 (none picked to start, unless run again on a set-up board).
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
  const [typeIds, setTypeIds] = useState<string[]>(() => initial?.typeIds ?? []);
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
    <SetupCard
      titleId="setup-board-title"
      title="Setup Board"
      line={
        canEdit
          ? 'Pick its cards, columns and layout. Change them any time from its cog.'
          : 'This board is not set up yet. Someone who can edit it will set it up.'
      }
      icon={<PlanBoardTileArt preset="kanban" size={20} />}
      help="planBoards"
      palette={palette}
      steps={canEdit ? STEPS : undefined}
      at={at}
      onStep={(i) => setStep(STEPS[i]!.id)}
      footer={
        <>
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
        </>
      }
    >
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
    </SetupCard>
  );
}
