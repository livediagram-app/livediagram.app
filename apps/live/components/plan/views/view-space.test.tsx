// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createShape, type PlanViewRef, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, type Item, type PlanViewId } from '@livediagram/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { PlanViewView } from './PlanViewView';

// docs/specs/026-plan/plan-views.md "Using the space": the larger views fit their content to the box they get.
const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
let n = 0;
const item = (fields: Item['fields'], type = 'task'): Item => {
  n += 1;
  return {
    id: `i${n}`,
    type,
    key: n,
    rank: `r${n}`,
    fields,
    rev: 1,
    createdBy: SAM,
    updatedBy: SAM,
    createdAt: 0,
    updatedAt: 0,
  };
};

function planWith(items: Item[]): PlanContextValue {
  return {
    items: new Map(items.map((i) => [i.id, i])),
    types: ITEM_TYPES,
    status: 'ready',
    planInput: true,
    canEdit: true,
    openItem: vi.fn(),
    updateView: vi.fn(),
    statusNames: new Map([
      ['todo', 'To do'],
      ['doing', 'Doing'],
      ['done', 'Done'],
    ]),
    statusPhases: new Map([
      ['todo', 'todo'],
      ['doing', 'doing'],
      ['done', 'done'],
    ]),
  } as unknown as PlanContextValue;
}

function draw(
  view: PlanViewId,
  plan: PlanContextValue,
  size: { width: number; height: number },
  settings: Omit<PlanViewRef, 'view'> = {},
) {
  const el = {
    ...createShape('plan-view', 0, 0),
    ...size,
    planView: { view, ...settings },
  } as ShapeElement;
  return render(
    <PlanProvider value={plan}>
      <PlanViewView element={el} />
    </PlanProvider>,
  );
}

afterEach(cleanup);

const CARDS = () => [
  item({ title: 'Alpha', assignee: SAM, status: 'done', priority: 'urgent' }),
  item({ title: 'Beta', status: 'todo', priority: 'high' }),
  item({ title: 'Gamma', status: 'doing' }),
];

describe('Card Search uses its space', () => {
  it('lays the cards out side by side in a wide view, each opening its card', () => {
    const plan = planWith(CARDS());
    draw('search', plan, { width: 1280, height: 800 });
    const grid = screen.getByRole('list', { name: 'Matching cards' });
    expect(grid.style.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /^Open Beta/ }));
    expect(plan.openItem).toHaveBeenCalledWith(expect.stringMatching(/^i/));
  });

  it('falls back to one column in a narrow slot', () => {
    draw('search', planWith(CARDS()), { width: 240, height: 400 });
    expect(screen.getByRole('list', { name: 'Matching cards' }).style.gridTemplateColumns).toBe(
      'repeat(1, minmax(0, 1fr))',
    );
  });
});

describe('Card Search caps what it draws', () => {
  it('draws the first 200 matches and counts the rest', () => {
    const many = Array.from({ length: 205 }, (_, i) => item({ title: `Card ${i}` }));
    draw('search', planWith(many), { width: 720, height: 400 });
    expect(screen.getAllByRole('button', { name: /^Open Card/ })).toHaveLength(200);
    expect(screen.getByText('Showing 200 of 205. Add a filter to narrow the search.')).toBeTruthy();
  });
});

describe('Cards by Field uses its space', () => {
  const bar = (name: RegExp) =>
    screen.getByRole('listitem', { name }).querySelector<HTMLElement>('[data-bar]')!;

  it('thickens the bars and grows the rows in a large view', () => {
    draw('workload', planWith(CARDS()), { width: 1200, height: 800 });
    expect(bar(/^Sam/).style.height).toBe('44px');
    expect(screen.getByRole('listitem', { name: /^Sam/ }).style.fontSize).toBe('16px');
  });

  it('keeps thin bars in a small slot', () => {
    draw('workload', planWith(CARDS()), { width: 320, height: 140 });
    expect(parseInt(bar(/^Sam/).style.height)).toBeLessThan(20);
  });
});

describe('Priority by Status uses its space', () => {
  it('grows its counts with the cells', () => {
    draw('priority-matrix', planWith(CARDS()), { width: 1400, height: 900 });
    expect(screen.getByRole('cell', { name: 'Urgent, Done: 1' }).style.fontSize).toBe('44px');
    cleanup();
    draw('priority-matrix', planWith(CARDS()), { width: 240, height: 180 });
    expect(screen.getByRole('cell', { name: 'Urgent, Done: 1' }).style.fontSize).toBe('12px');
  });
});

// docs/specs/026-plan/plan-views.md "Statuses".
describe('a chart counts only the statuses it names', () => {
  it('Priority by Status leaves out the cards in other statuses', () => {
    draw('priority-matrix', planWith(CARDS()), { width: 720, height: 400 }, { statuses: ['todo'] });
    expect(screen.getByRole('cell', { name: 'High, Not Started: 1' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Urgent, Done: 0' })).toBeTruthy();
  });

  it('Cards by Field too, and says so when nothing is left', () => {
    draw('workload', planWith(CARDS()), { width: 720, height: 400 }, { statuses: ['done'] });
    expect(screen.getByRole('listitem', { name: /^Sam: 1 card,/ })).toBeTruthy();
    expect(screen.queryByRole('listitem', { name: /^No assignee/ })).toBeNull();
    cleanup();
    draw('workload', planWith(CARDS()), { width: 720, height: 400 }, { statuses: ['gone'] });
    expect(screen.getByText('No cards in the chosen statuses.')).toBeTruthy();
  });
});
