// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { gridSlot, slotAfterMove, useGridReorder } from './useGridReorder';

// docs/specs/026-plan/item-types.md "Image fields": a Several Images field's thumbnails move by dragging, in two
// directions; a press that barely travels is still a press, and Escape puts a tile back.

afterEach(cleanup);

describe('where a dragged tile lands', () => {
  // A grid of two rows of three 80 px tiles, 8 px apart.
  const centres = [0, 1, 2, 3, 4, 5].map((i) => ({
    x: (i % 3) * 88 + 40,
    y: Math.floor(i / 3) * 88 + 40,
  }));

  it('takes the slot whose middle is nearest, across a row and down a row', () => {
    expect(gridSlot(centres, 0, 0, 0)).toBe(0);
    expect(gridSlot(centres, 0, 90, 0)).toBe(1);
    expect(gridSlot(centres, 0, 170, 90)).toBe(5);
    expect(gridSlot(centres, 5, -176, -88)).toBe(0);
    expect(gridSlot(centres, 9, 10, 10)).toBe(9);
  });

  it('moves the tiles between where it was and where it lands one place the other way', () => {
    expect([0, 1, 2, 3].map((i) => slotAfterMove(i, 0, 2))).toEqual([2, 0, 1, 3]);
    expect([0, 1, 2, 3].map((i) => slotAfterMove(i, 3, 1))).toEqual([0, 2, 3, 1]);
    expect([0, 1, 2].map((i) => slotAfterMove(i, 1, 1))).toEqual([0, 1, 2]);
  });
});

function Grid({
  ids,
  onPlace,
  onOpen,
}: {
  ids: string[];
  onPlace: () => void;
  onOpen: () => void;
}) {
  const drag = useGridReorder(ids, onPlace);
  return (
    <ul>
      {ids.map((id) => (
        <li key={id} data-reorder-id={id} style={drag.tileStyle(id)}>
          <button type="button" onClick={onOpen} {...drag.dragProps(id)}>
            {id}
            {drag.draggingId === id ? ' (moving)' : ''}
          </button>
        </li>
      ))}
    </ul>
  );
}

describe('dragging', () => {
  it('leaves a press that travels under the threshold a press', () => {
    const onPlace = vi.fn();
    const onOpen = vi.fn();
    render(<Grid ids={['a', 'b']} onPlace={onPlace} onOpen={onOpen} />);
    const a = screen.getByRole('button', { name: 'a' });
    fireEvent.pointerDown(a, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(a, { clientX: 12, clientY: 11, pointerId: 1 });
    expect(a.textContent).toBe('a');
    fireEvent.pointerUp(a, { pointerId: 1 });
    fireEvent.click(a);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onPlace).not.toHaveBeenCalled();
  });

  it('puts the tile back on Escape, and takes no drag with one tile or another button', () => {
    const onPlace = vi.fn();
    const { rerender } = render(<Grid ids={['a', 'b']} onPlace={onPlace} onOpen={vi.fn()} />);
    const a = screen.getByRole('button', { name: 'a' });
    fireEvent.pointerDown(a, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(a, { clientX: 200, clientY: 10, pointerId: 1 });
    expect(a.textContent).toBe('a (moving)');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(a.textContent).toBe('a');
    fireEvent.pointerUp(a, { pointerId: 1 });
    expect(onPlace).not.toHaveBeenCalled();
    fireEvent.pointerDown(a, { button: 2, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(a, { clientX: 200, clientY: 10, pointerId: 1 });
    expect(a.textContent).toBe('a');
    rerender(<Grid ids={['a']} onPlace={onPlace} onOpen={vi.fn()} />);
    const only = screen.getByRole('button', { name: 'a' });
    fireEvent.pointerDown(only, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(only, { clientX: 200, clientY: 10, pointerId: 1 });
    expect(only.textContent).toBe('a');
  });

  it('lets a cancelled pointer put the tile back', () => {
    const onPlace = vi.fn();
    render(<Grid ids={['a', 'b']} onPlace={onPlace} onOpen={vi.fn()} />);
    const a = screen.getByRole('button', { name: 'a' });
    fireEvent.pointerDown(a, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(a, { clientX: 200, clientY: 10, pointerId: 1 });
    fireEvent.pointerCancel(a, { pointerId: 1 });
    expect(a.textContent).toBe('a');
    expect(onPlace).not.toHaveBeenCalled();
  });
});
