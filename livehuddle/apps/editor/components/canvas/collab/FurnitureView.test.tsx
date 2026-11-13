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

// docs/specs/009-elements/chair.md "Occupied": a soft ring in the sitter's colour on the seat.
describe('FurnitureView', () => {
  it('lays the ring on the seat, under the backrest a chair turns to you', () => {
    const { container } = render(
      <FurnitureView element={chair('chair', 's')} stroke="#94a3b8" sitters={[SAM]} />,
    );
    const ring = ringOf(container)!;
    // The backrest's back is painted after it, so it is not crossed by the ring.
    expect(ring.nextElementSibling?.tagName.toLowerCase()).toBe('rect');
  });

  it('paints the desk and its monitor over the ring of the chair pulled up to it', () => {
    const { container } = render(
      <FurnitureView element={chair('desk', 'n')} stroke="#94a3b8" sitters={[SAM]} />,
    );
    const ring = ringOf(container)!;
    const after = [] as Element[];
    for (let n = ring.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
    expect(after.length).toBeGreaterThan(5);
  });

  it('mirrors the ring with the drawing for facing right', () => {
    const { container } = render(
      <FurnitureView
        element={chair('sofa', 'w')}
        stroke="#94a3b8"
        sitters={[{ ...SAM, seat: 0 }]}
      />,
    );
    expect(ringOf(container)!.closest('g')?.getAttribute('transform')).toBe(
      'translate(76 0) scale(-1 1)',
    );
  });

  it('draws no ring on an empty chair', () => {
    const { container } = render(
      <FurnitureView element={chair('chair', 's')} stroke="#94a3b8" sitters={[]} />,
    );
    expect(ringOf(container)).toBeNull();
  });
});

// docs/specs/009-elements/chair.md "Occupancy is presence": the exact seat ringed, the pill clear of the head.
describe('FurnitureView seats', () => {
  const ANN = { name: 'Ann', color: '#16a34a' };
  const ringsIn = (container: HTMLElement, color: string) =>
    [...container.querySelectorAll<SVGEllipseElement>(`ellipse[stroke="${color}"]`)].map((e) => [
      Number(e.getAttribute('cx')),
      Number(e.getAttribute('cy')),
    ]);

  it('rings each sofa cushion its sitter holds, in that sitter colour', () => {
    const sofa = { ...chair('sofa', 'n'), width: 136, height: 76 } as ShapeElement;
    const { container } = render(
      <FurnitureView
        element={sofa}
        stroke="#94a3b8"
        sitters={[
          { ...ANN, seat: 0 },
          { ...SAM, seat: 1 },
        ]}
      />,
    );
    expect(ringsIn(container, ANN.color)).toEqual([[44, 0.58 * 76]]);
    expect(ringsIn(container, SAM.color)).toEqual([[92, 0.58 * 76]]);
  });

  it('rings only the meeting-table chair its sitter holds', () => {
    const table = { ...chair('chair', 'n'), shape: 'meeting-table', width: 232, height: 168 };
    const { container } = render(
      <FurnitureView
        element={table as unknown as ShapeElement}
        stroke="#94a3b8"
        sitters={[{ ...SAM, seat: 3 }]}
      />,
    );
    expect(ringsIn(container, SAM.color)).toEqual([[146, 116]]);
  });

  it('draws no ring for a sitter whose seat is unknown on a piece of several', () => {
    const sofa = { ...chair('sofa', 'n'), width: 136, height: 76 } as ShapeElement;
    const { container, getByText } = render(
      <FurnitureView element={sofa} stroke="#94a3b8" sitters={[SAM]} />,
    );
    expect(ringOf(container)).toBeNull();
    expect(getByText('Sam')).toBeTruthy();
  });

  it("lifts the name pill clear of the sitter's head, higher for a taller character", () => {
    const pillTop = (scale: number) => {
      const { getByText, unmount } = render(
        <FurnitureView
          element={chair('chair', 'n')}
          stroke="#94a3b8"
          sitters={[{ ...SAM, seat: 0, scale }]}
        />,
      );
      const top = getByText('Sam').style.top;
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
