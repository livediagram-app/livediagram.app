// @vitest-environment jsdom

// The column under the pointer (docs/specs/026-plan/plan-board.md "Column hover"): its head and cells carry
// data-column-hover while the pointer is over any part of the column, and only that column's.

import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { COLUMN_HOVER_ATTR, useColumnHover } from './useColumnHover';

afterEach(cleanup);

function Grid({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useColumnHover(ref, enabled, 2);
  return (
    <div ref={ref} data-testid="grid">
      <div className="plan-col" data-plan-column="a" data-testid="head-a" />
      <div className="plan-col" data-plan-column="a" data-testid="cell-a">
        <span data-testid="in-a">card</span>
      </div>
      <div className="plan-col" data-plan-column="b" data-testid="head-b" />
      <div className="plan-col" data-plan-column="b" data-testid="cell-b" />
      <div data-plan-column="b" data-testid="unpainted-b" />
      <div data-testid="gap" />
    </div>
  );
}

const hovered = (el: HTMLElement) => el.hasAttribute(COLUMN_HOVER_ATTR);

describe('useColumnHover', () => {
  it("marks the column's head and cells while the pointer is over it, and moves with it", () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.pointerOver(getByTestId('in-a'), { pointerType: 'mouse' });
    expect(hovered(getByTestId('head-a'))).toBe(true);
    expect(hovered(getByTestId('cell-a'))).toBe(true);
    expect(hovered(getByTestId('head-b'))).toBe(false);
    fireEvent.pointerOver(getByTestId('cell-b'), { pointerType: 'mouse' });
    expect(hovered(getByTestId('head-a'))).toBe(false);
    expect(hovered(getByTestId('head-b'))).toBe(true);
    expect(hovered(getByTestId('cell-b'))).toBe(true);
    // Only the painted parts.
    expect(hovered(getByTestId('unpainted-b'))).toBe(false);
  });

  it('clears on the gaps and when the pointer leaves the grid', () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.pointerOver(getByTestId('in-a'), { pointerType: 'mouse' });
    fireEvent.pointerOver(getByTestId('gap'), { pointerType: 'mouse' });
    expect(hovered(getByTestId('head-a'))).toBe(false);
    fireEvent.pointerOver(getByTestId('in-a'), { pointerType: 'mouse' });
    fireEvent.pointerLeave(getByTestId('grid'));
    expect(hovered(getByTestId('cell-a'))).toBe(false);
  });

  it('ignores touch, and does nothing when off', () => {
    const { getByTestId, rerender } = render(<Grid />);
    fireEvent.pointerOver(getByTestId('in-a'), { pointerType: 'touch' });
    expect(hovered(getByTestId('head-a'))).toBe(false);
    rerender(<Grid enabled={false} />);
    fireEvent.pointerOver(getByTestId('in-a'), { pointerType: 'mouse' });
    expect(hovered(getByTestId('head-a'))).toBe(false);
  });
});
