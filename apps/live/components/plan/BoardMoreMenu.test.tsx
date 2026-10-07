// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardMoreMenu } from './BoardMoreMenu';

// docs/specs/026-plan/plan-board.md "The board set-up": a board's ⋯ menu.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
afterEach(cleanup);

describe('a board’s ⋯ menu', () => {
  it('adds the board to the slides', () => {
    const addBoardSlide = vi.fn();
    Object.assign(plan, { addBoardSlide, announce: vi.fn() });
    render(<BoardMoreMenu boardId="b1" title="Kanban" />);
    fireEvent.click(screen.getByRole('button', { name: 'More for Kanban' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Slides' }));
    expect(addBoardSlide).toHaveBeenCalledWith('b1');
  });

  it('is not shown with nothing to offer', () => {
    for (const k of Object.keys(plan)) delete plan[k];
    render(<BoardMoreMenu boardId="b1" title="Kanban" />);
    expect(screen.queryByRole('button', { name: 'More for Kanban' })).toBeNull();
  });
});
