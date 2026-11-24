import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livediagram/document';
import type { PlanDiagramDraw, PlanDiagramGraph } from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import {
  documentFromPlan,
  PLAN_CAPTION_ID,
  PLAN_TITLE_ID,
  planDiagramTab,
  planGraphInput,
} from './internal-plan-diagram';

// View As Diagram's door (liveworkspace's diagrams-and-plans.md "The doors"; docs/specs/015-api/api.md "Internal"): a
// board's graph drawn as a lanes canvas whose ids are the plan's own, so a redraw changes only what moved and the editor
// tells the plan's arrows and lanes from a person's. A 500-card board draws inside a redraw's budget.

const graph = (cards = 3): PlanDiagramGraph => ({
  title: 'Launch',
  lanes: [
    { id: 'todo', label: 'To Do' },
    { id: 'done', label: 'Done' },
  ],
  nodes: Array.from({ length: cards }, (_, i) => ({
    card: `c${i}`,
    label: `Card ${i}`,
    lane: i % 2 ? 'done' : 'todo',
    done: i % 2 === 1,
    critical: i === 0,
    link: `https://lp.test/project/P#item=c${i}`,
  })),
  edges: Array.from({ length: Math.max(0, cards - 1) }, (_, i) => ({
    from: `c${i}`,
    to: `c${i + 1}`,
    critical: i === 0,
  })),
  total: cards,
});
const draw = (over: Partial<PlanDiagramDraw> = {}): PlanDiagramDraw => ({
  owner: 'user_ada',
  name: 'Launch diagram',
  graph: graph(),
  caption: 'Drawn from Launch plan',
  link: 'https://lp.test/project/P',
  ...over,
});
const env = {} as Env;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('planGraphInput', () => {
  it('draws lanes as groups, the critical path strong and thick, a done card muted, each box linked', () => {
    const input = planGraphInput(draw());
    expect(input).toMatchObject({
      title: 'Launch',
      subtitle: 'Drawn from Launch plan',
      style: 'lanes',
    });
    expect(input.groups).toEqual([
      { id: 'lane:todo', label: 'To Do' },
      { id: 'lane:done', label: 'Done' },
    ]);
    expect(input.nodes[0]).toMatchObject({
      id: 'card:todo:c0',
      group: 'lane:todo',
      tone: 'strong',
    });
    expect(input.nodes[1]).toMatchObject({
      id: 'card:done:c1',
      tone: 'muted',
      link: expect.stringContaining('c1'),
    });
    expect(input.nodes[2]!.tone).toBeUndefined();
    expect(input.edges).toEqual([
      { from: 'card:todo:c0', to: 'card:done:c1', line: 'thick' },
      { from: 'card:done:c1', to: 'card:todo:c2' },
    ]);
  });
});

describe('planDiagramTab', () => {
  it("gives the drawing the plan's ids: dep arrows, the heading, and a caption that opens the plan", () => {
    const tab = planDiagramTab(draw())!;
    const ids = tab.elements.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'card:todo:c0',
        'lane:todo',
        'dep:c0:c1',
        'dep:c1:c2',
        PLAN_TITLE_ID,
      ]),
    );
    const caption = tab.elements.find((e) => e.id === PLAN_CAPTION_ID) as Element & {
      link?: unknown;
    };
    expect(caption.link).toEqual({ kind: 'url', url: 'https://lp.test/project/P' });
  });

  it('draws an empty board as its heading alone, named for the diagram when the board has no title', () => {
    const tab = planDiagramTab(draw({ graph: { ...graph(0), title: '' } }))!;
    expect(tab.name).toBe('Launch diagram');
    expect(tab.elements.some((e) => e.id.startsWith('card:'))).toBe(false);
  });

  it('answers null when the engine refuses the graph', () => {
    const bad = graph(2);
    bad.edges = [{ from: 'c0', to: 'missing', critical: false }];
    expect(planDiagramTab(draw({ graph: bad }))).toBeNull();
  });

  it('lays out a 500-card board with 499 links well inside a redraw budget', () => {
    const big = draw({ graph: graph(500) });
    const out: { tab: ReturnType<typeof planDiagramTab> } = { tab: null };
    const ms = cpuMsOf(() => {
      out.tab = planDiagramTab(big);
    });
    const tab = out.tab!;
    expect(tab.elements.filter((e) => e.id.startsWith('card:'))).toHaveLength(500);
    expect(tab.elements.filter((e) => e.id.startsWith('dep:'))).toHaveLength(499);
    // Measured 172 ms (272 KB of elements) on a loaded laptop; the budget is a shared runner's CPU time.
    expect(ms).toBeLessThan(cpuBudgetMs(1_500));
    // The payload a redraw sends the room stays well under the changeset's limits.
    expect(JSON.stringify(tab.elements).length).toBeLessThan(1_000_000);
  });
});

describe('documentFromPlan', () => {
  it('redraws the named tab in its room as the owner', async () => {
    const drawPlanTab = vi.fn(async () => ({ status: 'ok' as const }));
    const out = await documentFromPlan(env, draw({ itemId: 'D', tabId: 't9' }), () => ({
      drawPlanTab,
      outline: vi.fn(),
    }));
    expect(out).toEqual({ status: 'ok', id: 'D', tabId: 't9' });
    expect(drawPlanTab).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 't9', owner: 'user_ada' }),
    );
  });

  it("passes on a redraw the room refuses, and refuses a graph the engine can't draw", async () => {
    const room = () => ({
      drawPlanTab: async () => ({ status: 'not_found' as const }),
      outline: vi.fn(),
    });
    expect(await documentFromPlan(env, draw({ itemId: 'D', tabId: 't9' }), room)).toEqual({
      status: 'not_found',
    });
    const bad = { ...graph(2), edges: [{ from: 'c0', to: 'x', critical: false }] };
    expect(
      await documentFromPlan(env, draw({ itemId: 'D', tabId: 't9', graph: bad }), room),
    ).toEqual({
      status: 'invalid_graph',
    });
    expect(await documentFromPlan(env, draw({ graph: bad }), room)).toEqual({
      status: 'invalid_graph',
    });
  });

  it("makes a new canvas of the owner's, answering its drawn tab", async () => {
    const importFile = vi.fn(async () => ({ status: 'ok' as const, id: 'NEW' }));
    const outline = vi.fn(async () => ({ tabs: [{ id: 'tab-1' }] }));
    const room = () => ({ drawPlanTab: vi.fn(), outline }) as never;
    expect(await documentFromPlan(env, draw(), room, importFile as never)).toEqual({
      status: 'ok',
      id: 'NEW',
      tabId: 'tab-1',
    });
    expect(importFile).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ owner: 'user_ada', name: 'Launch diagram' }),
    );
  });

  it('answers too large, a refused import and a canvas with no tab', async () => {
    const room = (tabs: { id: string }[]) => () =>
      ({ drawPlanTab: vi.fn(), outline: async () => ({ tabs }) }) as never;
    const imp = (result: unknown) => (async () => result) as never;
    expect(await documentFromPlan(env, draw(), room([]), imp({ status: 'too_large' }))).toEqual({
      status: 'too_large',
    });
    expect(await documentFromPlan(env, draw(), room([]), imp({ status: 'invalid' }))).toEqual({
      status: 'invalid_graph',
    });
    expect(await documentFromPlan(env, draw(), room([]), imp({ status: 'ok', id: 'N' }))).toEqual({
      status: 'not_found',
    });
  });
});
