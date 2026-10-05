// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  BOARD_WIDGET_KINDS,
  ITEM_TYPES,
  presetSetup,
  projectBoard,
  type BoardWidgetKind,
  type Item,
} from '@livediagram/items';
import { planPalette } from '../plan-palette';
import { BoardWidgetView, type WidgetContext } from './BoardWidgetView';

// docs/specs/026-plan/board-widgets.md "Widget kinds".
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
    createdBy: SAM,
    updatedBy: SAM,
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Item;
};

function ctx(over: Partial<WidgetContext> = {}): WidgetContext {
  const setup = { ...presetSetup('kanban'), voting: { on: true, budget: 3 } };
  const items = [
    item({ title: 'a', status: 'todo', assignee: SAM, due: '2026-10-01' }),
    item({ title: 'b', status: 'doing', due: '2026-10-07' }, 'note'),
    item({ title: 'c', status: 'archived' }),
  ];
  return {
    setup,
    projection: projectBoard(setup, new Map(items.map((i) => [i.id, i]))),
    items: items.slice(0, 2),
    types: ITEM_TYPES,
    palette: planPalette('light', {}),
    quick: {},
    onQuick: vi.fn(),
    canFilterMine: 'sam',
    votesLeft: 2,
    trayOpen: false,
    onToggleTray: vi.fn(),
    now: new Date(2026, 9, 5),
    canEdit: true,
    onSetup: vi.fn(),
    onOpenItem: vi.fn(),
    ...over,
  };
}

const draw = (kind: BoardWidgetKind, c = ctx()) => render(<BoardWidgetView kind={kind} ctx={c} />);

afterEach(cleanup);

describe('BoardWidgetView', () => {
  it('draws every kind', () => {
    for (const kind of BOARD_WIDGET_KINDS) {
      const { container, unmount } = draw(kind);
      expect(container.firstChild, kind).not.toBeNull();
      unmount();
    }
  });

  it('fills the completion ring and names it', () => {
    draw('progress');
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/% done/);
  });

  it('counts people, types and due cards', () => {
    draw('people');
    expect(screen.getByText('1 person')).toBeTruthy();
    cleanup();
    draw('types');
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('1 Task, 1 Note');
    cleanup();
    draw('due');
    expect(screen.getByText('overdue')).toBeTruthy();
    expect(screen.getByText('due soon')).toBeTruthy();
  });

  it('shows votes left as pips within the budget', () => {
    draw('votes');
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('2 votes left of 3');
    cleanup();
    const { container } = draw('votes', ctx({ votesLeft: null }));
    expect(container.firstChild).toBeNull();
  });

  it('filters and toggles Only Mine', () => {
    const c = ctx();
    draw('filter', c);
    fireEvent.change(screen.getByLabelText('Filter this board'), { target: { value: 'pay' } });
    expect(c.onQuick).toHaveBeenCalledWith({ text: 'pay' });
    cleanup();
    draw('mine', c);
    fireEvent.click(screen.getByRole('button', { name: /Only Mine/ }));
    expect(c.onQuick).toHaveBeenCalledWith({ mine: 'sam' });
  });

  it('reads plainly when there is nothing to show', () => {
    const empty = ctx({ items: [], setup: { ...presetSetup('blank'), voting: { on: false } } });
    draw('people', empty);
    expect(screen.getByText('No people yet')).toBeTruthy();
    cleanup();
    draw('unassigned', empty);
    expect(screen.getByText('Nothing to assign')).toBeTruthy();
    cleanup();
    draw('types', empty);
    expect(screen.getByText('No cards')).toBeTruthy();
    cleanup();
    draw('due', empty);
    expect(screen.getByText('Nothing due')).toBeTruthy();
  });

  it('narrows the board from People, Card Types and Due Soon, and toggles back', () => {
    const c = ctx();
    draw('people', c);
    fireEvent.click(screen.getByRole('button', { name: "Only Sam's cards" }));
    expect(c.onQuick).toHaveBeenLastCalledWith({ person: 'sam' });
    cleanup();
    draw('people', ctx({ ...c, quick: { person: 'sam' } }));
    fireEvent.click(screen.getByRole('button', { name: "Only Sam's cards" }));
    expect(c.onQuick).toHaveBeenLastCalledWith({});
    cleanup();
    draw('types', c);
    fireEvent.click(screen.getByRole('button', { name: /Only Note cards/ }));
    expect(c.onQuick).toHaveBeenLastCalledWith({ type: 'note' });
    cleanup();
    draw('due', c);
    fireEvent.click(screen.getByRole('button', { name: /overdue/ }));
    expect(c.onQuick).toHaveBeenLastCalledWith({
      due: expect.objectContaining({ to: '2026-10-04' }),
    });
    fireEvent.click(screen.getByRole('button', { name: /due soon/ }));
    expect(c.onQuick).toHaveBeenLastCalledWith({
      due: expect.objectContaining({ from: '2026-10-05', to: '2026-10-12' }),
    });
  });

  it('reads "x of y" while narrowed, and shows all when pressed', () => {
    const c = ctx({ quick: { type: 'note' } });
    draw('count', c);
    fireEvent.click(screen.getByRole('button', { name: /Show all/ }));
    expect(c.onQuick).toHaveBeenCalledWith({});
  });

  it('sets the last column as done from a board without one', () => {
    const setup = { ...presetSetup('kanban'), voting: { on: false } };
    delete (setup as { doneColumnId?: string }).doneColumnId;
    const c = ctx({ setup });
    draw('progress', c);
    fireEvent.click(screen.getByRole('button', { name: 'Set Done Column' }));
    expect(c.onSetup).toHaveBeenCalledWith(
      expect.objectContaining({ doneColumnId: setup.columns.at(-1)!.id }),
      'DoneColumn',
    );
  });

  it('filters by priority and the unassigned, and opens the top-voted card', () => {
    const top = item({ title: 'Ship it', status: 'todo', priority: 'urgent', votes: { x: 3 } });
    const c = ctx({ items: [top, item({ title: 'z', status: 'todo', assignee: SAM })] });
    draw('priorities', c);
    fireEvent.click(screen.getByRole('button', { name: /Only Urgent priority/ }));
    expect(c.onQuick).toHaveBeenLastCalledWith({ priority: 'urgent' });
    cleanup();
    draw('unassigned', c);
    fireEvent.click(screen.getByRole('button', { name: /unassigned/ }));
    expect(c.onQuick).toHaveBeenLastCalledWith({ person: '-' });
    cleanup();
    draw('top-voted', c);
    fireEvent.click(screen.getByRole('button', { name: /Top voted: Ship it/ }));
    expect(c.onOpenItem).toHaveBeenCalledWith(top.id);
    cleanup();
    draw(
      'points',
      ctx({
        items: [item({ status: 'done', estimate: 2 }), item({ status: 'todo', estimate: 3 })],
      }),
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('2 of 5 points done');
  });
});
