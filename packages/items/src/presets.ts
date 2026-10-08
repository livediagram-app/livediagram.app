// Board presets: the set-ups a palette board tile or a template starts from
// (docs/specs/026-plan/plan-mode.md "The palette", "Templates").

import { statusNamed } from './status-names';
import type { CardField, PlanBoardSetup, PlanColumn } from './board';

// All Cards is always last (docs/specs/026-plan/plan-mode.md "Starting a board").
export const PLAN_BOARD_PRESET_IDS = [
  'blank',
  'kanban',
  'todo',
  'sprint',
  'bug-triage',
  'retro',
  'roadmap',
  'weekly',
  'archive',
  'all-cards',
] as const;
export type PlanBoardPresetId = (typeof PLAN_BOARD_PRESET_IDS)[number];

// A column whose status is its id: how every preset and Plan template builds its columns.
export function statusColumn(
  status: string,
  name: string,
  extra: Partial<PlanColumn> = {},
): PlanColumn {
  return { id: status, status, name, ...extra };
}

const WORK_FIELDS: CardField[] = [
  'key',
  'type',
  'assignee',
  'priority',
  'labels',
  'checklist',
  'comments',
];

// Each preset's widgets are few, and only ones true on it from the start (docs/specs/026-plan/board-widgets.md
// "Defaults"): Completion only with a done column, WIP Alerts only with WIP limits.
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
      widgets: [],
      hideWriting: false,
    },
  },
  kanban: {
    label: 'Kanban Board',
    setup: {
      title: 'Kanban',
      columns: [
        statusColumn('backlog', 'Backlog'),
        statusColumn('todo', 'To Do'),
        statusColumn('doing', 'In Progress', { wipLimit: 3 }),
        statusColumn('review', 'Review', { wipLimit: 2 }),
        statusColumn('done', 'Done'),
      ],
      doneColumnId: 'done',
      swimlaneBy: 'none',
      cardFields: WORK_FIELDS,
      widgets: ['progress', 'wip', 'filter'],
      addTypes: ['task', 'action', 'note'],
      hideWriting: false,
    },
  },
  // A to-do list of Actions (docs/specs/026-plan/plan-board.md "The To-do List board"): To Do and Done, Compact
  // cards (a dense list of short items) showing who has each and when it is due.
  todo: {
    label: 'To-do List',
    setup: {
      title: 'To-do list',
      columns: [statusColumn('todo', 'To Do'), statusColumn('done', 'Done')],
      doneColumnId: 'done',
      swimlaneBy: 'none',
      cardFields: ['assignee', 'due', 'checklist'],
      cardSize: 'compact',
      widgets: ['progress', 'due'],
      addTypes: ['action'],
      hideWriting: false,
    },
  },
  sprint: {
    label: 'Sprint Board',
    setup: {
      title: 'Sprint',
      columns: [
        statusColumn('sprint-backlog', 'Sprint Backlog'),
        statusColumn('doing', 'In Progress'),
        statusColumn('review', 'In Review'),
        statusColumn('done', 'Done'),
      ],
      doneColumnId: 'done',
      swimlaneBy: 'assignee',
      cardFields: ['key', 'type', 'priority', 'labels', 'estimate', 'checklist'],
      widgets: ['points', 'progress', 'filter'],
      addTypes: ['story', 'task', 'action'],
      hideWriting: false,
    },
  },
  'bug-triage': {
    label: 'Bug Triage',
    setup: {
      title: 'Bug triage',
      columns: [
        statusColumn('new', 'New'),
        statusColumn('confirmed', 'Confirmed'),
        statusColumn('fixing', 'Fixing', { wipLimit: 4 }),
        statusColumn('fixed', 'Fixed'),
        statusColumn('wont-fix', 'Won’t Fix'),
      ],
      doneColumnId: 'fixed',
      swimlaneBy: 'priority',
      cardFields: ['key', 'assignee', 'labels', 'due'],
      widgets: ['count', 'unassigned', 'filter'],
      addTypes: ['bug', 'task'],
      hideWriting: false,
    },
  },
  retro: {
    label: 'Retro Board',
    setup: {
      title: 'Retro',
      columns: [
        statusColumn('went-well', 'Went Well', { color: '#16a34a' }),
        statusColumn('to-improve', 'To Improve', { color: '#dc2626' }),
        statusColumn('ideas', 'Ideas', { color: '#0d9488' }),
      ],
      swimlaneBy: 'none',
      cardFields: ['assignee', 'votes'],
      widgets: ['top-voted'],
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
      columns: [
        statusColumn('now', 'Now'),
        statusColumn('next', 'Next'),
        statusColumn('later', 'Later'),
      ],
      swimlaneBy: 'none',
      cardFields: ['key', 'assignee', 'labels', 'start', 'due'],
      widgets: ['count', 'due', 'filter'],
      addTypes: ['project'],
      hideWriting: false,
    },
  },
  weekly: {
    label: 'Weekly Planner',
    setup: {
      title: 'This week',
      columns: [
        statusColumn('mon', 'Monday'),
        statusColumn('tue', 'Tuesday'),
        statusColumn('wed', 'Wednesday'),
        statusColumn('thu', 'Thursday'),
        statusColumn('fri', 'Friday'),
      ],
      swimlaneBy: 'none',
      cardFields: ['type', 'due', 'checklist'],
      widgets: ['count', 'due', 'filter'],
      addTypes: ['task', 'action', 'note'],
      hideWriting: false,
    },
  },
  // Every card that is not archived, a row per status (docs/specs/026-plan/plan-board.md "All Cards").
  'all-cards': {
    label: 'All Cards',
    setup: {
      title: 'All Cards',
      columns: [statusColumn('all', 'All Cards')],
      swimlaneBy: 'status',
      cardFields: ['key', 'type', 'assignee', 'priority', 'due'],
      cardSize: 'compact',
      allCards: true,
      widgets: ['count', 'types', 'filter'],
      hideWriting: false,
    },
  },
  // Only archived items (docs/specs/026-plan/items.md "Archive"), in one column.
  archive: {
    label: 'Archive Board',
    setup: {
      title: 'Archive',
      columns: [statusColumn('archived', 'Archived')],
      swimlaneBy: 'none',
      cardFields: ['key', 'type', 'assignee', 'labels'],
      cardSize: 'compact',
      archive: true,
      widgets: ['count', 'filter'],
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

// A board placed on the canvas (docs/specs/026-plan/plan-mode.md "The palette"): a column whose name a status the
// document already has (`existing`: status id to name) takes that status, so one name is always one status and the
// cards in it show here too; any other column gets a status of its own (`todo~k3f9`), so it starts empty. An
// Archive or All Cards board shows cards by what they are, not by status, so it keeps its columns as they are.
export function freshBoardSetup(
  id: unknown,
  random: () => number = Math.random,
  existing: Iterable<readonly [string, string]> = [],
): PlanBoardSetup {
  const setup = presetSetupOrBlank(id);
  if (setup.archive || setup.allCards) return setup;
  const names = [...existing];
  const suffix = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join('');
  const used = new Set<string>();
  return {
    ...setup,
    columns: setup.columns.map((c) => {
      const named = statusNamed(c.name, names);
      if (named && !used.has(named.status)) {
        used.add(named.status);
        return { ...c, status: named.status };
      }
      return { ...c, status: `${c.status}~${suffix}` };
    }),
  };
}
