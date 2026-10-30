// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectedColumn } from '@liveplanner/items';
import { SlotBoardHeader } from './SlotBoardHeader';
import { SlotColumnHeader } from './SlotColumnHeader';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-tabs.md "A board in a slot is simplified": the slot board's header and column heads.
afterEach(cleanup);
const palette = planPalette('light', {});

describe('the slot board header', () => {
  it('shows the title and count, its controls in the revealed group', () => {
    render(
      <SlotBoardHeader
        title="Sprint"
        count={3}
        palette={palette}
        loadFailed={false}
        onRetry={vi.fn()}
        controls={<button type="button">Maximise Board</button>}
      />,
    );
    expect(screen.getByText('Sprint')).toBeTruthy();
    expect(screen.getByLabelText('3 cards')).toBeTruthy();
    const controls = document.querySelector('[data-slot-board-controls]')!;
    expect(controls.className).toContain('group-hover/slot-board:opacity-100');
    expect(controls.className).toContain('[@media(hover:none)]:opacity-100');
    expect(controls.contains(screen.getByRole('button', { name: 'Maximise Board' }))).toBe(true);
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
  });

  it('offers Retry when the items failed to load, and nothing to reveal without controls', () => {
    const onRetry = vi.fn();
    render(
      <SlotBoardHeader title="Sprint" count={0} palette={palette} loadFailed onRetry={onRetry} />,
    );
    // Its press stays its own, never moving the board.
    fireEvent.pointerDown(screen.getByRole('button', { name: /Retry/ }));
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalled();
    expect(document.querySelector('[data-slot-board-controls]')).toBeNull();
  });
});

const column = (over: Partial<ProjectedColumn['column']> = {}, count = 2, overLimit = false) =>
  ({
    column: { id: 'c1', status: 'todo', name: 'To Do', ...over },
    lanes: [],
    count,
    overLimit,
  }) as unknown as ProjectedColumn & { count: number; overLimit: boolean };

describe('a slot column head', () => {
  it('names the column and counts its cards, with its + when given', () => {
    render(
      <SlotColumnHeader
        col={column()}
        palette={palette}
        add={<button type="button">Add a card to To Do</button>}
      />,
    );
    expect(screen.getByText('To Do')).toBeTruthy();
    expect(screen.getByLabelText('2 items')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a card to To Do' })).toBeTruthy();
  });

  it('counts against a WIP limit, warning-coloured over it', () => {
    render(<SlotColumnHeader col={column({ wipLimit: 2 }, 3, true)} palette={palette} />);
    const badge = screen.getByLabelText('3 of a WIP limit of 2, over the limit');
    expect(badge.textContent).toBe('3 / 2');
    expect(badge.style.color).toBeTruthy();
    cleanup();
    render(
      <SlotColumnHeader col={column({ wipLimit: 3, color: '#16a34a' }, 2)} palette={palette} />,
    );
    expect(screen.getByLabelText('2 of a WIP limit of 3').textContent).toBe('2 / 3');
  });

  it('frames its column on a tap of the head, never of its +', () => {
    const onFrame = vi.fn();
    render(
      <SlotColumnHeader
        col={column()}
        palette={palette}
        onFrame={onFrame}
        add={<button type="button">Add a card to To Do</button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a card to To Do' }));
    expect(onFrame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('To Do'));
    expect(onFrame).toHaveBeenCalledWith(document.querySelector('[data-slot-column-head]'));
  });
});
