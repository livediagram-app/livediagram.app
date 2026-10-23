import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { PLAN_VIEW_IDS, defaultCatalogue, type Item } from '@liveplanner/items';
import { DASHBOARD_ROWS_MAX, DASHBOARD_SLOTS_MAX } from '@liveplanner/project';
import { buildTemplateTabs } from '@liveplanner/templates';
import type { ProjectDTO, Env } from './types';

// docs/specs/013-workspace/live-image-share.md "What a Dashboard draws": a Dashboard's live image draws its metrics and
// charts from the project's cards, on the Worker's CPU budget. The worst realistic page (the Project Planner's Overview,
// every metric, chart and tab slot it brings) over a project of cards renders well inside a request's budget.
const db = vi.hoisted(() => ({
  getTabBody: vi.fn(),
  getProjectItemTypes: vi.fn(),
  listItems: vi.fn(),
  listSheets: vi.fn(),
  dashboardSourceTabs: vi.fn(),
  stampTabElementCount: vi.fn(),
  getThumbRenderedAt: vi.fn(),
  markThumbRendered: vi.fn(),
  thumbnailKey: (id: string) => `thumb/${id}`,
}));
vi.mock('./db', () => db);

import { renderPlanImage } from './thumbnail';

let ids = 0;
const tabs = buildTemplateTabs({ id: 't0', name: 'Roadmap' }, 'project-planner', () => `t${++ids}`);
const dashboard = tabs.find((t) => t.kind === 'dashboard')!;
const others = tabs.filter((t) => t !== dashboard);
// The statuses the template's boards name, so the cards spread over every column.
const statuses = others.flatMap((t) =>
  t.elements.flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-board'
      ? (el as { planBoard: { columns: { status: string }[] } }).planBoard.columns.map(
          (c) => c.status,
        )
      : [],
  ),
);

function cards(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    type: i % 5 === 0 ? 'project' : 'task',
    key: i + 1,
    rank: `a${i}`,
    fields: {
      title: `Card ${i}`,
      status: statuses[i % statuses.length]!,
      priority: (['urgent', 'high', 'medium', 'low'] as const)[i % 4],
      due: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
      start: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
    },
    rev: 1,
    createdAt: 0,
    updatedAt: i,
    createdBy: { id: 'p', name: 'P', color: '#000000' },
    updatedBy: { id: 'p', name: 'P', color: '#000000' },
  })) as unknown as Item[];
}

// The stored shape of a tab (body minus id and name), as getTabBody returns it.
function stored(tab: Tab) {
  const { id: _id, name: _name, ...body } = tab;
  return { id: tab.id, data: JSON.stringify(body), elementCount: tab.elements.length };
}

const project = {
  id: 'd1',
  name: 'Planner',
  savedAt: 1000,
  itemTypes: defaultCatalogue(),
} as Pick<ProjectDTO, 'id' | 'name' | 'savedAt' | 'itemTypes'>;

async function timed(n: number) {
  db.listItems.mockResolvedValue(cards(n));
  const env = {
    SNAPSHOTS: { get: vi.fn(), put: vi.fn().mockResolvedValue(undefined) },
  } as unknown as Env;
  // The plan's side of a stale snapshot (its Durable Object draws it). Warm once (module-level caches, the first JIT pass), then time the median of a few renders.
  await renderPlanImage(env as never, project, null);
  const runs: number[] = [];
  let svg = '';
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    svg = (await renderPlanImage(env as never, project, null)) ?? '';
    runs.push(performance.now() - t);
  }
  runs.sort((a, b) => a - b);
  return { ms: runs[2]!, svg };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.stampTabElementCount.mockResolvedValue(undefined);
  db.getThumbRenderedAt.mockResolvedValue(null);
  db.markThumbRendered.mockResolvedValue(undefined);
  db.getTabBody.mockResolvedValue(stored(dashboard));
  db.listSheets.mockResolvedValue([]);
  db.dashboardSourceTabs.mockResolvedValue(others);
});

describe('a Dashboard’s live image at size', () => {
  it('draws the Overview over 50 cards, and over 2,000, within budget', async () => {
    const small = await timed(50);
    const large = await timed(2000);
    console.info('[perf] dashboard live image', {
      slots: dashboard.dashboard?.rows.flatMap((r) => r.slots).length,
      ms50: Math.round(small.ms * 10) / 10,
      ms2000: Math.round(large.ms * 10) / 10,
      bytes50: small.svg.length,
    });
    expect(small.svg.length).toBeGreaterThan(0);
    // Measured at about 3 ms (50 cards) and 5 ms (2,000) on an M-series laptop, against 0.2 ms for the labelled boxes
    // drawn before; a loaded CI runner gets four times that.
    expect(small.ms).toBeLessThan(400);
    expect(large.ms).toBeLessThan(1500);
    // Every metric and chart is drawn, none left as a box labelled with its kind.
    expect(small.svg).toContain('Card 1');
  });

  // The largest page there can be: every row of every slot a chart or metric, over the most cards a project holds.
  it('draws 12 rows of 4 charts and metrics over 2,000 cards within budget', async () => {
    const views = Array.from({ length: DASHBOARD_ROWS_MAX * DASHBOARD_SLOTS_MAX }, (_, i) => ({
      id: `v${i}`,
      type: 'shape',
      shape: 'plan-view',
      x: 0,
      y: 0,
      width: 340,
      height: 320,
      planView: { view: PLAN_VIEW_IDS[i % PLAN_VIEW_IDS.length] },
    }));
    const full = {
      ...dashboard,
      elements: views,
      dashboard: {
        rows: Array.from({ length: DASHBOARD_ROWS_MAX }, (_, r) => ({
          id: `r${r}`,
          height: 320,
          slots: Array.from({ length: DASHBOARD_SLOTS_MAX }, (_, k) => ({
            id: `s${r}-${k}`,
            span: 3,
            content: { type: 'element', elementId: `v${r * DASHBOARD_SLOTS_MAX + k}` },
          })),
        })),
      },
    } as unknown as Tab;
    db.getTabBody.mockResolvedValue(stored(full));
    const { ms, svg } = await timed(2000);
    console.info('[perf] fullest dashboard live image', { ms: Math.round(ms * 10) / 10 });
    expect(svg.length).toBeGreaterThan(0);
    // Measured at about 37 ms on an M-series laptop: the 48 pictures are most of it (plan-view-art.perf.test.ts).
    expect(ms).toBeLessThan(2000);
  });
});
