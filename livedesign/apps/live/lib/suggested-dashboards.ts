// Dashboards built from the work a document already holds (docs/specs/026-plan/plan-mode.md "Starting a board",
// Dashboards): Start Planning reads the document's Board and Sheet tabs and offers ready-made layouts around them, each
// a set of rows of slots that show a tab, a plan view (a metric or a chart) or nothing. A board whose cards have start
// and due dates gets a timeline (its Gantt chart); one with estimates a sprint's health; one laned by priority or
// taking bugs a triage view; one with votes a retro's summary; several boards a team overview; a board beside a sheet
// both together. Pure: Start Planning shows them and usePlanTabActions makes the one picked.
import {
  ITEM_TYPES,
  boardAddTypes,
  normaliseBoardSetup,
  type ItemTypeDef,
  type PlanViewId,
} from '@livepages/items';
import { tabKindOf, type Tab } from '@livepages/document';

type SuggestedSlot =
  | { span: number; tab: { tabId: string; of: 'board' | 'sheet' } }
  | { span: number; view: PlanViewId }
  | { span: number };
export type SuggestedRow = { height: number; slots: SuggestedSlot[] };
export type SuggestedDashboard = {
  id: string;
  name: string;
  line: string;
  // What it holds, for its card's chips ("Gantt Chart", "4 Metrics").
  holds: string[];
  rows: SuggestedRow[];
};

const METRICS_H = 160;
const BOARD_H = 520;
const CHART_H = 360;
const GANTT_H = 440;

const metrics = (...kinds: string[]): SuggestedRow => ({
  height: METRICS_H,
  slots: kinds.map((k) => ({ span: 12 / kinds.length, view: `metric:${k}` as PlanViewId })),
});
const boardRow = (tabId: string): SuggestedRow => ({
  height: BOARD_H,
  slots: [{ span: 12, tab: { tabId, of: 'board' } }],
});
const charts = (...views: PlanViewId[]): SuggestedRow => ({
  height: views.includes('gantt') ? GANTT_H : CHART_H,
  slots: views.map((v) => ({ span: 12 / views.length, view: v })),
});

type BoardTab = {
  tab: Tab;
  fields: Set<string>;
  setup: NonNullable<ReturnType<typeof normaliseBoardSetup>>;
};

// A Board tab's board, and every field its card types carry.
function boardTabs(tabs: readonly Tab[], types: readonly ItemTypeDef[]): BoardTab[] {
  return tabs.flatMap((tab) => {
    if (tabKindOf(tab) !== 'board') return [];
    const el = tab.elements.find((e) => e.type === 'shape' && e.shape === 'plan-board');
    const setup = el ? normaliseBoardSetup((el as { planBoard?: unknown }).planBoard) : null;
    if (!setup || setup.archive || setup.allCards) return [];
    const fields = new Set(boardAddTypes(setup, types).flatMap((t) => t.fields));
    return [{ tab, fields, setup }];
  });
}

export function suggestedDashboards(
  tabs: readonly Tab[],
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): SuggestedDashboard[] {
  const boards = boardTabs(tabs, types);
  const sheets = tabs.filter((t) => tabKindOf(t) === 'sheet');
  const out: SuggestedDashboard[] = [];
  for (const { tab, fields, setup } of boards) {
    const name = tab.name;
    if (fields.has('start') && fields.has('due'))
      out.push({
        id: `timeline:${tab.id}`,
        name: `${name} Timeline`,
        line: `${name}’s completion and what is due, a Gantt chart of its dates, and the board to work on.`,
        holds: ['4 Metrics', 'Gantt Chart', 'Board'],
        rows: [
          metrics('progress', 'due', 'count', 'unassigned'),
          charts('gantt'),
          boardRow(tab.id),
        ],
      });
    if (setup.cardFields.includes('estimate') || setup.widgets?.includes('points'))
      out.push({
        id: `sprint:${tab.id}`,
        name: `${name} Sprint Health`,
        line: `Points done, completion and who has what, the board, and its workload and priorities by status.`,
        holds: ['4 Metrics', 'Board', 'Cards by Field', 'Priority Matrix'],
        rows: [
          metrics('points', 'progress', 'people', 'stale'),
          boardRow(tab.id),
          charts('workload', 'priority-matrix'),
        ],
      });
    if (setup.swimlaneBy === 'priority' || setup.addTypes?.includes('bug'))
      out.push({
        id: `triage:${tab.id}`,
        name: `${name} Triage`,
        line: `What is urgent, unassigned, stale or overdue, priority against status, who has what, and the board.`,
        holds: ['4 Metrics', 'Priority Matrix', 'Cards by Field', 'Board'],
        rows: [
          metrics('priorities', 'unassigned', 'stale', 'due'),
          charts('priority-matrix', 'workload'),
          boardRow(tab.id),
        ],
      });
    if (setup.cardFields.includes('votes') || fields.has('votes'))
      out.push({
        id: `retro:${tab.id}`,
        name: `${name} Summary`,
        line: `The most voted card, how many there are and who joined in, the board itself, and who has what.`,
        holds: ['3 Metrics', 'Board', 'Cards by Field'],
        rows: [metrics('top-voted', 'count', 'people'), boardRow(tab.id), charts('workload')],
      });
  }
  if (boards.length >= 2) {
    const pairs: SuggestedRow[] = [];
    for (let i = 0; i < boards.length && pairs.length < 3; i += 2) {
      const two = boards.slice(i, i + 2);
      pairs.push({
        height: BOARD_H,
        slots: two.map((b) => ({
          span: 12 / two.length,
          tab: { tabId: b.tab.id, of: 'board' as const },
        })),
      });
    }
    out.push({
      id: 'team',
      name: 'Team Overview',
      line: `Every board side by side, completion and what is due across them, and who is carrying what.`,
      holds: ['4 Metrics', `${boards.length} Boards`, 'Cards by Field', 'Due Calendar'],
      rows: [
        metrics('progress', 'due', 'count', 'people'),
        ...pairs,
        charts('workload', 'calendar'),
      ],
    });
  }
  const firstBoard = boards[0];
  const firstSheet = sheets[0];
  if (firstBoard && firstSheet)
    out.push({
      id: `work-numbers:${firstBoard.tab.id}:${firstSheet.id}`,
      name: `${firstBoard.tab.name} and ${firstSheet.name}`,
      line: `The board and the sheet side by side, with completion and what is due above them.`,
      holds: ['3 Metrics', 'Board', 'Sheet'],
      rows: [
        metrics('progress', 'due', 'count'),
        {
          height: BOARD_H,
          slots: [
            { span: 6, tab: { tabId: firstBoard.tab.id, of: 'board' } },
            { span: 6, tab: { tabId: firstSheet.id, of: 'sheet' } },
          ],
        },
      ],
    });
  return out;
}
