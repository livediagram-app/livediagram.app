import { normaliseBoardSetup } from '@livediagram/items';
import { describe, expect, it } from 'vitest';
import {
  BOARDS,
  PLAN_TEMPLATE_KINDS,
  buildPlanTemplate,
  isPlanTemplateKind,
  planTemplateSetup,
} from './template-builders-plan';

// The Plan templates (docs/specs/025-plan/plan-mode.md "Templates"): boards set up for their use, no cards.

// apps/live PlanBoardView: PLAN_COLUMN_MIN_PX, the grid's gap-3 and the body's px-3.
const COLUMN_MIN_PX = 220;
const GAP_PX = 12;
const SIDE_PADDING_PX = 12;

describe('plan templates', () => {
  it('each make a set-up that survives normaliseBoardSetup unchanged', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const setup = planTemplateSetup(kind);
      // A Detailed card size is stored as absent: absent is Detailed.
      const { cardSize, ...rest } = setup;
      const expected = cardSize === 'detailed' ? rest : setup;
      expect(normaliseBoardSetup(setup), kind).toEqual(expected);
    }
  });

  it('fit every column at its narrowest without scrolling sideways', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const slots = planTemplateSetup(kind).columns.reduce((n, c) => n + (c.width ?? 1), 0);
      const need = slots * COLUMN_MIN_PX + Math.max(0, slots - 1) * GAP_PX + 2 * SIDE_PADDING_PX;
      expect(BOARDS[kind].width, kind).toBeGreaterThanOrEqual(need);
    }
  });

  it('give each column a unique id and status, and a done column that is one of them', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const setup = planTemplateSetup(kind);
      expect(new Set(setup.columns.map((c) => c.id)).size, kind).toBe(setup.columns.length);
      expect(new Set(setup.columns.map((c) => c.status)).size, kind).toBe(setup.columns.length);
      if (setup.doneColumnId)
        expect(
          setup.columns.map((c) => c.id),
          kind,
        ).toContain(setup.doneColumnId);
    }
  });

  it('sets up the Project Overview a row per project, At Risk in amber', () => {
    const setup = planTemplateSetup('project-overview');
    expect(setup.title).toBe('Project overview');
    expect(setup.columns.map((c) => c.name)).toEqual([
      'Not Started',
      'In Progress',
      'At Risk',
      'Done',
    ]);
    expect(setup.columns[2]?.color).toBe('#d97706');
    expect(setup.doneColumnId).toBe('done');
    expect(setup.swimlaneBy).toBe('parent');
    expect(setup.cardSize).toBe('detailed');
    expect(setup.cardFields).toEqual([
      'key',
      'type',
      'assignee',
      'priority',
      'start',
      'due',
      'checklist',
      'parent',
    ]);
    expect(setup.addTypes).toEqual(['project', 'task']);
    expect(setup.widgets).toEqual(['progress', 'due', 'people', 'priorities', 'stale', 'filter']);
  });

  it('sets up the Daily Standup a row per person, with how to run it beside the board', () => {
    const setup = planTemplateSetup('daily-standup');
    expect(setup.title).toBe('Daily standup');
    expect(setup.columns.map((c) => c.name)).toEqual(['Yesterday', 'Today', 'Blocked']);
    expect(setup.columns[2]?.color).toBe('#dc2626');
    expect(setup.swimlaneBy).toBe('assignee');
    expect(setup.cardSize).toBe('compact');
    expect(setup.addTypes).toEqual(['task', 'note', 'action']);
    expect(setup.widgets).toEqual(['people', 'unassigned', 'count', 'filter', 'mine']);
    const els = buildPlanTemplate('daily-standup', 0, 0);
    const sticky = els.find((el) => el.type === 'sticky') as { label?: string; x: number };
    expect(sticky.label).toBe(
      'How we run it\n1. Each person: yesterday, today, blockers\n2. Two minutes each\n3. Blockers get an owner after',
    );
    expect(sticky.x).toBeGreaterThan(BOARDS['daily-standup'].width / 2);
  });

  it('sets up the Content Calendar and the Hiring Pipeline with a done column', () => {
    const content = planTemplateSetup('content-calendar');
    expect(content.columns.map((c) => c.name)).toEqual([
      'Ideas',
      'Drafting',
      'In Review',
      'Scheduled',
      'Published',
    ]);
    expect(content.doneColumnId).toBe('published');
    expect(content.swimlaneBy).toBe('none');
    expect(content.cardFields).toEqual(['key', 'type', 'assignee', 'labels', 'due']);
    expect(content.addTypes).toEqual(['idea', 'task']);
    expect(content.widgets).toEqual(['count', 'progress', 'due', 'people', 'filter']);

    const hiring = planTemplateSetup('hiring-pipeline');
    expect(hiring.columns.map((c) => c.name)).toEqual([
      'Applied',
      'Screen',
      'Interview',
      'Offer',
      'Hired',
      'Not Progressing',
    ]);
    expect(hiring.doneColumnId).toBe('hired');
    expect(hiring.addTypes).toEqual(['task', 'note']);
    expect(hiring.widgets).toEqual(['count', 'progress', 'stale', 'people', 'filter']);
  });

  it('makes only the board, plus a how-to sticky for the run sessions', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const els = buildPlanTemplate(kind, 0, 0);
      const extra = kind === 'team-retro' || kind === 'daily-standup' ? 1 : 0;
      expect(els, kind).toHaveLength(1 + extra);
      expect(
        els.filter((el) => el.type === 'shape' && el.shape === 'plan-board'),
        kind,
      ).toHaveLength(1);
    }
  });

  it('hands out a fresh set-up each time', () => {
    const a = planTemplateSetup('hiring-pipeline');
    a.columns.pop();
    expect(planTemplateSetup('hiring-pipeline').columns).toHaveLength(6);
    expect(isPlanTemplateKind('daily-standup')).toBe(true);
    expect(isPlanTemplateKind('swot')).toBe(false);
  });
});
