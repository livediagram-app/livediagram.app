// What one tab's Plan boards contribute to `plan_board_statuses` (docs/specs/013-workspace/inbox.md
// §2.4): one row per column status a board shows, flagged Done when the column is the board's done column or
// after it (the statusPhasesOf rule, docs/specs/026-plan/plan-views.md "What a plan view reads"). The Activity
// read uses the rows to drop finished cards and to find a board to open a card on.
//
// Pure, like collab-index-rows.ts beside it: the api's db layer turns these into statements in the tab save's
// own batch, and the editor's offline Inbox read (§2.6) uses them in place of the table.

import type { Element } from './index';
import { isDoneColumn, normaliseBoardSetup } from '@liveplanner/items';

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
    setup.columns.forEach((c, i) =>
      rows.push({
        elementId: el.id,
        boardTitle,
        status: c.status,
        done: isDoneColumn(setup, c),
        boardOrder: order,
        position: i,
      }),
    );
  }
  return rows;
}

export type CardBoard = { tabId: string; tabName: string; elementId: string; title: string };

export type CardPlaces = {
  // The board a card in `status` opens on: one holding its status, then an All Cards board, then any board, by
  // tab, board and column order. Null when the plan shows no board.
  boardFor(status: string | undefined): CardBoard | null;
  // Whether `status` is a board's done column (docs/specs/026-plan/plan-board.md "Done columns"): such a card is no
  // longer waiting on anyone.
  isDone(status: string | undefined): boolean;
};

/** Where a plan's cards open, from its tabs in order: the Inbox's card rows, in the browser (This Browser's plans)
 *  and in the plan's Durable Object (what it pushes to the index) alike. */
export function cardPlacesOf(
  tabs: readonly { id: string; name: string; elements: readonly Element[] }[],
): CardPlaces {
  const boards: (PlanBoardStatusRow & { tabId: string; tabName: string; tabOrder: number })[] = [];
  tabs.forEach((tab, tabOrder) => {
    for (const b of planBoardRowsFromElements(tab.elements))
      boards.push({ ...b, tabId: tab.id, tabName: tab.name, tabOrder });
  });
  const done = new Set(boards.filter((b) => b.done).map((b) => b.status));
  const fit = (s: string, status: string | undefined) =>
    s === status ? 0 : s === ALL_CARDS_STATUS ? 1 : 2;
  return {
    boardFor(status) {
      let best: (typeof boards)[number] | undefined;
      for (const b of boards) {
        if (
          !best ||
          fit(b.status, status) < fit(best.status, status) ||
          (fit(b.status, status) === fit(best.status, status) &&
            (b.tabOrder - best.tabOrder ||
              b.boardOrder - best.boardOrder ||
              b.position - best.position) < 0)
        )
          best = b;
      }
      return best
        ? {
            tabId: best.tabId,
            tabName: best.tabName,
            elementId: best.elementId,
            title: best.boardTitle,
          }
        : null;
    },
    isDone: (status) => status !== undefined && done.has(status),
  };
}
