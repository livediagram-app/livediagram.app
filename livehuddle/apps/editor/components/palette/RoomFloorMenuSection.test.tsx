// @vitest-environment jsdom

// A room's Floor in the element menu (docs/specs/009-elements/office.md "Floors"): a tile per floor type, each a swatch
// of that floor, and the floor colours, which set the room's fill.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { RoomFloorMenuSection } from './CollabMenuSections';

afterEach(cleanup);

const room = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('room', 0, 0), id: 'room', ...over }) as ShapeElement;

function showSection(target: ShapeElement | undefined) {
  const onSetFloor = vi.fn();
  const onSetFloorColour = vi.fn();
  render(
    <RoomFloorMenuSection
      target={target}
      sectionProps={() => ({ open: true, onToggle: () => {} })}
      onSetFloor={onSetFloor}
      onSetFloorColour={onSetFloorColour}
    />,
  );
  return { onSetFloor, onSetFloorColour };
}

const tile = (name: string) =>
  screen.getAllByRole('button').find((b) => b.textContent?.trim() === name)!;

describe('a room’s Floor', () => {
  it('offers every floor type, Floorboards chosen on a room that stores none', () => {
    const { onSetFloor } = showSection(room());
    for (const name of ['Floorboards', 'Tiles', 'Carpet', 'Stone', 'Concrete'])
      expect(tile(name)).toBeTruthy();
    expect(tile('Floorboards').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(tile('Carpet'));
    expect(onSetFloor).toHaveBeenLastCalledWith('carpet');
  });

  it('shows the stored type and colour as chosen, and sets a floor colour', () => {
    const { onSetFloorColour } = showSection(room({ floor: 'tiles', fillColor: '#A3ADB8' }));
    expect(tile('Tiles').getAttribute('aria-pressed')).toBe('true');
    expect(tile('Slate').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(tile('Walnut'));
    expect(onSetFloorColour).toHaveBeenLastCalledWith('#a2764e');
  });

  // Large enough to see (owner, 2026-11-27): each type a picture in the room's colour, three to a page.
  it('draws each type as a picture in the room’s colour, paged three at a time', () => {
    showSection(room({ fillColor: '#41597a', floor: 'concrete' }));
    const pictures = [...document.querySelectorAll('[data-floor-picture]')];
    expect(pictures.map((p) => p.getAttribute('data-floor-picture'))).toEqual([
      'boards',
      'tiles',
      'carpet',
      'stone',
      'concrete',
    ]);
    expect(pictures[0]!.querySelector('rect')!.getAttribute('fill')).toBe('#41597a');
    expect(screen.getByRole('group', { name: 'Floor types page 2 of 2' })).toBeTruthy();
  });

  it('draws with no target', () => {
    showSection(undefined);
    expect(tile('Floorboards')).toBeTruthy();
  });
});
