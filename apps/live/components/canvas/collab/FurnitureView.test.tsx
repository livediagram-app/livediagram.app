// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChairFacing, ShapeElement } from '@livediagram/document';
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
      <FurnitureView element={chair('sofa', 'w')} stroke="#94a3b8" sitters={[SAM]} />,
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
