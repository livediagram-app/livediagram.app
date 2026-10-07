// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, presetSetup } from '@livediagram/items';
import { PlanBoardMenuSection, PlanCardsMenuSection } from './PlanBoardMenuSection';

// docs/specs/012-collaboration/presentation-mode.md "Board slides": the Board flyout adds the whole board
// to the slides.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MenuFlyoutSection', () => ({
  MenuFlyoutSection: ({
    title,
    panel,
    children,
  }: {
    title: string;
    panel?: boolean;
    children: ReactNode;
  }) => (
    <div data-flyout={title} data-panel={panel ? 'yes' : 'no'}>
      {children}
    </div>
  ),
}));

afterEach(cleanup);

const board = {
  ...createShape('plan-board', 0, 0),
  id: 'board',
  planBoard: presetSetup('kanban'),
} as ShapeElement;

function show(overrides: Record<string, unknown>) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), announce: vi.fn() }, overrides);
  render(<PlanBoardMenuSection element={board} flyoutProps={{} as never} />);
}

describe('PlanBoardMenuSection', () => {
  it('adds the board to the slides and says so', () => {
    const addBoardSlide = vi.fn();
    show({ addBoardSlide });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Slides' }));
    expect(addBoardSlide).toHaveBeenCalledWith('board');
    expect(plan['announce']).toHaveBeenCalledWith('Board added to the slides');
  });

  it('offers no slide where there is no deck to add to', () => {
    show({});
    expect(screen.queryByRole('button', { name: 'Add to Slides' })).toBeNull();
  });
});

// docs/specs/026-plan/plan-board.md "Swimlanes by a field".
describe('Swimlanes by a field', () => {
  const types = [
    {
      ...ITEM_TYPES[0]!,
      fields: [...ITEM_TYPES[0]!.fields, 'f-customer'],
      custom: [{ id: 'f-customer', label: 'Customer', kind: 'text' as const }],
    },
  ];

  it('offers a tile per field, and lanes the board by the one pressed', () => {
    const updateBoard = vi.fn();
    show({ types, updateBoard });
    fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
    expect(updateBoard).toHaveBeenCalledWith(
      'board',
      expect.objectContaining({ swimlaneBy: 'field', swimlaneField: 'f-customer' }),
    );
    expect(screen.getByRole('button', { name: 'Labels' })).toBeTruthy();
  });

  it('drops the field when a plain swimlane is chosen', () => {
    const updateBoard = vi.fn();
    cleanup();
    const laned = {
      ...board,
      planBoard: { ...presetSetup('kanban'), swimlaneBy: 'field', swimlaneField: 'labels' },
    } as ShapeElement;
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard, announce: vi.fn(), types });
    render(<PlanBoardMenuSection element={laned} flyoutProps={{} as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Assignee' }));
    const next = updateBoard.mock.calls[0]![1];
    expect(next.swimlaneBy).toBe('assignee');
    expect(next.swimlaneField).toBeUndefined();
  });
});

// docs/specs/026-plan/plan-board.md "Card types a board shows": the Cards flyout's Card Types tiles filter the board.
describe('Card Types', () => {
  it('names the group Card Types and turns a hidden type back on', () => {
    const updateBoard = vi.fn();
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard, announce: vi.fn(), types: ITEM_TYPES });
    render(<PlanCardsMenuSection element={board} flyoutProps={{} as never} />);
    expect(screen.getByRole('heading', { name: 'Card Types' })).toBeTruthy();
    expect(screen.queryByText('New Cards Can Be')).toBeNull();
    // Kanban shows Task, Action and Note: pressing Project shows Projects too.
    // The first Project tile is the type's (the Show on Cards group has a Project field tile too).
    fireEvent.click(screen.getAllByRole('button', { name: 'Project' })[0]!);
    expect(updateBoard.mock.calls[0]![1].addTypes).toContain('project');
  });
});

// docs/specs/026-plan/plan-board.md "Card types a board shows": a board whose chosen types were all deleted
// shows and takes every type again, and its Card Types tiles say so.
describe('Card Types after a type is deleted', () => {
  it('shows every type pressed, and a change stores only current types', () => {
    const updateBoard = vi.fn();
    cleanup();
    const stale = {
      ...board,
      planBoard: { ...presetSetup('kanban'), addTypes: ['customer-call'] },
    } as ShapeElement;
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard, announce: vi.fn(), types: ITEM_TYPES });
    render(<PlanCardsMenuSection element={stale} flyoutProps={{} as never} />);
    // The Card Types tiles come first (a card field such as Project shares a name).
    const tile = (name: string) => screen.getAllByRole('button', { name })[0]!;
    for (const t of ITEM_TYPES) expect(tile(t.label).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(tile('Note'));
    expect(updateBoard.mock.calls[0]![1].addTypes).toEqual(
      ITEM_TYPES.map((t) => t.id).filter((id) => id !== 'note'),
    );
  });
});

// docs/specs/004-interface-design/menus.md: a menu's categories stay collapsible rows, never promoted inline.
describe('the board menu’s Board and Cards rows', () => {
  it('stay flyouts, never promoted into the menu', () => {
    for (const k of Object.keys(plan)) delete plan[k];
    Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), announce: vi.fn(), types: [] });
    const flyoutProps = {} as never;
    render(
      <>
        <PlanBoardMenuSection element={board} flyoutProps={flyoutProps} />
        <PlanCardsMenuSection element={board} flyoutProps={flyoutProps} />
      </>,
    );
    for (const title of ['Board', 'Cards'])
      expect(document.querySelector(`[data-flyout="${title}"]`)?.getAttribute('data-panel')).toBe(
        'yes',
      );
  });
});
