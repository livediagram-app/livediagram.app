// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChairFacing, ShapeElement } from '@livehuddle/document';
import { seatPillBottom } from '@livehuddle/avatar/chair-sitters';
import { SEAT_GRIDS } from '@livehuddle/avatar/seats';
import { AVATAR_HEIGHT } from '@livehuddle/avatar/walk';
import { setGameOn } from '@/lib/table-games/table-game-scene';
import { FurnitureView } from './FurnitureView';

afterEach(cleanup);

const SAM = { name: 'Sam', color: '#e11d48' };
const chair = (shape: 'chair' | 'desk' | 'sofa', chairFacing: ChairFacing) =>
  ({
    id: 'c',
    type: 'shape',
    shape,
    x: 0,
    y: 0,
    width: 64,
    height: 72,
    chairFacing,
  }) as unknown as ShapeElement;

const ringOf = (container: HTMLElement) =>
  container.querySelector<SVGEllipseElement>(`ellipse[stroke="${SAM.color}"]`);

// docs/specs/009-elements/chair.md "Occupied": a taken seat shows its sitter and their name, no ring.
describe('FurnitureView', () => {
  it('draws no ring on a taken seat, on any piece', () => {
    for (const kind of ['chair', 'desk', 'sofa'] as const) {
      const { container, unmount } = render(
        <FurnitureView
          element={chair(kind, 'n')}
          stroke="#94a3b8"
          sitters={[{ ...SAM, seat: 0 }]}
        />,
      );
      expect(ringOf(container), kind).toBeNull();
      unmount();
    }
  });
});

// docs/specs/009-elements/chair.md "Occupancy is presence": the pill clear of the head.
describe('FurnitureView seats', () => {
  it("lifts the name pill clear of the sitter's head, higher for a taller character", () => {
    const pillTop = (scale: number) => {
      const { getByText, unmount } = render(
        <FurnitureView
          element={chair('chair', 'n')}
          stroke="#94a3b8"
          sitters={[{ ...SAM, seat: 0, scale }]}
        />,
      );
      const top = getByText('Sam').closest<HTMLElement>('[data-seat-pill]')!.style.top;
      unmount();
      return top;
    };
    const box = { x: 0, y: 0, width: 64, height: 72 };
    expect(pillTop(1.5)).toBe(
      `${seatPillBottom(box, SEAT_GRIDS.chair.front, [{ seat: 0, scale: 1.5 }])}px`,
    );
    // Above the head: the feet sit 0.62 down the chair, the head AVATAR_HEIGHT x scale above them.
    expect(parseFloat(pillTop(1.5))).toBeLessThan(0.62 * 72 - AVATAR_HEIGHT * 1.5);
    expect(parseFloat(pillTop(1.95))).toBeLessThan(parseFloat(pillTop(1.5)));
  });

  // chair.md "A game names its own players" (Work Tracker 753): the scoreboard names who plays, so the pill goes.
  it('hides the name pill while the table shows a game, and brings it back after', () => {
    const table = {
      ...chair('chair', 's'),
      id: 'pp',
      shape: 'ping-pong-table',
      width: 120,
      height: 80,
    } as unknown as ShapeElement;
    const players = [
      { name: 'Daring Fox', color: '#e11d48', seat: 0 },
      { name: 'You', color: '#2563eb', seat: 1 },
    ];
    const { container, rerender } = render(
      <FurnitureView element={table} stroke="#94a3b8" sitters={players} />,
    );
    const pill = () => container.querySelector('[data-seat-pill]');
    expect(pill()?.textContent).toBe('Daring Fox, You');
    act(() => setGameOn('pp', true));
    expect(pill()).toBeNull();
    // Another occupied piece keeps its pill while the game plays.
    const other = render(
      <FurnitureView element={chair('sofa', 's')} stroke="#94a3b8" sitters={[SAM]} />,
    );
    expect(other.container.querySelector('[data-seat-pill]')?.textContent).toBe('Sam');
    act(() => setGameOn('pp', false));
    rerender(<FurnitureView element={table} stroke="#94a3b8" sitters={players} />);
    expect(pill()?.textContent).toBe('Daring Fox, You');
  });
});
