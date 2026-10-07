// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createShape, type PlanViewRef, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { PlanViewView } from './PlanViewView';

// docs/specs/026-plan/plan-views.md "Row order": a row's grip drags it to a new place in its lane; Alt+Arrow moves
// it one place; the chart's order is written once.
afterEach(cleanup);

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const project = (id: string, key: number, title: string, due: string, status = 'todo'): Item => ({
  id,
  type: 'project',
  key,
  rank: `r${key}`,
  fields: { title, due, status },
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
});
// Date order: Alpha, Beta, Gamma.
const A = project('item-alpha', 1, 'Alpha', '2026-10-01');
const B = project('item-betaa', 2, 'Beta', '2026-10-05');
const C = project('item-gamma', 3, 'Gamma', '2026-10-09', 'done');

function chart(settings: Omit<PlanViewRef, 'view'> = {}, over: Partial<PlanContextValue> = {}) {
  const plan = {
    items: new Map([A, B, C].map((i) => [i.id, i])),
    types: ITEM_TYPES,
    status: 'ready',
    planInput: true,
    canEdit: true,
    openItem: vi.fn(),
    updateView: vi.fn(),
    announce: vi.fn(),
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
  const el = {
    ...createShape('plan-view', 0, 0),
    id: 'chart',
    planView: { view: 'gantt', ...settings },
  } as ShapeElement;
  render(
    <PlanProvider value={plan}>
      <PlanViewView element={el} />
    </PlanProvider>,
  );
  return plan;
}

const names = () =>
  screen
    .getAllByRole('button', { name: /^#\d+ / })
    .map((b) => b.getAttribute('aria-label')!.split(',')[0]);
const grip = (id: string) =>
  document.querySelector(`[data-gantt-row="${id}"] [data-gantt-row-grip]`) as HTMLElement;

describe('reordering Gantt rows', () => {
  it('shows a grip on hover or focus to an editor only, and follows a saved order', () => {
    chart({ rowOrder: ['item-gamma', 'item-alpha'] });
    expect(names()).toEqual(['#3 Gamma', '#1 Alpha', '#2 Beta']);
    expect(grip('item-alpha').className).toMatch(/opacity-0/);
    expect(grip('item-alpha').className).toMatch(/group-hover:opacity-100/);
    expect(grip('item-alpha').className).toMatch(/group-focus-within:opacity-100/);
    cleanup();
    chart({}, { canEdit: false });
    expect(document.querySelector('[data-gantt-row-grip]')).toBeNull();
  });

  it('drags a row down two places and writes the order once', () => {
    const plan = chart();
    fireEvent.pointerDown(grip('item-alpha'), { button: 0, clientY: 100 });
    fireEvent.pointerMove(window, { clientY: 165 });
    expect(document.querySelector('[data-gantt-drop-line]')).not.toBeNull();
    fireEvent.pointerUp(window, { clientY: 165 });
    expect(plan.updateView).toHaveBeenCalledTimes(1);
    expect(plan.updateView).toHaveBeenCalledWith('chart', {
      view: 'gantt',
      rowOrder: ['item-betaa', 'item-gamma', 'item-alpha'],
    });
    // The grip's press never opens the card.
    expect(plan.openItem).not.toHaveBeenCalled();
  });

  it('drops nothing on Escape, or when let go where it started', () => {
    const plan = chart();
    fireEvent.pointerDown(grip('item-alpha'), { button: 0, clientY: 100 });
    fireEvent.pointerMove(window, { clientY: 165 });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(window, { clientY: 165 });
    fireEvent.pointerDown(grip('item-betaa'), { button: 0, clientY: 100 });
    fireEvent.pointerMove(window, { clientY: 105 });
    fireEvent.pointerUp(window, { clientY: 105 });
    expect(plan.updateView).not.toHaveBeenCalled();
  });

  it('moves a row one place with Alt+Arrow, and says so', () => {
    const plan = chart();
    fireEvent.keyDown(screen.getByRole('button', { name: /^#1 Alpha/ }), {
      key: 'ArrowDown',
      altKey: true,
    });
    expect(plan.updateView).toHaveBeenCalledWith('chart', {
      view: 'gantt',
      rowOrder: ['item-betaa', 'item-alpha', 'item-gamma'],
    });
    expect(plan.announce).toHaveBeenCalledWith('Moved #1 Alpha to position 2 of 3');
    // At the top, Alt+Up does nothing.
    vi.mocked(plan.updateView).mockClear();
    fireEvent.keyDown(screen.getByRole('button', { name: /^#1 Alpha/ }), {
      key: 'ArrowUp',
      altKey: true,
    });
    expect(plan.updateView).not.toHaveBeenCalled();
  });

  it('keeps a row in its swimlane however far it is dragged', () => {
    // By status: Alpha and Beta are To do, Gamma is Done.
    const plan = chart({ swimlaneBy: 'status' });
    fireEvent.pointerDown(grip('item-alpha'), { button: 0, clientY: 100 });
    fireEvent.pointerMove(window, { clientY: 400 });
    fireEvent.pointerUp(window, { clientY: 400 });
    expect(plan.updateView).toHaveBeenCalledWith('chart', {
      view: 'gantt',
      swimlaneBy: 'status',
      rowOrder: ['item-betaa', 'item-alpha', 'item-gamma'],
    });
  });
});
