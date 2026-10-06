// Board presets: the set-ups a palette board tile or a template starts from
// (docs/specs/026-plan/plan-mode.md "The palette", "Templates").

import type { CardField, PlanBoardSetup, PlanColumn } from './board';

export const PLAN_BOARD_PRESET_IDS = [
  'blank',
  'kanban',
  'sprint',
  'bug-triage',
  'retro',
  'roadmap',
  'weekly',
  'archive',
  'all-cards',
] as const;
export type PlanBoardPresetId = (typeof PLAN_BOARD_PRESET_IDS)[number];

function col(status: string, name: string, extra: Partial<PlanColumn> = {}): PlanColumn {
  return { id: status, status, name, ...extra };
}

const WORK_FIELDS: CardField[] = ['key', 'type', 'assignee', 'priority', 'labels', 'checklist'];

export const PLAN_BOARD_PRESETS: Readonly<
  Record<PlanBoardPresetId, { label: string; setup: PlanBoardSetup }>
> = {
  blank: {
    label: 'Blank Board',
    setup: {
      title: 'Board',
      // No columns: the board asks for its first (docs/specs/026-plan/plan-board.md).
      columns: [],
      swimlaneBy: 'none',
      cardFields: WORK_FIELDS,
      voting: { on: false },
      widgets: ['count', 'progress', 'people', 'filter', 'mine'],
      hideWriting: false,
    },
  },
  kanban: {
    label: 'Kanban Board',
    setup: {
      title: 'Kanban',
      columns: [
        col('backlog', 'Backlog'),
        col('todo', 'To do'),
        col('doing', 'In progress', { wipLimit: 3 }),
        col('review', 'Review', { wipLimit: 2 }),
        col('done', 'Done'),
      ],
      doneColumnId: 'done',
      swimlaneBy: 'none',
      cardFields: WORK_FIELDS,
      voting: { on: false },
      widgets: ['count', 'progress', 'wip', 'stale', 'unplaced', 'filter', 'mine'],
      addTypes: ['task', 'action', 'note'],
      hideWriting: false,
    },
  },
  sprint: {
    label: 'Sprint Board',
    setup: {
      title: 'Sprint',
      columns: [
        col('sprint-backlog', 'Sprint backlog'),
        col('doing', 'In progress'),
        col('review', 'In review'),
        col('done', 'Done'),
      ],
      doneColumnId: 'done',
      swimlaneBy: 'assignee',
      cardFields: ['key', 'type', 'priority', 'labels', 'estimate', 'checklist'],
      voting: { on: false },
      widgets: ['points', 'progress', 'people', 'unassigned', 'filter', 'mine'],
      addTypes: ['task', 'action'],
      hideWriting: false,
    },
  },
  'bug-triage': {
    label: 'Bug Triage',
    setup: {
      title: 'Bug triage',
      columns: [
        col('new', 'New'),
        col('confirmed', 'Confirmed'),
        col('fixing', 'Fixing', { wipLimit: 4 }),
        col('fixed', 'Fixed'),
        col('wont-fix', "Won't fix"),
      ],
      doneColumnId: 'fixed',
      swimlaneBy: 'priority',
      cardFields: ['key', 'assignee', 'labels', 'due'],
      voting: { on: false },
      widgets: ['count', 'priorities', 'unassigned', 'stale', 'filter'],
      addTypes: ['task'],
      hideWriting: false,
    },
  },
  retro: {
    label: 'Retro Board',
    setup: {
      title: 'Retro',
      columns: [
        col('went-well', 'Went well', { color: '#16a34a' }),
        col('to-improve', 'To improve', { color: '#dc2626' }),
        col('ideas', 'Ideas', { color: '#0d9488' }),
      ],
      swimlaneBy: 'none',
      cardFields: ['assignee', 'votes'],
      voting: { on: true, budget: 5 },
      widgets: ['votes', 'top-voted', 'types', 'people'],
      // Notes and ideas only: the actions a retro agrees are tracked on a board of their own
      // (docs/specs/026-plan/plan-templates.md "Team Retro").
      addTypes: ['note', 'idea'],
      hideWriting: true,
    },
  },
  roadmap: {
    label: 'Roadmap',
    setup: {
      title: 'Roadmap',
      columns: [col('now', 'Now'), col('next', 'Next'), col('later', 'Later')],
      swimlaneBy: 'none',
      cardFields: ['key', 'assignee', 'labels', 'start', 'due'],
      voting: { on: false },
      widgets: ['count', 'progress', 'due', 'people', 'filter'],
      addTypes: ['project'],
      hideWriting: false,
    },
  },
  weekly: {
    label: 'Weekly Planner',
    setup: {
      title: 'This week',
      columns: [
        col('mon', 'Monday'),
        col('tue', 'Tuesday'),
        col('wed', 'Wednesday'),
        col('thu', 'Thursday'),
        col('fri', 'Friday'),
      ],
      swimlaneBy: 'none',
      cardFields: ['type', 'due', 'checklist'],
      voting: { on: false },
      widgets: ['due', 'count', 'people', 'mine', 'filter'],
      addTypes: ['task', 'action', 'note'],
      hideWriting: false,
    },
  },
  // Every card that is not archived, a row per status (docs/specs/026-plan/plan-board.md "All Cards").
  'all-cards': {
    label: 'All Cards',
    setup: {
      title: 'All Cards',
      columns: [col('all', 'All Cards')],
      swimlaneBy: 'status',
      cardFields: ['key', 'type', 'assignee', 'priority', 'due'],
      cardSize: 'compact',
      allCards: true,
      widgets: ['count', 'types', 'priorities', 'unassigned', 'filter'],
      voting: { on: false },
      hideWriting: false,
    },
  },
  // Only archived items (docs/specs/026-plan/items.md "Archive"), in one column.
  archive: {
    label: 'Archive Board',
    setup: {
      title: 'Archive',
      columns: [col('archived', 'Archived')],
      swimlaneBy: 'none',
      cardFields: ['key', 'type', 'assignee', 'labels'],
      cardSize: 'compact',
      archive: true,
      widgets: ['count', 'types', 'filter'],
      voting: { on: false },
      hideWriting: false,
    },
  },
};

// A fresh copy, so a caller can change it without touching the catalogue.
export function presetSetup(id: PlanBoardPresetId): PlanBoardSetup {
  return structuredClone(PLAN_BOARD_PRESETS[id].setup);
}

export function isPlanBoardPresetId(id: unknown): id is PlanBoardPresetId {
  return typeof id === 'string' && (PLAN_BOARD_PRESET_IDS as readonly string[]).includes(id);
}

// A palette tile's preset, or the blank board for anything else.
export function presetSetupOrBlank(id: unknown): PlanBoardSetup {
  return presetSetup(isPlanBoardPresetId(id) ? id : 'blank');
}

// A board placed on the canvas starts empty (docs/specs/026-plan/plan-mode.md "The palette"): its columns
// get statuses of their own (`todo~k3f9`), so no card the document already has lands on it. An Archive
// or All Cards board shows cards by what they are, not by status, so it keeps its columns as they are.
export function freshBoardSetup(id: unknown, random: () => number = Math.random): PlanBoardSetup {
  const setup = presetSetupOrBlank(id);
  if (setup.archive || setup.allCards) return setup;
  const suffix = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join('');
  return {
    ...setup,
    columns: setup.columns.map((c) => ({ ...c, status: `${c.status}~${suffix}` })),
  };
}
