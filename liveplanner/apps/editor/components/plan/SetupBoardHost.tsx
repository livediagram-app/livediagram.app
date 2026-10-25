'use client';

// A board's setup on the canvas (docs/specs/026-plan/plan-board.md "Setup Board"): while it is not set up yet, the
// placeholder in place of its columns; and, for this person only, the Setup Board dialog when it is open (placed here,
// Set up board, or Board Setup's Setup Board run again). The dialog's code loads only when it first opens.
import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { boardAddTypes, type PlanBoardSetup as BoardSetup } from '@liveplanner/items';
import { mayCreateCardType } from './may-create-card-type';
import { usePlan } from './PlanContext';
import type { PlanPalette } from './plan-palette';
import { PlanBoardTileArt } from './plan-tile-art';
import { setUpBoard, setupFromBoard, setupLayoutOf, withSetupLayout } from './setup-board';
import { SetupPlaceholder } from './SetupPlaceholder';
import { trackSetup } from './track-board-setup';
import { useSetupDialog } from './useSetupDialog';

const PlanSetupBoard = dynamic(() => import('./PlanSetupBoard').then((m) => m.PlanSetupBoard), {
  ssr: false,
});

export const BOARD_SET_UP_ELSEWHERE = 'This board was just set up by someone else.';

// Focus after the dialog: the placeholder's button while the board is still not set up, else the board's first card
// (or its first control).
function focusBoard(id: string, placeholder: HTMLElement | null): void {
  if (placeholder?.isConnected) {
    placeholder.focus({ preventScroll: true });
    return;
  }
  const board = document.querySelector(`[data-plan-board="${CSS.escape(id)}"]`);
  board
    ?.querySelector<HTMLElement>('[data-plan-card], button:not([disabled])')
    ?.focus({ preventScroll: true });
}

export function SetupBoardHost({
  elementId,
  setup,
  palette,
  canEdit,
  pickable,
}: {
  elementId: string;
  setup: BoardSetup;
  // The board's own colours, for the placeholder.
  palette: PlanPalette;
  // An Editor in Plan mode: sets it up. Anyone else reads the placeholder only.
  canEdit: boolean;
  // The statuses a column can be made for (pickableStatuses).
  pickable: ReadonlyMap<string, string>;
}) {
  const plan = usePlan();
  const unset = setup.columns.length === 0;
  const dialog = useSetupDialog({
    key: elementId,
    unset,
    canEdit,
    setUpElsewhere: BOARD_SET_UP_ELSEWHERE,
    notify: plan?.notify ?? plan?.announce,
  });
  const button = useRef<HTMLButtonElement>(null);
  const again = dialog.mode === 'again';
  return (
    <>
      {unset ? (
        <SetupPlaceholder
          ref={button}
          icon={<PlanBoardTileArt preset="kanban" size={20} />}
          title={setup.title.trim() || 'Board'}
          action={canEdit ? 'Set up board' : null}
          onAction={dialog.open}
          viewerLine="Someone who can edit it will set it up."
          palette={palette}
        />
      ) : null}
      {dialog.mode && plan ? (
        <PlanSetupBoard
          // Remounted when it is asked for again, so it starts from the board as it is then.
          key={dialog.mode}
          boardId={elementId}
          onClose={dialog.close}
          returnFocus={() => focusBoard(elementId, button.current)}
          types={plan.types}
          statusNames={pickable}
          {...(again
            ? {
                initial: setupFromBoard(
                  setup,
                  boardAddTypes(setup, plan.types).map((t) => t.id),
                ),
              }
            : {})}
          {...(mayCreateCardType(plan) ? { onCreateType: () => plan.editType('new') } : {})}
          layout={setupLayoutOf(setup)}
          onSetUp={(columns, typeIds, layout) => {
            const all = plan.types.map((t) => t.id);
            dialog.finish();
            // No Fill Tab to change (plan-board.md "Fill Tab"): an old board's stored flag rides through the layout.
            plan.updateBoard(
              elementId,
              withSetupLayout(setUpBoard(setup, columns, typeIds, all), layout),
            );
            trackSetup('BoardSetUp');
          }}
        />
      ) : null}
    </>
  );
}
