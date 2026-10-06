// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, presetSetup } from '@livediagram/items';
import { PlanBoardMenuSection } from './PlanBoardMenuSection';

// docs/specs/012-collaboration/presentation-mode.md "Board slides": the Board flyout adds the whole board
// to the slides.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MenuFlyoutSection', () => ({
  MenuFlyoutSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
    fireEvent.click(screen.getByRole('button', { name: 'By Assignee' }));
    const next = updateBoard.mock.calls[0]![1];
    expect(next.swimlaneBy).toBe('assignee');
    expect(next.swimlaneField).toBeUndefined();
  });
});
