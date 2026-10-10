// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanBoardPicker } from './PlanBoardPicker';

let plan: { items: Map<string, unknown> } | null = null;
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

// docs/specs/026-plan/plan-mode.md "Starting a board": the board picker, and its Open Quick Start.
afterEach(cleanup);

describe('Start Planning', () => {
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

  it('opens on Boards, and offers an Empty Sheet on its Spreadsheets tab', () => {
    const onPickSheet = vi.fn();
    render(<PlanBoardPicker onPick={vi.fn()} onPickSheet={onPickSheet} />);
    expect(screen.getByRole('heading', { name: 'Start Planning' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Boards' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', { name: /^Empty Sheet/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Spreadsheets' }));
    expect(screen.queryByRole('button', { name: /^Kanban/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Empty Sheet/ }));
    expect(onPickSheet).toHaveBeenCalledWith(undefined);
  });

  it('offers Budget and Tracker, and a Card Table once there are cards, each placing its start', () => {
    const onPickSheet = vi.fn();
    const { unmount } = render(<PlanBoardPicker onPick={vi.fn()} onPickSheet={onPickSheet} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Spreadsheets' }));
    expect(screen.queryByRole('button', { name: /^Card Table/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Budget/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Tracker/ }));
    expect(onPickSheet.mock.calls).toEqual([['budget'], ['tracker']]);
    unmount();
    plan = { items: new Map([['i1', {}]]) };
    render(<PlanBoardPicker onPick={vi.fn()} onPickSheet={onPickSheet} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Spreadsheets' }));
    fireEvent.click(screen.getByRole('button', { name: /^Card Table/ }));
    expect(onPickSheet).toHaveBeenLastCalledWith('cards');
    plan = null;
  });

  it('cascades the tiles in on a tab switch, never on its first paint', () => {
    render(<PlanBoardPicker onPick={vi.fn()} onPickSheet={vi.fn()} />);
    expect(screen.getByRole('tabpanel').className).not.toContain('lvd-cascade');
    fireEvent.click(screen.getByRole('tab', { name: 'Spreadsheets' }));
    expect(screen.getByRole('tabpanel').className).toContain('lvd-cascade');
    fireEvent.click(screen.getByRole('tab', { name: 'Boards' }));
    expect(screen.getByRole('tabpanel').className).toContain('lvd-cascade');
  });
});
