// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createShape, type PlanViewRef, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, type Item, type PlanViewId } from '@livediagram/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { PlanViewView } from './PlanViewView';

// docs/specs/026-plan/plan-views.md.
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

function planWith(items: Item[], over: Partial<PlanContextValue> = {}): PlanContextValue {
  return {
    items: new Map(items.map((i) => [i.id, i])),
    types: ITEM_TYPES,
    status: 'ready',
    planInput: true,
    canEdit: true,
    openItem: vi.fn(),
    statusNames: new Map([
      ['todo', 'To do'],
      ['done', 'Done'],
    ]),
    statusPhases: new Map([
      ['todo', 'todo'],
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
  const el = {
    ...createShape('plan-view', 0, 0),
    planView: { view, ...settings },
  } as ShapeElement;
  return render(
    <PlanProvider value={plan}>
      <PlanViewView element={el} />
    </PlanProvider>,
  );
}

afterEach(cleanup);

describe('plan views', () => {
  it('say so while the cards load, and show their empty state without any', () => {
    draw('gantt', planWith([], { status: 'loading' }));
    expect(screen.getByText('Loading cards…')).toBeTruthy();
    cleanup();
    draw('gantt', planWith([]));
    expect(screen.getByText('No cards of these types yet.')).toBeTruthy();
    cleanup();
    draw('workload', undefined);
    expect(
      screen.getByText('No cards yet. Add cards to a board to see how they split.'),
    ).toBeTruthy();
  });

  it("draws a project's own Colour on its Gantt bar and as a dot by its name", () => {
    const own = item(
      { title: 'Green', start: '2026-10-01', due: '2026-10-10', color: '#16a34a' },
      'project',
    );
    const plain = item({ title: 'Plain', start: '2026-10-02', due: '2026-10-12' }, 'project');
    const { container } = draw('gantt', planWith([own, plain]));
    expect(screen.getByRole('img', { name: 'Green colour' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /colour$/ })).toHaveLength(1);
    const edges = [...container.querySelectorAll<HTMLElement>('span.rounded-full.border')].map(
      (b) => b.style.borderColor,
    );
    // The coloured project's bar takes its colour; the other keeps the Project colour.
    expect(edges).toContain('rgb(22, 163, 74)');
    expect(edges.some((c) => c !== 'rgb(22, 163, 74)')).toBe(true);
  });

  it('draws a Gantt row per project, opening it in Plan mode, with no prompts for missing dates', () => {
    const p = item({ title: 'Launch', due: '2026-10-20' }, 'project');
    const kid = item({ title: 'Kid', parent: p.id, status: 'done' });
    const plan = planWith([p, kid]);
    draw('gantt', plan);
    fireEvent.click(screen.getByRole('button', { name: `#${p.key} Launch, 1 of 1 done` }));
    expect(plan.openItem).toHaveBeenCalledWith(p.id);
    expect(screen.queryByText('Add a start date')).toBeNull();
    // The today line's label, and the header's Today.
    expect(screen.getAllByText('Today')).toHaveLength(2);
  });

  it('switches the Gantt scale and steps its window', () => {
    const p = item({ title: 'Launch', start: '2026-10-01', due: '2026-10-20' }, 'project');
    draw('gantt', planWith([p]));
    // The cards fit a month, so it opens on Month.
    expect(screen.getByRole('button', { name: 'Month' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getByRole('button', { name: 'Year' }).getAttribute('aria-pressed')).toBe('true');
    const firstTick = () => screen.getAllByText(/^[A-Z][a-z]{2}( \d{4})?$/)[0]!.textContent;
    const before = firstTick();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(firstTick()).not.toBe(before);
  });

  it('offers no scale or steps outside Plan mode', () => {
    const p = item({ title: 'Quiet', due: '2026-10-20' }, 'project');
    draw('gantt', planWith([p], { planInput: false, canEdit: false }));
    expect(screen.queryByRole('button', { name: 'Year' })).toBeNull();
  });

  it('opens a card on a double-click only, outside Plan mode', () => {
    const p = item({ title: 'Quiet' }, 'project');
    const plan = planWith([p], { planInput: false, canEdit: false });
    draw('gantt', plan);
    expect(screen.queryByText(/No dates/)).toBeNull();
    const row = screen.getByRole('button', { name: `#${p.key} Quiet` });
    fireEvent.click(row);
    expect(plan.openItem).not.toHaveBeenCalled();
    fireEvent.doubleClick(row);
    expect(plan.openItem).toHaveBeenCalledWith(p.id);
  });

  it('lists due cards on the calendar and steps months', () => {
    const now = new Date();
    const p = (x: number) => String(x).padStart(2, '0');
    const due = `${now.getFullYear()}-${p(now.getMonth() + 1)}-15`;
    draw('calendar', planWith([item({ title: 'Ship it', due })]));
    expect(screen.getByRole('button', { name: /Ship it/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next Month' }));
    expect(screen.queryByRole('button', { name: /Ship it/ })).toBeNull();
    expect(screen.getByText('Nothing due this month.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('button', { name: /Ship it/ })).toBeTruthy();
  });

  it('charts workload, status and priority', () => {
    const cards = [
      item({ title: 'a', assignee: SAM, status: 'done', priority: 'urgent' }),
      item({ title: 'b', status: 'todo' }),
    ];
    draw('workload', planWith(cards));
    expect(screen.getByText('Sam')).toBeTruthy();
    expect(screen.getByText('No assignee')).toBeTruthy();
    cleanup();
    draw('status-mix', planWith(cards));
    expect(screen.getByRole('img', { name: 'To do 1, Done 1' })).toBeTruthy();
    cleanup();
    draw('priority-matrix', planWith(cards));
    expect(screen.getByRole('cell', { name: 'Urgent, Done: 1' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'No Priority, Not Started: 1' })).toBeTruthy();
  });

  it('draws a metric over every card, with no set-up', () => {
    const cards = [item({ title: 'a', status: 'done' }), item({ title: 'b', status: 'todo' })];
    draw('metric:progress', planWith(cards));
    expect(screen.getByRole('group', { name: 'Completion, every card' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '50% done, 1 of 2' })).toBeTruthy();
    cleanup();
    draw('metric:progress', planWith(cards, { statusPhases: new Map() }));
    expect(screen.getByText('No done column')).toBeTruthy();
  });
});

// docs/specs/026-plan/plan-views.md "Drawing dates".
describe('drawing dates on the Gantt', () => {
  it('gives a project with no dates a week from a click on its row', () => {
    const p = item({ title: 'Undated' }, 'project');
    const patchItem = vi.fn();
    draw('gantt', planWith([p], { patchItem }));
    const track = document.querySelector('[data-own-wheel-x]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 350, 300));
    const row = document.querySelector('[data-gantt-draw]') as HTMLElement;
    fireEvent.pointerDown(row, { button: 0, clientX: 0 });
    fireEvent.pointerUp(window, { clientX: 0 });
    expect(patchItem).toHaveBeenCalledTimes(1);
    const { set } = patchItem.mock.calls[0]![1] as { set: { start: string; due: string } };
    const days = (Date.parse(set.due) - Date.parse(set.start)) / 86_400_000;
    expect(days).toBe(6);
    expect(screen.queryByText(/No dates/)).toBeNull();
  });

  it('offers no drawing to someone who may not edit', () => {
    const p = item({ title: 'Undated' }, 'project');
    draw('gantt', planWith([p], { canEdit: false }));
    expect(document.querySelector('[data-gantt-draw]')).toBeNull();
  });
});

// docs/specs/026-plan/plan-views.md "Maximised view".
describe('a maximised view', () => {
  it('fills the screen from its header, and restores in place', () => {
    const p = item({ title: 'Launch', due: '2026-10-20' }, 'project');
    draw('gantt', planWith([p]));
    fireEvent.click(screen.getByRole('button', { name: 'Maximise View' }));
    expect(document.querySelector('[data-maximised-board]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore View' }));
    expect(document.querySelector('[data-maximised-board]')).toBeNull();
  });

  it('offers no Maximise outside Plan mode, or on a metric', () => {
    draw('gantt', planWith([], { planInput: false }));
    expect(screen.queryByRole('button', { name: 'Maximise View' })).toBeNull();
    cleanup();
    draw('metric:progress', planWith([]));
    expect(screen.queryByRole('button', { name: 'Maximise View' })).toBeNull();
  });
});

// docs/specs/026-plan/plan-views.md "Gantt Chart": status, swimlanes, names column width.
describe('the Gantt rows', () => {
  it('shows a project’s status as a pill, and names it on the row', () => {
    const p = item({ title: 'Launch', status: 'todo', start: '2026-10-01' }, 'project');
    draw('gantt', planWith([p]));
    expect(screen.getByText('To do')).toBeTruthy();
    expect(screen.getByRole('button', { name: `#${p.key} Launch, To do` })).toBeTruthy();
  });

  it('shows a dot, named in a tooltip, in a narrow names column', () => {
    const p = item({ title: 'Launch', status: 'todo', start: '2026-10-01' }, 'project');
    draw('gantt', planWith([p]), { namesWidth: 130 });
    expect(screen.getByRole('img', { name: 'To do' })).toBeTruthy();
    expect(screen.queryByText('To do')).toBeNull();
  });

  it('groups rows into swimlanes with headers that collapse, and still draws dates inside one', () => {
    const a = item({ title: 'Alpha', priority: 'high', start: '2026-10-01' }, 'project');
    const b = item({ title: 'Beta', priority: 'low' }, 'project');
    const patchItem = vi.fn();
    draw('gantt', planWith([a, b], { patchItem }), { swimlaneBy: 'priority' });
    const high = screen.getByRole('button', { name: 'High, 1 project' });
    expect(screen.getByRole('button', { name: 'Low, 1 project' })).toBeTruthy();
    fireEvent.click(high);
    expect(high.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: `#${a.key} Alpha` })).toBeNull();
    // Beta, undated, sits in the Low lane and still draws.
    const track = document.querySelector('[data-own-wheel-x]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 350, 300));
    fireEvent.pointerDown(document.querySelector('[data-gantt-draw]')!, { button: 0, clientX: 0 });
    fireEvent.pointerUp(window, { clientX: 0 });
    expect(patchItem).toHaveBeenCalledWith(b.id, expect.anything());
  });

  it('resizes the names column from its separator, saving one width', () => {
    const p = item({ title: 'Launch', start: '2026-10-01' }, 'project');
    const updateView = vi.fn();
    const { container } = draw('gantt', planWith([p], { updateView }), { namesWidth: 200 });
    const edge = screen.getByRole('separator', { name: 'Resize Names Column' });
    expect(edge.getAttribute('aria-valuenow')).toBe('200');
    fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(updateView).toHaveBeenLastCalledWith(expect.any(String), {
      view: 'gantt',
      namesWidth: 216,
    });
    expect(container).toBeTruthy();
  });

  it('previews a dragged width, saves it once on release, and drops it on Escape', () => {
    const p = item({ title: 'Launch', start: '2026-10-01' }, 'project');
    const updateView = vi.fn();
    draw('gantt', planWith([p], { updateView }), { namesWidth: 200 });
    const edge = () => screen.getByRole('separator', { name: 'Resize Names Column' });
    fireEvent.pointerDown(edge(), { button: 0, clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 40 });
    expect(edge().getAttribute('aria-valuenow')).toBe('240');
    expect(updateView).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 40 });
    expect(updateView).toHaveBeenCalledTimes(1);
    expect(updateView.mock.calls[0]![1]).toMatchObject({ namesWidth: 240 });
    updateView.mockClear();
    fireEvent.pointerDown(edge(), { button: 0, clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 40 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(edge().getAttribute('aria-valuenow')).toBe('200');
    fireEvent.pointerUp(window, { clientX: 40 });
    expect(updateView).not.toHaveBeenCalled();
  });

  it('offers no separator to someone who may not edit', () => {
    const p = item({ title: 'Launch', start: '2026-10-01' }, 'project');
    draw('gantt', planWith([p], { canEdit: false }));
    expect(screen.queryByRole('separator')).toBeNull();
  });
});

// docs/specs/026-plan/plan-views.md "Gantt Chart": card types, and a drag that never opens a card.
describe('the Gantt chart’s card types and drags', () => {
  it('draws the card types it names, counting cards, under its new name', () => {
    const p = item({ title: 'Launch', due: '2026-10-20' }, 'project');
    const t = item({ title: 'Write copy', start: '2026-10-01', due: '2026-10-05' }, 'task');
    // A Task offers Start once its type has it: the chart draws only types with Start and Due.
    const dated = ITEM_TYPES.map((x) =>
      x.id === 'task' ? { ...x, fields: [...x.fields, 'start'] } : x,
    );
    draw('gantt', planWith([p, t], { types: dated }), { types: ['task'] });
    expect(screen.getByText('Gantt Chart')).toBeTruthy();
    expect(screen.getByText('Write copy')).toBeTruthy();
    expect(screen.queryByText('Launch')).toBeNull();
    expect(screen.getByLabelText('1 card')).toBeTruthy();
    cleanup();
    // Without Start on Task, the chart names it but draws none of its cards.
    draw('gantt', planWith([p, t]), { types: ['task'] });
    expect(screen.queryByText('Write copy')).toBeNull();
  });

  it('opens no card when a bar-end drag is let go off its handle', () => {
    const p = item({ title: 'Launch', start: '2026-10-01', due: '2026-10-20' }, 'project');
    const patchItem = vi.fn();
    const plan = planWith([p], { patchItem });
    draw('gantt', plan);
    const track = document.querySelector('[data-own-wheel-x]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 350, 300));
    const handle = document.querySelector('[data-gantt-handle="to"]') as HTMLElement;
    const row = handle.parentElement as HTMLElement;
    fireEvent.pointerDown(handle, { button: 0, clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 200 });
    fireEvent.pointerUp(window, { clientX: 200 });
    expect(patchItem).toHaveBeenCalledTimes(1);
    // The release lands on the row, off the handle: its click is swallowed.
    fireEvent.click(row);
    expect(plan.openItem).not.toHaveBeenCalled();
    // A later, plain press on the row still opens the card.
    fireEvent.click(row);
    expect(plan.openItem).toHaveBeenCalledWith(p.id);
  });
});
