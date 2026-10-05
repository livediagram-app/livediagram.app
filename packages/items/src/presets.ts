// Board presets: the set-ups a palette board tile or a template starts from
// (docs/specs/025-plan/plan-mode.md "The palette", "Templates").

import type { CardField, PlanBoardSetup, PlanColumn } from './board';

export const PLAN_BOARD_PRESET_IDS = [
  'blank',
  'kanban',
  'sprint',
  'bug-triage',
  'retro',
  'roadmap',
  'weekly',
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
    label: 'Blank board',
    setup: {
      title: 'Board',
      columns: [col('todo', 'To do'), col('doing', 'In progress'), col('done', 'Done')],
      doneColumnId: 'done',
      swimlaneBy: 'none',
      scope: {},
      cardFields: WORK_FIELDS,
      voting: { on: false },
      hideWriting: false,
    },
  },
  kanban: {
    label: 'Kanban board',
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
      scope: {},
      cardFields: WORK_FIELDS,
      voting: { on: false },
      hideWriting: false,
    },
  },
  sprint: {
    label: 'Sprint board',
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
      scope: { types: ['task'] },
      cardFields: ['key', 'type', 'priority', 'labels', 'estimate', 'checklist'],
      voting: { on: false },
      hideWriting: false,
    },
  },
  'bug-triage': {
    label: 'Bug triage',
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
      // Bugs are tasks labelled `bug` (docs/specs/025-plan/items.md "Item types").
      scope: { types: ['task'], label: 'bug' },
      cardFields: ['key', 'assignee', 'labels', 'due'],
      voting: { on: false },
      hideWriting: false,
    },
  },
  retro: {
    label: 'Retro board',
    setup: {
      title: 'Retro',
      columns: [
        col('went-well', 'Went well', { color: '#16a34a' }),
        col('to-improve', 'To improve', { color: '#dc2626' }),
        col('ideas', 'Ideas', { color: '#0d9488' }),
        col('actions', 'Actions', { color: '#db2777' }),
      ],
      swimlaneBy: 'none',
      scope: { types: ['note', 'idea', 'action'] },
      cardFields: ['assignee', 'votes'],
      voting: { on: true, budget: 5 },
      hideWriting: true,
    },
  },
  roadmap: {
    label: 'Roadmap',
    setup: {
      title: 'Roadmap',
      columns: [col('now', 'Now'), col('next', 'Next'), col('later', 'Later')],
      swimlaneBy: 'none',
      scope: { types: ['project'] },
      cardFields: ['key', 'assignee', 'labels'],
      voting: { on: false },
      hideWriting: false,
    },
  },
  weekly: {
    label: 'Weekly planner',
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
      scope: {},
      cardFields: ['type', 'due', 'checklist'],
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
