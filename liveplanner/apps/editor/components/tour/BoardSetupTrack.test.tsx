// @vitest-environment jsdom

// A board's Board Setup track (docs/specs/026-plan/plan-tour.md "Boards: Board Setup"): rename a column, set a WIP
// limit, add a widget, on the real board; the finish keeps the changes or puts the board back in one change.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanBoardSetup } from '@liveplanner/items';
import { BoardSetupTrack } from './BoardSetupTrack';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useEditorContext: () => ctx.current,
}));

const START = {
  title: 'Board',
  columns: [
    { id: 'todo', status: 'todo', name: 'To Do' },
    { id: 'doing', status: 'doing', name: 'Doing' },
  ],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
} as unknown as PlanBoardSetup;
// Every mission's change at once: a renamed column with a WIP limit, and a widget added.
const CHANGED = {
  ...START,
  columns: [
    { id: 'todo', status: 'todo', name: 'Backlog' },
    { id: 'doing', status: 'doing', name: 'Doing', wipLimit: 3 },
  ],
  widgets: ['count', 'progress', 'unplaced', 'filter', 'mine', 'due'],
} as unknown as PlanBoardSetup;

const updateBoard = vi.fn();
const onEnd = vi.fn();
const editor = (setup: PlanBoardSetup | null) => {
  ctx.current = {
    plan: { context: { updateBoard } },
    activeTab: { id: 'tab1', elements: setup ? [{ id: 'b0', planBoard: setup }] : [] },
  };
};
const strip = () => screen.getByRole('region', { name: 'Board Setup' });
// A fresh element each time, so a rerender reads the context afresh.
const ui = () => <BoardSetupTrack boardId="b0" onEnd={onEnd} />;

// Through every lesson to the finish.
const toFinish = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
};

beforeEach(() => editor(START));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('BoardSetupTrack', () => {
  it('starts on Rename a Column, and ticks each mission off the board’s own change', () => {
    const { rerender } = render(ui());
    expect(strip().textContent).toContain('Rename a Column');
    editor(CHANGED);
    rerender(ui());
    expect(strip().textContent).toContain('Name columns after how your team really works');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(strip().textContent).toContain('Over its limit');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(strip().textContent).toContain('Widgets count, filter and sum');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(strip().textContent).toContain('Set up your way.');
  });

  it('Put It Back restores the board as it started, in one change', () => {
    const { rerender } = render(ui());
    editor(CHANGED);
    rerender(ui());
    toFinish();
    fireEvent.click(screen.getByRole('button', { name: 'Put It Back' }));
    expect(updateBoard).toHaveBeenCalledTimes(1);
    expect(updateBoard).toHaveBeenCalledWith('b0', START);
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'PlanTourPutBack');
    expect(onEnd).toHaveBeenCalledWith('completed');
  });

  it('Put It Back changes nothing when the board is as it started', () => {
    const { rerender } = render(ui());
    editor(CHANGED);
    rerender(ui());
    toFinish();
    // Someone set it back by hand before the finish.
    editor({ ...START });
    rerender(ui());
    fireEvent.click(screen.getByRole('button', { name: 'Put It Back' }));
    expect(updateBoard).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith('completed');
  });

  it('Keep leaves the changes', () => {
    const { rerender } = render(ui());
    editor(CHANGED);
    rerender(ui());
    toFinish();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Changes' }));
    expect(updateBoard).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith('UI', 'Selected', 'PlanTourPutBack');
    expect(onEnd).toHaveBeenCalledWith('completed');
  });

  it('ends as skipped from End', () => {
    render(ui());
    fireEvent.click(screen.getByRole('button', { name: 'End Board Setup' }));
    expect(onEnd).toHaveBeenCalledWith('skipped');
  });

  it('draws nothing without its board', () => {
    editor(null);
    render(ui());
    expect(screen.queryByRole('region', { name: 'Board Setup' })).toBeNull();
  });
});
