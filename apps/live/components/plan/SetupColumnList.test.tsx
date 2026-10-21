// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SetupColumnList, moveColumn } from './SetupColumnList';
import { planPalette } from './plan-palette';
import type { SetupColumn } from './setup-board';

afterEach(cleanup);

// docs/specs/026-plan/plan-board.md "Setup Board": columns reorder by dragging their grip.
const COLS: SetupColumn[] = [
  { kind: 'new', name: 'Backlog' },
  { kind: 'new', name: 'Doing' },
  { kind: 'new', name: 'Done' },
];

// Rows 40px tall, 6px apart, from y=100.
function layOut() {
  document.querySelectorAll<HTMLElement>('[data-setup-column]').forEach((row, i) => {
    row.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 100 + i * 46,
        width: 300,
        height: 40,
        bottom: 140 + i * 46,
        right: 300,
      }) as DOMRect;
  });
}

describe('moveColumn', () => {
  it('moves one entry to a new place', () => {
    expect(moveColumn(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveColumn(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
});

describe('dragging a column', () => {
  it('shows a slot where it will land, and places it there on release', () => {
    const onChange = vi.fn();
    render(
      <SetupColumnList chosen={COLS} palette={planPalette('light', {})} onChange={onChange} />,
    );
    layOut();
    const grip = screen.getByRole('button', { name: 'Move Backlog' });
    fireEvent.pointerDown(grip, { button: 0, clientY: 120, pointerId: 1 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientY: 220 }));
    });
    // The slot (the drop indicator) now sits last, after Doing and Done.
    const rows = [...document.querySelectorAll('[data-setup-column]')];
    expect(rows.map((r) => r.textContent || 'slot')).toEqual([
      expect.stringContaining('Doing'),
      expect.stringContaining('Done'),
      'slot',
    ]);
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    expect(onChange).toHaveBeenCalledWith([COLS[1], COLS[2], COLS[0]]);
  });

  it('puts it back on Escape', () => {
    const onChange = vi.fn();
    render(
      <SetupColumnList chosen={COLS} palette={planPalette('light', {})} onChange={onChange} />,
    );
    layOut();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Move Done' }), {
      button: 0,
      clientY: 212,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientY: 100 }));
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /^Move / })).toHaveLength(3);
  });

  it('moves by keyboard with Alt and an arrow, and removes with its cross', () => {
    const onChange = vi.fn();
    render(
      <SetupColumnList chosen={COLS} palette={planPalette('light', {})} onChange={onChange} />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move Doing' }), {
      key: 'ArrowDown',
      altKey: true,
    });
    expect(onChange).toHaveBeenLastCalledWith([COLS[0], COLS[2], COLS[1]]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Done' }));
    expect(onChange).toHaveBeenLastCalledWith([COLS[0], COLS[1]]);
  });
});
