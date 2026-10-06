import { isPlanViewId, normaliseBoardSetup, type PlanBoardSetup } from '@livediagram/items';
import type { Element } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import {
  PLAN_TEMPLATE_KINDS,
  PLAN_TEMPLATE_TABS,
  boardSetup,
  buildPlanTab,
  buildPlanTemplate,
  isPlanTemplateKind,
  planTemplateTabs,
} from './template-builders-plan';
import { templateTabs } from './build-template';

// The Plan templates (docs/specs/026-plan/plan-templates.md): ways of working across tabs, no cards.

// apps/live PlanBoardView: PLAN_COLUMN_MIN_PX, the grid's gap-3 and the body's px-3.
const COLUMN_MIN_PX = 220;
const GAP_PX = 12;
const SIDE_PADDING_PX = 12;

const everyTab = () =>
  PLAN_TEMPLATE_KINDS.flatMap((kind) =>
    PLAN_TEMPLATE_TABS[kind].map((spec) => ({ kind, spec, label: `${kind} › ${spec.name}` })),
  );

const boardsOf = (els: Element[]) =>
  els.flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-board' && el.planBoard
      ? [el.planBoard as PlanBoardSetup]
      : [],
  );

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('plan templates', () => {
  it('pins each template’s tabs, in order', () => {
    const names = Object.fromEntries(
      PLAN_TEMPLATE_KINDS.map((k) => [k, PLAN_TEMPLATE_TABS[k].map((t) => t.name)]),
    );
    expect(names).toEqual({
      'blank-plan': ['Board'],
      'project-planner': ['Roadmap', 'Backlog', 'Sprint', 'Daily Standup'],
      kanban: ['Board', 'Requests', 'Flow'],
      'bug-triage': ['Triage', 'Fixing', 'Health'],
      'team-retro': ['Retro', 'Actions', 'Archive'],
      'weekly-planner': ['This Week', 'Inbox', 'Calendar'],
      'content-calendar': ['Ideas', 'Production', 'Calendar'],
      'hiring-pipeline': ['Roles', 'Pipeline', 'Onboarding'],
      okrs: ['Objectives', 'Key Results'],
      'product-launch': ['Timeline', 'Checklist', 'Launch Day'],
      'feedback-board': ['Feedback', 'Delivery'],
    });
  });

  it('make a set-up that survives normaliseBoardSetup unchanged', () => {
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const setup = boardSetup(spec.board);
      // A Detailed card size is stored as absent: absent is Detailed.
      const { cardSize, ...rest } = setup;
      const expected = cardSize === 'detailed' ? rest : setup;
      expect(normaliseBoardSetup(setup), label).toEqual(expected);
    }
  });

  it('fit every column at its narrowest without scrolling sideways', () => {
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const slots = boardSetup(spec.board).columns.reduce((n, c) => n + (c.width ?? 1), 0);
      const need = slots * COLUMN_MIN_PX + Math.max(0, slots - 1) * GAP_PX + 2 * SIDE_PADDING_PX;
      expect(spec.board.width, label).toBeGreaterThanOrEqual(need);
    }
  });

  it('give each column a unique id and status, and a done column that is one of them', () => {
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const setup = boardSetup(spec.board);
      expect(new Set(setup.columns.map((c) => c.id)).size, label).toBe(setup.columns.length);
      expect(new Set(setup.columns.map((c) => c.status)).size, label).toBe(setup.columns.length);
      if (setup.doneColumnId)
        expect(
          setup.columns.map((c) => c.id),
          label,
        ).toContain(setup.doneColumnId);
    }
  });

  it('name a status the same on every board of a template that shares it', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const names = new Map<string, string>();
      for (const spec of PLAN_TEMPLATE_TABS[kind]) {
        if (!spec.board) continue;
        const setup = boardSetup(spec.board);
        if (setup.archive || setup.allCards) continue;
        for (const c of setup.columns) {
          expect(names.get(c.status) ?? c.name, `${kind} ${c.status}`).toBe(c.name);
          names.set(c.status, c.name);
        }
      }
    }
  });

  it('hand cards from one tab to the next through a shared status', () => {
    const statuses = (kind: (typeof PLAN_TEMPLATE_KINDS)[number], tab: string) => {
      const spec = PLAN_TEMPLATE_TABS[kind].find((t) => t.name === tab)!;
      return boardSetup(spec.board!).columns.map((c) => c.status);
    };
    // Backlog's This Sprint is the Sprint board's first column; Daily Standup walks the Sprint's.
    expect(statuses('project-planner', 'Backlog')).toContain('sprint');
    expect(statuses('project-planner', 'Sprint')[0]).toBe('sprint');
    for (const s of statuses('project-planner', 'Daily Standup'))
      expect(statuses('project-planner', 'Sprint')).toContain(s);
    expect(statuses('kanban', 'Requests')).toContain('backlog');
    expect(statuses('kanban', 'Board')[0]).toBe('backlog');
    expect(statuses('bug-triage', 'Fixing')[0]).toBe('confirmed');
    expect(statuses('bug-triage', 'Triage')).toContain('confirmed');
    expect(statuses('content-calendar', 'Production')[0]).toBe('approved');
    expect(statuses('content-calendar', 'Ideas')).toContain('approved');
    expect(statuses('feedback-board', 'Delivery')[0]).toBe('fb-planned');
    expect(statuses('feedback-board', 'Feedback')).toContain('fb-planned');
  });

  it('keeps the Retro to notes and ideas, with its actions on a board of their own', () => {
    const [retro, actions, archive] = PLAN_TEMPLATE_TABS['team-retro'];
    const setup = boardSetup(retro!.board!);
    expect(setup.columns.map((c) => c.name)).toEqual(['Went Well', 'To Improve', 'Ideas']);
    expect(setup.addTypes).toEqual(['note', 'idea']);
    expect(setup.voting).toEqual({ on: true, budget: 5 });
    expect(setup.hideWriting).toBe(true);
    expect(boardSetup(actions!.board!).addTypes).toEqual(['action']);
    expect(boardSetup(archive!.board!).archive).toBe(true);
  });

  it('puts a Gantt under every board of Project cards', () => {
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const projectsOnly = boardSetup(spec.board).addTypes?.join() === 'project';
      expect(spec.charts?.includes('gantt') ?? false, label).toBe(projectsOnly);
    }
  });

  it('lays a tab out without overlaps, every view a real one, centred on the point', () => {
    for (const { spec, label } of everyTab()) {
      const els = buildPlanTab(spec, 100, -50) as unknown as (Element & Box)[];
      expect(els.length, label).toBeGreaterThan(0);
      for (let i = 0; i < els.length; i++)
        for (let j = i + 1; j < els.length; j++)
          expect(overlaps(els[i]!, els[j]!), `${label} ${i}/${j}`).toBe(false);
      for (const el of els)
        if (el.type === 'shape' && el.shape === 'plan-view')
          expect(isPlanViewId(el.planView?.view), label).toBe(true);
      const minX = Math.min(...els.map((e) => e.x));
      const maxX = Math.max(...els.map((e) => e.x + e.width));
      const minY = Math.min(...els.map((e) => e.y));
      const maxY = Math.max(...els.map((e) => e.y + e.height));
      expect(Math.abs((minX + maxX) / 2 - 100), label).toBeLessThanOrEqual(1);
      expect(Math.abs((minY + maxY) / 2 + 50), label).toBeLessThanOrEqual(1);
    }
  });

  it('gives a dashboard tab views only, and every other tab exactly one board', () => {
    for (const { spec, label } of everyTab()) {
      const els = buildPlanTab(spec, 0, 0);
      expect(boardsOf(els), label).toHaveLength(spec.board ? 1 : 0);
      if (!spec.board) expect(spec.charts?.length ?? 0, label).toBeGreaterThan(0);
    }
  });

  it('runs the standup with a timer and a picker, and the retro with a check-in', () => {
    const shapes = (els: Element[]) =>
      els.flatMap((el) =>
        el.type === 'shape' ? [el.shape] : el.type === 'sticky' ? ['sticky'] : [],
      );
    const daily = PLAN_TEMPLATE_TABS['project-planner'][3]!;
    expect(shapes(buildPlanTab(daily, 0, 0))).toEqual([
      'plan-board',
      'sticky',
      'session-button',
      'picker',
    ]);
    const timer = buildPlanTab(daily, 0, 0).find(
      (el) => el.type === 'shape' && el.shape === 'session-button',
    );
    expect(timer && 'session' in timer ? timer.session : null).toEqual({
      tool: 'timer',
      minutes: 15,
    });
    const retro = PLAN_TEMPLATE_TABS['team-retro'][0]!;
    expect(shapes(buildPlanTab(retro, 0, 0))).toEqual([
      'plan-board',
      'sticky',
      'temperature',
      'session-button',
    ]);
  });

  it('names the tabs of a template with several, and leaves a one-tab template’s name to the caller', () => {
    expect(planTemplateTabs('blank-plan').map((t) => t.name)).toEqual([null]);
    expect(planTemplateTabs('okrs').map((t) => t.name)).toEqual(['Objectives', 'Key Results']);
    expect(templateTabs('swot').map((t) => t.name)).toEqual([null]);
    // The first tab is what buildTemplate makes.
    expect(boardsOf(templateTabs('kanban')[0]!.build(0, 0))).toEqual(
      boardsOf(buildPlanTemplate('kanban', 0, 0)),
    );
  });

  it('hands out a fresh set-up each time', () => {
    const spec = PLAN_TEMPLATE_TABS['hiring-pipeline'][1]!.board!;
    boardSetup(spec).columns.pop();
    expect(boardSetup(spec).columns).toHaveLength(6);
    expect(isPlanTemplateKind('okrs')).toBe(true);
    expect(isPlanTemplateKind('daily-standup')).toBe(false);
  });
});
