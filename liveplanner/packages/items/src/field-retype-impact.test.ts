import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import {
  IMPACT_ROWS_SHOWN,
  fieldRetypeImpact,
  impactShown,
  type RetypeImpactInput,
} from './field-retype-impact';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';

// docs/specs/026-plan/item-types.md "Edit Field": Built-in fields, "What stops reading it".
const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  fields: ['title', 'status', 'assignee', 'priority', 'estimate', 'start', 'due', 'f-days'],
  custom: [
    {
      id: 'f-days',
      label: 'Days Left',
      kind: 'calculated',
      calculation: 'formula',
      formula: '{due} - 1',
    },
  ],
};
const EPIC: ItemTypeDef = {
  ...TASK,
  id: 'epic',
  label: 'Epic',
  fields: ['title', 'status', 'f-tasks', 'f-latest', 'f-sum'],
  custom: [
    { id: 'f-tasks', label: 'Tasks', kind: 'card', linkType: 'task', multiple: true },
    {
      id: 'f-latest',
      label: 'Latest Due',
      kind: 'calculated',
      calculation: 'lookup',
      through: 'f-tasks',
      source: 'due',
    },
    {
      id: 'f-other',
      label: 'Other',
      kind: 'calculated',
      calculation: 'lookup',
      through: 'f-gone',
      source: 'due',
    },
  ],
};
const STORY: ItemTypeDef = {
  ...TASK,
  id: 'story',
  label: 'Story',
  fields: ['title', 'status', 'due', 'f-epic'],
  custom: [{ id: 'f-epic', label: 'Epic', kind: 'card', linkType: 'project' }],
};
const PROJECT: ItemTypeDef = {
  ...TASK,
  id: 'project',
  label: 'Project',
  fields: ['title', 'status', 'f-sum'],
  custom: [
    {
      id: 'f-sum',
      label: 'Total Due',
      kind: 'calculated',
      calculation: 'rollup',
      source: 'due',
      aggregate: 'max',
    },
  ],
};

const board = (
  title: string,
  extra: Partial<PlanBoardSetup>,
): { title: string; setup: PlanBoardSetup } => ({
  title,
  setup: {
    title,
    columns: [{ id: 'c', status: 'todo', name: 'To Do' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    widgets: [],
    ...extra,
  },
});

const input = (extra: Partial<RetypeImpactInput>): RetypeImpactInput => ({
  field: 'due',
  name: 'Due Date',
  typeId: 'task',
  boards: [],
  views: [],
  forms: [],
  types: [TASK, EPIC, STORY],
  ...extra,
});

describe('what stops reading a built-in', () => {
  it('lists the boards that sort, lane and show widgets on it, and the CSV export', () => {
    const lines = fieldRetypeImpact(
      input({
        field: 'priority',
        name: 'Priority',
        boards: [
          board('Sprint', {
            sortBy: [{ field: 'priority', dir: 'desc' }],
            swimlaneBy: 'priority',
            widgets: ['priorities', 'count'],
          }),
          board('Other', { addTypes: ['epic'], sortBy: [{ field: 'priority', dir: 'asc' }] }),
          board('Default widgets', { widgets: undefined }),
        ],
      }),
    );
    expect(lines).toEqual([
      'Sprint sorts by Priority',
      'Sprint lanes by Priority',
      'Sprint’s Priorities widget reads Priority',
      'CSV exports write it as a column of its own',
    ]);
  });

  it('lists a field lane and a field widget', () => {
    const lines = fieldRetypeImpact(
      input({
        field: 'due',
        boards: [
          board('Plan', {
            swimlaneBy: 'field',
            swimlaneField: 'due',
            widgets: ['field:upcoming:due', 'due'],
          }),
        ],
      }),
    );
    expect(lines.slice(0, 3)).toEqual([
      'Plan lanes by Due Date',
      'Plan’s Due Date widget reads Due Date',
      'Plan’s Due Soon widget reads Due Date',
    ]);
  });

  it('lists views, forms and the formulas, rollups and lookups reading it', () => {
    const lines = fieldRetypeImpact(
      input({
        types: [TASK, EPIC, STORY, PROJECT],
        views: [
          { view: 'gantt', settings: {} },
          { view: 'calendar', settings: { title: 'Release Days' } },
          { view: 'metric:due', settings: {} },
          { view: 'calendar', settings: { types: ['epic'] } },
          { view: 'workload', settings: { swimlaneBy: 'field', swimlaneField: 'due' } },
          { view: 'workload', settings: {} },
        ],
        forms: [
          { title: 'Bug Report', typeId: 'task', fieldIds: ['due'] },
          { title: 'Idea', typeId: 'idea', fieldIds: ['due'] },
        ],
      }),
    );
    expect(lines).toEqual([
      'Gantt Chart reads Due Date',
      'Release Days reads Due Date',
      'Due Soon reads Due Date',
      'Cards by Field reads Due Date',
      'Bug Report asks for Due Date',
      'Days Left reads Due Date',
      'Latest Due reads Due Date',
    ]);
  });

  it('counts a Rollup over children of the type', () => {
    const child: ItemTypeDef = {
      ...TASK,
      fields: [...TASK.fields, 'f-parent'],
      custom: [
        ...TASK.custom!,
        { id: 'f-parent', label: 'Parent Project', kind: 'card', linkType: 'project' },
      ],
    };
    const lines = fieldRetypeImpact(input({ types: [child, PROJECT] }));
    expect(lines).toContain('Total Due reads Due Date');
  });

  it('says nothing when nothing reads it, and caps what it shows', () => {
    expect(fieldRetypeImpact(input({ field: 'estimate', types: [TASK] }))).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => `line ${i}`);
    expect(impactShown(many)).toHaveLength(IMPACT_ROWS_SHOWN + 1);
    expect(impactShown(many).at(-1)).toBe('and 3 more');
    expect(impactShown(['one'])).toEqual(['one']);
  });
});
