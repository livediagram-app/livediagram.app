// What one tab's Plan boards contribute to `plan_board_statuses` (docs/specs/013-workspace/activity-page.md
// §2.4): one row per column status a board shows, flagged Done when the column is the board's done column or
// after it (the statusPhasesOf rule, docs/specs/026-plan/plan-views.md "What a plan view reads"). The Activity
// read uses the rows to drop finished cards and to find a board to open a card on.
//
// Pure, like rows.ts beside it: the db layer turns these into statements in the tab save's own batch.

import type { Element } from '@livediagram/document';
import { normaliseBoardSetup } from '@livediagram/items';

// The status an All Cards board writes: it shows every card whatever its status, so the read can land a card
// there when no column holds it. Never a real status (a status is trimmed text a person typed).
export const ALL_CARDS_STATUS = '*';

export type PlanBoardStatusRow = {
  elementId: string;
  boardTitle: string;
  status: string;
  done: boolean;
  // The board's index among the tab's boards, then the column's on its board: the read's tie-breaks.
  boardOrder: number;
  position: number;
};

export function planBoardRowsFromElements(elements: readonly Element[]): PlanBoardStatusRow[] {
  const rows: PlanBoardStatusRow[] = [];
  let boardOrder = 0;
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'plan-board' || !el.planBoard) continue;
    const setup = normaliseBoardSetup(el.planBoard);
    // An Archive board shows only archived cards, which the page never lists.
    if (!setup || setup.archive) continue;
    const boardTitle = setup.title.trim() || 'Board';
    const order = boardOrder++;
    if (setup.allCards) {
      rows.push({
        elementId: el.id,
        boardTitle,
        status: ALL_CARDS_STATUS,
        done: false,
        boardOrder: order,
        position: 0,
      });
      continue;
    }
    const doneAt = setup.columns.findIndex((c) => c.id === setup.doneColumnId);
    setup.columns.forEach((c, i) =>
      rows.push({
        elementId: el.id,
        boardTitle,
        status: c.status,
        done: doneAt >= 0 && i >= doneAt,
        boardOrder: order,
        position: i,
      }),
    );
  }
  return rows;
}
