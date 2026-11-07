// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { applyShapeVariant, createShape, type ShapeElement } from '@livehuddle/document';
import { PieceArt } from '@/components/canvas/PieceArt';
import { CorridorView, DoorView } from './RoomBuilderViews';

// docs/specs/009-elements/room-builder.md "Door types" and "Locked doors", corridor.md, office.md "Rug types".

const door = (variant?: string, extra: Partial<ShapeElement> = {}) => ({
  ...applyShapeVariant(createShape('door', 0, 0), variant),
  ...extra,
});
const draw = (el: ShapeElement) =>
  render(<DoorView element={el} stroke="#334155" floor="#f5f0e6" />).container;

describe('DoorView', () => {
  it('draws the swing door with its leaf open and its arc showing', () => {
    const c = draw(door());
    expect(c.querySelector('[aria-label="Open door"]')).not.toBeNull();
    const leaf = c.querySelector<SVGElement>('.lh-door-leaf')!;
    expect(leaf.style.transform).toBe('none');
    expect(c.querySelector('.lh-door-swing')?.getAttribute('opacity')).toBe('0.55');
  });

  it('turns the leaf across the gap and hides the arc when shut', () => {
    const c = draw(door(undefined, { doorClosed: true }));
    expect(c.querySelector('[aria-label="Closed door"]')).not.toBeNull();
    const leaf = c.querySelector<SVGElement>('.lh-door-leaf')!;
    expect(leaf.style.transform).toBe('translateX(0px) rotate(-90deg)');
    expect(leaf.hasAttribute('data-door-closed')).toBe(true);
    expect(c.querySelector('.lh-door-swing')?.getAttribute('opacity')).toBe('0');
  });

  it('draws a double door two leaves, a sliding one two panes slid apart, a revolving one its wings turned', () => {
    expect(draw(door('double')).querySelectorAll('.lh-door-leaf')).toHaveLength(2);
    const panes = [...draw(door('sliding')).querySelectorAll<SVGElement>('.lh-door-leaf')];
    expect(panes.map((p) => p.style.transform)).toEqual([
      'translateX(-50px) rotate(0deg)',
      'translateX(50px) rotate(0deg)',
    ]);
    const shut = draw(door('sliding', { doorClosed: true }));
    expect(shut.querySelector<SVGElement>('.lh-door-leaf')!.style.transform).toBe('none');
    const wings = draw(door('revolving')).querySelector<SVGElement>('.lh-door-leaf')!;
    expect(wings.style.transform).toBe('translateX(0px) rotate(45deg)');
  });

  // not-in-livehuddle.md "Element and Tab Locking": a door saved locked draws as any door, no padlock or shading.
  it('draws a door saved locked as any open door', () => {
    const c = draw(door('double', { locked: true } as Partial<ShapeElement>));
    expect(c.querySelector('[aria-label="Open door"]')).not.toBeNull();
    expect(c.querySelector('[data-door-lock]')).toBeNull();
    expect(c.querySelectorAll('[opacity="0.45"]')).toHaveLength(0);
  });
});

describe('CorridorView', () => {
  it('draws its floor and its wall runs, the outline under the floor-coloured core', () => {
    const corridor = applyShapeVariant(createShape('corridor', 0, 0), 'tee');
    const c = render(
      <CorridorView element={corridor} stroke="#334155" floor="#f5f0e6" />,
    ).container;
    expect(c.querySelector('[aria-label="Corridor"]')).not.toBeNull();
    const paths = c.querySelectorAll('path');
    expect(paths).toHaveLength(3);
    expect(paths[1]!.getAttribute('stroke-width')).toBe('14');
    expect(paths[2]!.getAttribute('stroke')).toBe('#f5f0e6');
  });

  it('is the art PieceArt draws for a corridor', () => {
    const c = render(
      <PieceArt element={createShape('corridor', 0, 0)} stroke="#334155" fill="#f5f0e6" />,
    ).container;
    expect(c.querySelector('[aria-label="Corridor"]')).not.toBeNull();
  });
});

describe('a patterned rug', () => {
  it('is drawn to its size; the Oval keeps its furniture drawing', () => {
    const kilim = applyShapeVariant(createShape('rug', 0, 0), 'kilim');
    const c = render(<PieceArt element={kilim} stroke="#334155" fill="#fde68a" />).container;
    expect(c.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 240 150');
    expect(c.querySelector('[opacity="0.55"]')).not.toBeNull();
    const oval = render(
      <PieceArt element={createShape('rug', 0, 0)} stroke="#334155" fill="#fde68a" />,
    ).container;
    expect(oval.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBeNull();
    expect(c.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe('none');
  });

  it('paints its tints and sheens unstroked', () => {
    const round = applyShapeVariant(createShape('rug', 0, 0), 'round');
    const c = render(<PieceArt element={round} stroke="#334155" fill="#fde68a" />).container;
    expect(c.querySelector('[opacity="0.2"]')?.getAttribute('stroke')).toBeNull();
    expect(c.querySelector('[opacity="0.32"]')?.getAttribute('fill')).toBe('#ffffff');
  });
});
