// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ITEM_TYPES } from '@liveplanner/items';
import { planPalette } from '../plan-palette';
import type { PlanContextValue } from '../PlanContext';
import { GanttAddCard, ganttNewCardDates } from './GanttAddCard';

afterEach(cleanup);

const plan = (over: Partial<PlanContextValue> = {}) =>
  ({
    types: ITEM_TYPES,
    statusNames: new Map([['todo', 'To do']]),
    canEditCards: true,
    addItem: vi.fn(() => Promise.resolve(true)),
    openNewItem: vi.fn(),
    ...over,
  }) as unknown as PlanContextValue;

const palette = planPalette('light');

describe('Add Card on a Gantt chart', () => {
  it('starts a card today, due a week on', () => {
    expect(ganttNewCardDates(new Date(2026, 9, 28))).toEqual({
      start: '2026-10-28',
      due: '2026-11-04',
    });
  });

  it('starts a range of days, or a timed range at the default hour, in its one field', () => {
    expect(
      ganttNewCardDates(new Date(2026, 9, 28), {
        start: 'f-when',
        due: 'f-when',
        shapes: { start: 'daterange', due: 'daterange' },
      }),
    ).toEqual({ 'f-when': ['2026-10-28', '2026-11-04'] });
    const timed = ganttNewCardDates(new Date(2026, 9, 28), {
      start: 'start',
      due: 'f-at',
      shapes: { due: 'datetime' },
    });
    expect(timed['start']).toBe('2026-10-28');
    const at = timed['f-at'];
    expect(typeof at).toBe('string');
    expect(new Date(Date.parse((at as string).replace(/\[.*\]$/, ''))).getHours()).toBe(9);
  });

  it('offers the chart’s own types and adds a dated card, opened to be named', () => {
    const p = plan();
    render(
      <GanttAddCard
        viewId="g"
        plan={p}
        types={ITEM_TYPES}
        shown="project"
        palette={palette}
        top={0}
        height={40}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));
    expect(screen.queryByRole('menuitem', { name: /Task/ })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: /Project/ }));
    const input = vi.mocked(p.addItem).mock.calls[0]![0];
    expect(input.type).toBe('project');
    expect(input.fields).toMatchObject(ganttNewCardDates(new Date()));
    expect(p.openNewItem).toHaveBeenCalledWith(input.id);
  });

  it('is not there for someone who may not add cards, or with no types to add', () => {
    render(
      <GanttAddCard
        viewId="g"
        plan={plan({ canEditCards: false })}
        types={ITEM_TYPES}
        shown="project"
        palette={palette}
        top={0}
        height={40}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Add Card' })).toBeNull();
    cleanup();
    render(
      <GanttAddCard
        viewId="g"
        plan={plan()}
        types={ITEM_TYPES}
        shown=""
        palette={palette}
        top={0}
        height={40}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Add Card' })).toBeNull();
  });
});

// docs/specs/026-plan/plan-views.md "Gantt Chart": Add Card stays in reach when the rows run past the chart.
describe('Add Card under many rows', () => {
  it('pins to the foot of the names column, at full strength on the surface', () => {
    render(
      <GanttAddCard
        viewId="g"
        plan={plan()}
        types={ITEM_TYPES}
        shown="project"
        palette={palette}
        top={2000}
        height={40}
      />,
    );
    const button = screen.getByRole('button', { name: 'Add Card' });
    const slot = button.closest('[data-gantt-add-card]') as HTMLElement;
    // The lower of under the last row and the column's foot (jsdom drops the inner calc()).
    expect(slot.style.top).toMatch(/^min\(2000px, (calc\()?100% - 40px\)?\)$/);
    expect(button.className).not.toContain('opacity-');
  });

  it('offers an Editor Add New Card Type, a new type with Start and Due for this chart', () => {
    const createTypeForView = vi.fn();
    render(
      <GanttAddCard
        viewId="g"
        plan={plan({ canEdit: true, createTypeForView })}
        types={ITEM_TYPES}
        shown=""
        palette={palette}
        top={0}
        height={40}
      />,
    );
    // No type to draw yet: Add Card is still there, for Add New Card Type.
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add New Card Type/ }));
    expect(createTypeForView).toHaveBeenCalledWith('g');
  });

  it('offers no Add New Card Type to a Participant', () => {
    render(
      <GanttAddCard
        viewId="g"
        plan={plan({ canEdit: false })}
        types={ITEM_TYPES}
        shown="project"
        palette={palette}
        top={0}
        height={40}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));
    expect(screen.queryByRole('menuitem', { name: /Add New Card Type/ })).toBeNull();
  });
});
