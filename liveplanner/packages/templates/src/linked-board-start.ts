// The Actions board (docs/specs/026-plan/linked-boards.md "The Actions board"): the Board tab made the first time a
// project gets an action. New, Done and Won't Do, Detailed Action cards showing who has each and when it is due.
// Pure: the editor commits it.
import { SHAPE_DEFAULT_SIZE, createShape, type Element, type Tab } from '@liveplanner/project';
import {
  freshSetup,
  planBoardHeightFor,
  planBoardWidthFor,
  statusColumn,
  type PlanBoardSetup,
} from '@liveplanner/items';

export const ACTIONS_BOARD_TITLE = 'Actions';

export function actionsBoardSetup(
  existing: Iterable<readonly [string, string]>,
  random: () => number = Math.random,
): PlanBoardSetup {
  return freshSetup(
    {
      title: ACTIONS_BOARD_TITLE,
      columns: [
        statusColumn('new', 'New'),
        statusColumn('done', 'Done'),
        statusColumn('wont-do', 'Won’t Do'),
      ],
      doneColumnId: 'done',
      swimlaneBy: 'none',
      cardFields: ['key', 'assignee', 'due', 'checklist', 'comments'],
      widgets: ['progress', 'due'],
      addTypes: ['action'],
      hideWriting: false,
      collects: 'actions',
    },
    random,
    existing,
  );
}

// The Board tab itself, in the theme of the tab the first action was made on.
export function actionsBoardTab(
  from: Pick<Tab, 'theme'> | undefined,
  existing: Iterable<readonly [string, string]>,
  random: () => number = Math.random,
): Tab {
  const setup = actionsBoardSetup(existing, random);
  const element = {
    ...createShape('plan-board', 0, 0),
    planBoard: setup,
    width: Math.max(SHAPE_DEFAULT_SIZE['plan-board'].width, planBoardWidthFor(setup)),
    height: planBoardHeightFor(setup),
  } as Element;
  return {
    id: crypto.randomUUID(),
    name: ACTIONS_BOARD_TITLE,
    elements: [element],
    defaultTextSize: 'sm',
    kind: 'board',
    ...(from?.theme ? { theme: from.theme } : {}),
  };
}
