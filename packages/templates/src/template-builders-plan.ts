// The Plan templates (docs/specs/025-plan/plan-mode.md "Templates"): each is a Plan board with the
// set-up its use wants, opening in Plan mode. A template holds only the set-up: it comes with no cards.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createSticky, type Element } from '@livediagram/document';
import {
  presetSetup,
  type PlanBoardPresetId,
  type PlanBoardSetup,
  type PlanColumn,
} from '@livediagram/items';

export const PLAN_TEMPLATE_KINDS = [
  'blank-plan',
  'kanban',
  'sprint-board',
  'bug-triage',
  'team-retro',
  'roadmap-board',
  'weekly-planner',
  'project-overview',
  'daily-standup',
  'content-calendar',
  'hiring-pipeline',
] as const;
export type PlanTemplateKind = (typeof PLAN_TEMPLATE_KINDS)[number];

// A board's set-up is its preset's, with `setup` laid over it: a template made for one use carries its
// columns and choices here rather than as a palette preset of its own.
export type BoardSpec = {
  preset: PlanBoardPresetId;
  setup?: Partial<PlanBoardSetup>;
  width: number;
  height: number;
  title: string;
};

// A column whose status is its id (the presets' `col()` style).
function col(status: string, name: string, extra: Partial<PlanColumn> = {}): PlanColumn {
  return { id: status, status, name, ...extra };
}

const AMBER = '#d97706';
const RED = '#dc2626';

// Widths fit every column at its narrowest (PLAN_COLUMN_MIN_PX, 220px, plus the 12px gaps and the
// body's 12px side padding) with room to spare, so a fresh board never scrolls sideways.
export const BOARDS: Record<PlanTemplateKind, BoardSpec> = {
  'blank-plan': { preset: 'blank', width: 900, height: 560, title: 'Our board' },
  kanban: { preset: 'kanban', width: 1400, height: 720, title: 'Checkout team' },
  'sprint-board': {
    preset: 'sprint',
    width: 1320,
    height: 860,
    title: 'Sprint 14: Faster checkout',
  },
  'bug-triage': { preset: 'bug-triage', width: 1400, height: 800, title: 'Bug triage' },
  'team-retro': { preset: 'retro', width: 1200, height: 720, title: 'Sprint 14 retro' },
  'roadmap-board': { preset: 'roadmap', width: 1100, height: 640, title: 'Product roadmap' },
  'weekly-planner': { preset: 'weekly', width: 1400, height: 600, title: 'This week' },
  // A row per project, its tasks across the stages.
  'project-overview': {
    preset: 'blank',
    width: 1100,
    height: 720,
    title: 'Project overview',
    setup: {
      columns: [
        col('not-started', 'Not Started'),
        col('in-progress', 'In Progress'),
        col('at-risk', 'At Risk', { color: AMBER }),
        col('done', 'Done'),
      ],
      doneColumnId: 'done',
      swimlaneBy: 'parent',
      cardSize: 'detailed',
      cardFields: ['key', 'type', 'assignee', 'priority', 'due', 'checklist', 'parent'],
      addTypes: ['project', 'task'],
      widgets: ['progress', 'due', 'people', 'priorities', 'stale', 'filter'],
    },
  },
  // A row per person: yesterday, today and what blocks them.
  'daily-standup': {
    preset: 'blank',
    width: 900,
    height: 640,
    title: 'Daily standup',
    setup: {
      columns: [
        col('yesterday', 'Yesterday'),
        col('today', 'Today'),
        col('blocked', 'Blocked', { color: RED }),
      ],
      swimlaneBy: 'assignee',
      cardSize: 'compact',
      addTypes: ['task', 'note', 'action'],
      widgets: ['people', 'unassigned', 'count', 'filter', 'mine'],
    },
  },
  'content-calendar': {
    preset: 'blank',
    width: 1320,
    height: 680,
    title: 'Content calendar',
    setup: {
      columns: [
        col('ideas', 'Ideas'),
        col('drafting', 'Drafting'),
        col('in-review', 'In Review'),
        col('scheduled', 'Scheduled'),
        col('published', 'Published'),
      ],
      doneColumnId: 'published',
      swimlaneBy: 'none',
      cardFields: ['key', 'type', 'assignee', 'labels', 'due'],
      addTypes: ['idea', 'task'],
      widgets: ['count', 'progress', 'due', 'people', 'filter'],
    },
  },
  'hiring-pipeline': {
    preset: 'blank',
    width: 1520,
    height: 680,
    title: 'Hiring pipeline',
    setup: {
      columns: [
        col('applied', 'Applied'),
        col('screen', 'Screen'),
        col('interview', 'Interview'),
        col('offer', 'Offer'),
        col('hired', 'Hired'),
        col('not-progressing', 'Not Progressing'),
      ],
      doneColumnId: 'hired',
      swimlaneBy: 'none',
      addTypes: ['task', 'note'],
      widgets: ['count', 'progress', 'stale', 'people', 'filter'],
    },
  },
};

// The set-up a template's board starts with.
export function planTemplateSetup(kind: PlanTemplateKind): PlanBoardSetup {
  const spec = BOARDS[kind];
  return { ...presetSetup(spec.preset), ...structuredClone(spec.setup ?? {}), title: spec.title };
}

function board(kind: PlanTemplateKind, cx: number, cy: number): Element {
  const spec = BOARDS[kind];
  return {
    ...createShape('plan-board', cx - spec.width / 2, cy - spec.height / 2),
    width: spec.width,
    height: spec.height,
    planBoard: planTemplateSetup(kind),
  };
}

// A sticky beside the board with how a session is run: a retro or a standup is run, not just filled in.
const HOW_WE_RUN_IT: Partial<Record<PlanTemplateKind, string>> = {
  'team-retro':
    'How we run it\n1. Write notes: they stay hidden\n2. Reveal together\n3. Vote: 5 each\n4. Turn the top votes into Actions',
  'daily-standup':
    'How we run it\n1. Each person: yesterday, today, blockers\n2. Two minutes each\n3. Blockers get an owner after',
};

function runSteps(label: string, cx: number, cy: number, spec: BoardSpec): Element {
  const note = createSticky(cx + spec.width / 2 + 40, cy - spec.height / 2);
  return { ...note, width: 240, height: 240, label, textSize: 'sm' };
}

export function buildPlanTemplate(kind: PlanTemplateKind, cx: number, cy: number): Element[] {
  const elements: Element[] = [board(kind, cx, cy)];
  const steps = HOW_WE_RUN_IT[kind];
  if (steps) elements.push(runSteps(steps, cx, cy, BOARDS[kind]));
  return elements;
}

export function isPlanTemplateKind(kind: string): kind is PlanTemplateKind {
  return (PLAN_TEMPLATE_KINDS as readonly string[]).includes(kind);
}
