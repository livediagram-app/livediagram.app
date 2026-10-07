// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanBoardPicker } from './PlanBoardPicker';

// docs/specs/026-plan/plan-mode.md "Starting a board": the board picker, and its Open Quick Start.
afterEach(cleanup);

describe('Start with a Board', () => {
  it('opens the Quick Start from its foot', () => {
    const onQuickStart = vi.fn();
    render(<PlanBoardPicker onPick={vi.fn()} onQuickStart={onQuickStart} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Quick Start' }));
    expect(onQuickStart).toHaveBeenCalledTimes(1);
  });

  it('places the board picked', () => {
    const onPick = vi.fn();
    render(<PlanBoardPicker onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /^Kanban/ }));
    expect(onPick).toHaveBeenCalledWith('kanban');
    expect(screen.queryByRole('button', { name: 'Open Quick Start' })).toBeNull();
  });
});
