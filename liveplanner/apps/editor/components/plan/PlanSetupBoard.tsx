'use client';

// Setup Board (docs/specs/026-plan/plan-board.md "Setup Board"): the dialog a board not set up yet opens (and Board
// Setup's Setup Board, run again on a set-up board). Three steps: the card types it is for, its columns (existing
// statuses to pick, new ones to name, in order), then its layout (swimlanes, card size; skippable, starting from the
// board as it is); Create Board, on the last step only, writes them all as one change. Closed before it finishes, a
// new board's step and picks are kept for when it opens again (lib/setup-dialog-store.ts drafts). Loaded on its own,
// only when opened (PlanBoardSetup).
import { useEffect, useState } from 'react';
import { PLAN_COLUMNS_MAX, type ItemTypeDef } from '@liveplanner/items';
import { ChevronLeftIcon, Button, CheckIcon } from '@liveplanner/ui';
import { dropSetupDraft, readSetupDraft, saveSetupDraft } from '@/lib/setup-dialog-store';
import { PlanBoardTileArt } from './plan-tile-art';
import type { SetupColumn, SetupLayout } from './setup-board';
import { SetupColumnsStep, SetupTypesStep } from './setup-board-steps';
import { SetupLayoutStep } from './SetupLayoutStep';
import { SetupDialog, useSetupPalette } from './SetupDialog';

type Step = 'types' | 'columns' | 'layout';
const STEPS: { id: Step; label: string }[] = [
  { id: 'types', label: 'Card Types' },
  { id: 'columns', label: 'Columns' },
  { id: 'layout', label: 'Layout' },
];

// What a new board's dialog keeps when closed before it finishes.
type BoardDraft = { step: Step; typeIds: string[]; columns: SetupColumn[]; layout: SetupLayout };

export function PlanSetupBoard({
  boardId,
  open = true,
  onClose,
  returnFocus,
  types,
  statusNames,
  onSetUp,
  onCreateType,
  initial,
  layout: startLayout,
}: {
  // The board's element id: its title id, and its draft's key.
  boardId: string;
  open?: boolean;
  // Not now, Cancel, Close, Escape or the backdrop: the board stays as it is.
  onClose: () => void;
  returnFocus?: () => void;
  // The project's card types, offered in step 1 (none picked to start, unless run again on a set-up board).
  types: readonly ItemTypeDef[];
  // The project's statuses, offered as existing states in step 2 (pickableStatuses).
  statusNames: ReadonlyMap<string, string>;
  onSetUp: (columns: SetupColumn[], typeIds: string[], layout: SetupLayout) => void;
  // The board's layout as it is (setupLayoutOf): what step 3 starts from, and what skipping it keeps.
  layout: SetupLayout;
  // Add New Card Type, under the card types (absent while the catalogue is full).
  onCreateType?: (() => void) | undefined;
  // Run again on a board that has columns: what it starts from (the board as it is), always at step 1 and never from
  // a draft. Its footer then reads Cancel and Save Board.
  initial?: { columns: SetupColumn[]; typeIds: string[] } | undefined;
}) {
  const palette = useSetupPalette();
  // A new board's draft, its card types still in the catalogue.
  const [draft] = useState(() => (initial ? undefined : readSetupDraft<BoardDraft>(boardId)));
  const [step, setStep] = useState<Step>(draft?.step ?? 'types');
  const [typeIds, setTypeIds] = useState<string[]>(
    () => initial?.typeIds ?? draft?.typeIds.filter((id) => types.some((t) => t.id === id)) ?? [],
  );
  const [columns, setColumns] = useState<SetupColumn[]>(
    () => initial?.columns ?? draft?.columns ?? [],
  );
  const [layout, setLayout] = useState<SetupLayout>(draft?.layout ?? startLayout);
  // A type made from here (Add New Card Type) joins the picks once it is saved: any type the catalogue gains while
  // the board is being set up starts ticked. Adjusted during render when the catalogue changes.
  const [known, setKnown] = useState<readonly ItemTypeDef[]>(types);
  if (known !== types) {
    const added = types.filter((t) => !known.some((k) => k.id === t.id)).map((t) => t.id);
    setKnown(types);
    if (added.length) setTypeIds((ids) => [...ids, ...added.filter((id) => !ids.includes(id))]);
  }
  // Kept as it changes (a Map set), so a close by any way leaves it ready for next time.
  useEffect(() => {
    if (!initial) saveSetupDraft(boardId, { step, typeIds, columns, layout } satisfies BoardDraft);
  }, [initial, boardId, step, typeIds, columns, layout]);

  const create = () => {
    dropSetupDraft(boardId);
    onSetUp(columns, typeIds, layout);
  };
  const at = STEPS.findIndex((s) => s.id === step);
  // The step's primary action, for its button and for Enter; undefined while it waits for a pick.
  const primary =
    step === 'types'
      ? typeIds.length > 0
        ? () => setStep('columns')
        : undefined
      : columns.length === 0
        ? undefined
        : step === 'columns'
          ? () => setStep('layout')
          : create;
  return (
    <SetupDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      titleId={`setup-board-${boardId}`}
      title="Set up your board"
      line="Pick its cards, columns and layout. Change them any time from its cog."
      icon={<PlanBoardTileArt preset="kanban" size={20} />}
      help="planBoards"
      palette={palette}
      steps={STEPS}
      at={at}
      onStep={(i) => setStep(STEPS[i]!.id)}
      onPrimary={primary}
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
            <span />
          )}
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {initial ? 'Cancel' : 'Not now'}
            </Button>
            {/* Create Board (or Save Board) is the Layout step's alone; Columns leads on to it. The step starts from
                the board's layout, so pressing straight through keeps it. */}
            <Button variant="primary" size="sm" disabled={!primary} onClick={primary}>
              {step === 'types' ? (
                'Next: Columns'
              ) : step === 'columns' ? (
                'Next: Layout'
              ) : (
                <>
                  <CheckIcon size={12} />
                  {initial ? 'Save Board' : 'Create Board'}
                </>
              )}
            </Button>
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
          palette={palette}
          onChange={setLayout}
        />
      )}
    </SetupDialog>
  );
}
