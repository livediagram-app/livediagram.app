// @vitest-environment jsdom
// docs/specs/026-plan/plan-views.md "Flow charts": Cycle Time, Throughput and Cumulative Flow drawn from one read of
// their range, every state, hover, keys and opening a card, who sees the cog, and the render held to a CPU budget on a
// 2,000-card plan.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createShape, type PlanViewRef, type ShapeElement } from '@liveplanner/project';
import { DAY_MS, ITEM_TYPES, type FlowCard, type Item, type PlanViewId } from '@liveplanner/items';
import type { FlowResponse } from '@liveplanner/api-schema';
import { PlanProvider, type PlanContextValue } from '../PlanContext';

const fetchFlow = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/flow', () => ({ fetchFlow }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const { PlanViewView } = await import('./PlanViewView');
const { planViewSettingsModel } = await import('./plan-view-settings');
const { FlowRangeOptions } = await import('./FlowRangeOptions');
const { VisualisationPreview } = await import('../dashboard/slot-previews');

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const TO = 20_400;
const FROM = TO - 29;
const card = (n: number, type = 'task'): Item => ({
  id: `i${n}`,
  type,
  key: n,
  rank: `r${n}`,
  fields: { title: `Card ${n}`, status: 'done' },
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
});
// A card started on `start` and finished `took` days later (flow days).
const moved = (n: number, start: number, took: number, type = 'task'): FlowCard => ({
  id: `i${n}`,
  type,
  createdAt: (start - 5) * DAY_MS,
  since: (start - 5) * DAY_MS,
  moves: [
    [start * DAY_MS, 'todo', 'doing'],
    [(start + took) * DAY_MS, 'doing', 'done'],
  ],
});
const ANSWER: FlowResponse = {
  fromDay: FROM,
  toDay: TO,
  counts: [
    { day: FROM - 3, type: 'task', status: 'todo', cards: 6 },
    { day: FROM - 3, type: 'task', status: 'doing', cards: 2 },
    { day: TO - 1, type: 'task', status: 'todo', cards: 3 },
    { day: TO - 1, type: 'task', status: 'doing', cards: 4 },
    { day: TO - 1, type: 'task', status: 'done', cards: 5 },
  ],
  cards: [
    moved(1, FROM + 2, 2),
    moved(2, FROM + 10, 4),
    moved(3, FROM + 20, 6),
    moved(4, FROM, 1, 'bug'),
  ],
};

const SCOPE = { ownerId: 'o', projectId: 'p', shareCode: null, tabId: null };
function planWith(over: Partial<PlanContextValue> = {}): PlanContextValue {
  return {
    items: new Map([1, 2, 3, 4].map((n) => [`i${n}`, card(n)])),
    types: ITEM_TYPES,
    status: 'ready',
    canEdit: true,
    itemsScope: SCOPE,
    openItem: vi.fn(),
    announce: vi.fn(),
    updateView: vi.fn(),
    statusNames: new Map([
      ['todo', 'To Do'],
      ['doing', 'Doing'],
      ['done', 'Done'],
    ]),
    statusPhases: new Map([
      ['todo', 'todo'],
      ['doing', 'doing'],
      ['done', 'done'],
    ]),
    ...over,
  } as unknown as PlanContextValue;
}

function draw(
  view: PlanViewId,
  plan: PlanContextValue | undefined,
  settings: Omit<PlanViewRef, 'view'> = {},
) {
  const el = { ...createShape('plan-view', 0, 0), planView: { view, ...settings } } as ShapeElement;
  return render(
    <PlanProvider value={plan}>
      <PlanViewView element={el} />
    </PlanProvider>,
  );
}

// jsdom lays nothing out: give the plot an on-screen box the size it draws at, so pointer positions map 1:1.
function sizePlots() {
  for (const svg of document.querySelectorAll('svg[viewBox]')) {
    const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 }) as DOMRect;
  }
}

// The summary line reads as one sentence, its figures in bold.
const summaryOf = (text: string) =>
  screen.findByText(
    (_, el) => el?.hasAttribute('data-flow-summary') === true && el.textContent === text,
  );

beforeEach(() => {
  fetchFlow.mockReset();
  fetchFlow.mockResolvedValue(ANSWER);
  track.mockReset();
});
afterEach(cleanup);

describe('flow charts', () => {
  it('name their range, read once for every chart of it, and say so while loading', async () => {
    const plan = planWith();
    render(
      <PlanProvider value={plan}>
        <PlanViewView
          element={{
            ...createShape('plan-view', 0, 0),
            id: 'a',
            planView: { view: 'cycle-time' },
          }}
        />
        <PlanViewView
          element={{
            ...createShape('plan-view', 0, 0),
            id: 'b',
            planView: { view: 'throughput' },
          }}
        />
      </PlanProvider>,
    );
    expect(screen.getAllByText('Loading flow…')).toHaveLength(2);
    await screen.findByText('Cycle Time · Last 30 Days');
    expect(screen.getByText('Throughput · Last 30 Days')).toBeTruthy();
    expect(fetchFlow).toHaveBeenCalledTimes(1);
    expect(fetchFlow).toHaveBeenCalledWith(SCOPE, 30);
  });

  it('draws Cycle Time with its percentiles, and opens a card from a dot by pointer and by keys', async () => {
    const plan = planWith();
    draw('cycle-time', plan, { types: ['task'] });
    const summary = await summaryOf('85% in 6 days or less · 50% in 4');
    expect(summary).toBeTruthy();
    // The bug was left out by the chart's card types.
    const chart = screen.getByRole('group', { name: /Cycle Time: 3 cards finished/ });
    sizePlots();
    const dots = chart.querySelectorAll('circle');
    const first = dots[0]!;
    const svg = chart.querySelector('svg')!;
    fireEvent.pointerMove(svg, {
      clientX: Number(first.getAttribute('cx')),
      clientY: Number(first.getAttribute('cy')),
    });
    expect(screen.getByText('#1 Card 1')).toBeTruthy();
    fireEvent.click(svg);
    expect(plan.openItem).toHaveBeenCalledWith('i1');
    fireEvent.pointerLeave(svg);
    expect(screen.queryByText('#1 Card 1')).toBeNull();
    // Keys: → steps from the first dot, Enter opens it.
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(plan.announce).toHaveBeenLastCalledWith(
      expect.stringMatching(/^#2 Card 2, 4 days, finished/),
    );
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    fireEvent.keyDown(chart, { key: 'Enter' });
    expect(plan.openItem).toHaveBeenLastCalledWith('i1');
    fireEvent.keyDown(chart, { key: 'Tab' });
  });

  it('starts the keys at the newest dot, and names a card no longer in the plan', async () => {
    const plan = planWith({ items: new Map() });
    draw('cycle-time', plan);
    const chart = await screen.findByRole('group', { name: /Cycle Time: 4 cards/ });
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(plan.announce).toHaveBeenLastCalledWith(expect.stringMatching(/^A card no longer here/));
    fireEvent.keyDown(chart, { key: 'Enter' });
    expect(plan.openItem).not.toHaveBeenCalled();
    fireEvent.blur(chart);
  });

  it('draws Throughput per week with its average, and names a hovered week', async () => {
    draw('throughput', planWith(), { rangeDays: 90 });
    await screen.findByText('Throughput · Last 90 Days');
    expect(screen.getByText(/a week on average|No whole week yet/)).toBeTruthy();
    const svg = screen.getByRole('img', { name: /^Throughput:/ });
    sizePlots();
    const bar = svg.querySelector('path')!;
    expect(bar).toBeTruthy();
    const width = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    fireEvent.pointerMove(svg, { clientX: width - 20, clientY: 40 });
    expect(screen.getByText(/finished/, { selector: 'div' })).toBeTruthy();
    fireEvent.pointerMove(svg, { clientX: 1, clientY: 40 });
    fireEvent.pointerLeave(svg);
  });

  it('reads Throughput per day over 14 days', async () => {
    draw('throughput', planWith(), { rangeDays: 14 });
    await screen.findByText(/a day on average|No whole day yet/);
  });

  it('draws Cumulative Flow bands with when counting began, and each status on a hovered day', async () => {
    fetchFlow.mockResolvedValue({ ...ANSWER, counts: ANSWER.counts.slice(2) });
    draw('cumulative-flow', planWith());
    await screen.findByText(/Counting since/);
    expect(screen.getByText('in progress', { exact: false })).toBeTruthy();
    const svg = screen.getByRole('img', { name: /^Cumulative Flow on/ });
    sizePlots();
    const width = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    fireEvent.pointerMove(svg, { clientX: width - 20, clientY: 40 });
    expect(screen.getAllByText('Doing').length).toBeGreaterThan(1);
    fireEvent.pointerMove(svg, { clientX: -5, clientY: 40 });
    fireEvent.pointerLeave(svg);
  });

  it('draws Cumulative Flow from a day carried into the range', async () => {
    draw('cumulative-flow', planWith());
    await screen.findByText('Cumulative Flow · Last 30 Days');
    expect(screen.queryByText(/Counting since/)).toBeNull();
  });

  it('says what is missing: no finishes, no counts, This Browser, a failed read and outside a plan', async () => {
    fetchFlow.mockResolvedValue({ ...ANSWER, counts: [], cards: [] });
    draw('cycle-time', planWith());
    await screen.findByText('No cards finished in this range');
    cleanup();
    draw('cumulative-flow', planWith());
    await screen.findByText('No flow counted yet');
    cleanup();
    fetchFlow.mockResolvedValue('offline');
    draw('throughput', planWith());
    await screen.findByText('Flow Needs a Cloud Plan');
    cleanup();
    fetchFlow.mockRejectedValueOnce(new Error('down'));
    fetchFlow.mockResolvedValueOnce(ANSWER);
    draw('throughput', planWith());
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    await screen.findByText('Throughput · Last 30 Days');
    expect(fetchFlow).toHaveBeenCalledTimes(5);
    cleanup();
    draw('cumulative-flow', undefined);
    expect(screen.getByText('Open the plan to see the flow.')).toBeTruthy();
    cleanup();
    draw('cycle-time', planWith({ status: 'loading' }));
    expect(screen.getByText('Loading flow…')).toBeTruthy();
  });

  it('shows the summary alone in a slot too small for a plot', async () => {
    const plan = planWith();
    const el = {
      ...createShape('plan-view', 0, 0),
      width: 180,
      height: 120,
      planView: { view: 'cycle-time' },
    } as ShapeElement;
    render(
      <PlanProvider value={plan}>
        <PlanViewView element={el} />
      </PlanProvider>,
    );
    await summaryOf('85% in 6 days or less · 50% in 2');
    expect(document.querySelector('[role="group"][aria-roledescription="chart"]')).toBeNull();
  });

  it('gives an Editor the cog and its Range, and Participants and Viewers none', async () => {
    draw('cycle-time', planWith());
    expect(await screen.findByRole('button', { name: 'Chart Settings' })).toBeTruthy();
    cleanup();
    draw('cycle-time', planWith({ canEdit: false }));
    await screen.findByText('Cycle Time · Last 30 Days');
    expect(screen.queryByRole('button', { name: 'Chart Settings' })).toBeNull();
  });

  it('sets the range as one edit, dropping the default, and tracks it', () => {
    const plan = planWith();
    const m = planViewSettingsModel(plan, 'chart', { view: 'throughput', rangeDays: 90 });
    expect(m.flow).toBe(true);
    expect(m.range).toBe(90);
    render(<FlowRangeOptions selected={m.range} onPick={m.setRange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Last 90 Days' }));
    expect(plan.updateView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Last 30 Days' }));
    expect(plan.updateView).toHaveBeenLastCalledWith('chart', { view: 'throughput' });
    fireEvent.click(screen.getByRole('radio', { name: 'Last 180 Days' }));
    expect(plan.updateView).toHaveBeenLastCalledWith('chart', {
      view: 'throughput',
      rangeDays: 180,
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'ViewRange');
  });

  it('have a small picture each in Add to Slot', () => {
    const palette = {
      surface: '#fff',
      border: '#ddd',
      text: '#111',
      muted: '#666',
      column: '#eee',
    };
    for (const view of ['cycle-time', 'throughput', 'cumulative-flow'] as const) {
      const { container } = render(<VisualisationPreview view={view} palette={palette as never} />);
      expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
      cleanup();
    }
  });

  it('draws a busy 2,000-card plan within its CPU budget', async () => {
    const cards: FlowCard[] = Array.from({ length: 2000 }, (_, i) =>
      moved(i + 10, FROM + (i % 25), (i % 9) + 0.5),
    );
    const counts = Array.from({ length: 30 }, (_, d) =>
      ['todo', 'doing', 'done'].map((status, s) => ({
        day: FROM + d,
        type: 'task',
        status,
        cards: 300 + d * s,
      })),
    ).flat();
    fetchFlow.mockResolvedValue({ fromDay: FROM, toDay: TO, counts, cards });
    // One chart holds the range's read; each chart then draws from it at once, measured whole (its model and DOM).
    const plan = planWith();
    draw('throughput', plan);
    await screen.findByText('Throughput · Last 30 Days');
    let ms = 0;
    for (const view of ['cycle-time', 'throughput', 'cumulative-flow'] as const)
      ms += cpuMsOf(() => {
        draw(view, plan);
      });
    expect(
      document.querySelector('[aria-roledescription="chart"]')!.querySelectorAll('circle').length,
    ).toBeGreaterThan(1900);
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});
