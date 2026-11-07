// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  applyShapeVariant,
  createOutlinedRoom,
  createShape,
  GLASS_WALL,
  WINDOW_LIGHT,
  type ShapeElement,
} from '@livehuddle/document';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { PieceArt } from '@/components/canvas/PieceArt';
import { RoomWallsMenuSection } from '@/components/palette/CollabMenuSections';
import { RoomView } from './RoomView';
import { GlassRoomView, WindowView } from './WindowView';

// docs/specs/009-elements/room-builder.md "Window", office.md "Glass walls" (Work Tracker #538, #539).

const win = createShape('window', 0, 0);
const glass = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...applyShapeVariant(createShape('room', 0, 0), 'glass'),
  roomDoor: 'none',
  ...over,
});

describe('WindowView', () => {
  it('draws its frame, pane and a sunlit patch on light paper', () => {
    const c = render(<WindowView element={win} stroke="#334155" floor="#f5f0e6" />).container;
    expect(c.querySelector('[aria-label="Window"]')).not.toBeNull();
    const stop = c.querySelector('stop')!;
    expect(stop.getAttribute('stop-color')).toBe(WINDOW_LIGHT.light.colour);
    expect(stop.getAttribute('stop-opacity')).toBe(String(WINDOW_LIGHT.light.opacity));
    const light = c.querySelector('[data-window-light]')!;
    const id = c.querySelector('linearGradient')!.id;
    expect(id).toMatch(/^lh-window-light-[A-Za-z0-9_-]+$/);
    expect(light.getAttribute('fill')).toBe(`url(#${id})`);
    // Light passes no pointer: the whole view is pointer-inert.
    expect(c.firstElementChild?.className).toContain('pointer-events-none');
  });

  it('casts a fainter moonlight on dark paper', () => {
    const c = render(
      <CanvasSurfaceProvider surface="dark">
        <WindowView element={win} stroke="#cbd5e1" floor="#292524" />
      </CanvasSurfaceProvider>,
    ).container;
    const stop = c.querySelector('stop')!;
    expect(stop.getAttribute('stop-color')).toBe(WINDOW_LIGHT.dark.colour);
    expect(stop.getAttribute('stop-opacity')).toBe(String(WINDOW_LIGHT.dark.opacity));
  });

  it('is the art PieceArt draws for a window', () => {
    const c = render(<PieceArt element={win} stroke="#334155" fill="#f5f0e6" />).container;
    expect(c.querySelector('[aria-label="Window"]')).not.toBeNull();
  });
});

describe('GlassRoomView', () => {
  it("draws a glass rectangle's see-through walls, mullions and glinting back face", () => {
    const c = render(
      <GlassRoomView element={glass({ label: 'Booth' })} stroke="#334155" floor="#f5f0e6" />,
    ).container;
    expect(c.querySelector('[aria-label="Glass room, Booth"]')).not.toBeNull();
    const walls = c.querySelector('[data-glass-walls]')!;
    expect(walls.getAttribute('stroke-opacity')).toBe(String(GLASS_WALL.band));
    expect(c.querySelectorAll('rect')).toHaveLength(1);
    expect(c.querySelector(`path[stroke="#ffffff"]`)?.getAttribute('stroke-opacity')).toBe(
      String(GLASS_WALL.glint),
    );
  });

  it('dims its glints on dark paper and draws a custom room along its outline', () => {
    const outlined = {
      ...createOutlinedRoom([
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 0, y: 400 },
      ])!,
      variant: 'glass',
    };
    const c = render(
      <CanvasSurfaceProvider surface="dark">
        <GlassRoomView element={outlined} stroke="#cbd5e1" floor="#292524" />
        <GlassRoomView element={glass()} stroke="#cbd5e1" floor="#292524" />
      </CanvasSurfaceProvider>,
    ).container;
    const [custom, rect] = c.querySelectorAll('svg');
    expect(custom!.querySelector('rect')).toBeNull();
    expect(custom!.querySelector('path[stroke="#ffffff"]')).toBeNull();
    expect(rect!.querySelector('path[stroke="#ffffff"]')?.getAttribute('stroke-opacity')).toBe(
      String(GLASS_WALL.glintDark),
    );
  });

  it('is what RoomView draws for a glass room, however small, and not for a solid one', () => {
    const c = render(
      <>
        <RoomView
          element={glass({ width: 60, height: 60, label: '' })}
          stroke="#334155"
          floor="#f5f0e6"
        />
        <RoomView element={createShape('room', 0, 0)} stroke="#334155" floor="#f5f0e6" />
      </>,
    ).container;
    expect(c.querySelectorAll('[data-glass-walls]')).toHaveLength(1);
    expect(c.querySelector('[aria-label="Glass room"]')).not.toBeNull();
    expect(c.querySelector('[aria-label="Room, Room"]')).not.toBeNull();
  });
});

describe('RoomWallsMenuSection', () => {
  it('shows the room’s walls and sets Solid or Glass', () => {
    const onSetWalls = vi.fn();
    const props = { open: true, onToggle: () => {} };
    const { getByRole, rerender } = render(
      <RoomWallsMenuSection target={glass()} sectionProps={() => props} onSetWalls={onSetWalls} />,
    );
    expect(getByRole('button', { name: /Glass/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(getByRole('button', { name: /Solid/ }));
    expect(onSetWalls).toHaveBeenCalledWith('solid');
    rerender(
      <RoomWallsMenuSection
        target={undefined}
        sectionProps={() => props}
        onSetWalls={onSetWalls}
      />,
    );
    expect(getByRole('button', { name: /Solid/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(getByRole('button', { name: /Glass/ }));
    expect(onSetWalls).toHaveBeenLastCalledWith('glass');
  });
});
