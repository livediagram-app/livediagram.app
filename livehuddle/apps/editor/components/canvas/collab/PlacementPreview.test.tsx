// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOutlinedRoom } from '@livehuddle/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { PlacementPreview, placementLanding, placingKind } from './PlacementPreview';

// docs/specs/010-palette/palette-drag-ghost.md "Placed pieces preview themselves": while a placed piece is being
// added, the piece follows the pointer; a Door already sits on the wall it would snap to (room-builder.md "Door").

const room = createOutlinedRoom([
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 200 },
  { x: 200, y: 300 },
  { x: 100, y: 300 },
])!;
const DOOR = { type: 'shape', kind: 'door' } as PendingDraw;

describe('placementLanding', () => {
  it('lands on the wall near the pointer, turned to it', () => {
    const { piece: door, onWall } = placementLanding('door', { x: 200, y: 120 }, [room]);
    expect(onWall).toBe(true);
    expect(door.x + door.width / 2).toBeCloseTo(200);
    expect(door.y + door.height / 2).toBeCloseTo(100);
  });

  it('turns onto a 45-degree wall', () => {
    expect(placementLanding('door', { x: 260, y: 260 }, [room]).piece.rotation).toBe(135);
  });

  it('stands free, centred on the pointer, away from every wall', () => {
    const { piece: door, onWall } = placementLanding('door', { x: 900, y: 900 }, [room]);
    expect(onWall).toBe(false);
    expect(door.x + door.width / 2).toBe(900);
    expect(door.y + door.height / 2).toBe(900);
  });

  it('centres any other placed piece on the pointer at its own size, never on a wall', () => {
    const { piece, onWall } = placementLanding('bar-stool', { x: 210, y: 105 }, [room]);
    expect(onWall).toBe(false);
    expect(piece.x + piece.width / 2).toBe(210);
    expect(piece.y + piece.height / 2).toBe(105);
  });
});

describe('placingKind', () => {
  it('names the armed or dragged placed piece, and nothing for a sized one', () => {
    expect(placingKind(DOOR, null)).toBe('door');
    expect(placingKind(null, 'door')).toBe('door');
    expect(placingKind({ type: 'shape', kind: 'chair' }, null)).toBe('chair');
    expect(placingKind(null, 'avatar-pad')).toBe('avatar-pad');
    expect(placingKind({ type: 'shape', kind: 'room' }, 'grass')).toBeNull();
    expect(placingKind(null, null)).toBeNull();
  });
});

describe('DoorPlacementPreview', () => {
  let main: HTMLElement;
  let wrapper: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    main = document.createElement('main');
    wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
    main.append(wrapper);
    document.body.append(main);
  });
  afterEach(() => {
    vi.useRealTimers();
    main.remove();
    setPaletteDragPreview(null);
  });

  const move = (type: 'pointermove' | 'dragover', x: number, y: number, target: EventTarget = wrapper) =>
    act(() => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
      target.dispatchEvent(e);
      vi.advanceTimersToNextFrame();
    });

  const preview = () => document.querySelector('[data-testid="placement-preview"]');

  it('follows the pointer onto a wall while the Door tile is armed', () => {
    render(
      <PlacementPreview pendingDraw={DOOR} elements={[room]} wrapperRef={{ current: wrapper }} zoom={1} />,
      { container: wrapper },
    );
    expect(preview()).toBeNull();
    move('pointermove', 200, 120);
    expect(preview()?.hasAttribute('data-on-wall')).toBe(true);
    move('pointermove', 900, 900);
    expect(preview()).not.toBeNull();
    expect(preview()?.hasAttribute('data-on-wall')).toBe(false);
  });

  it('hides off the canvas', () => {
    render(
      <PlacementPreview pendingDraw={DOOR} elements={[room]} wrapperRef={{ current: wrapper }} zoom={1} />,
      { container: wrapper },
    );
    move('pointermove', 200, 120);
    move('pointermove', 200, 120, document.body);
    expect(preview()).toBeNull();
  });

  it('follows a Door dragged from the palette', () => {
    setPaletteDragPreview({ kind: 'door', width: 96, height: 24 });
    render(
      <PlacementPreview pendingDraw={null} elements={[room]} wrapperRef={{ current: wrapper }} zoom={1} />,
      { container: wrapper },
    );
    move('dragover', 200, 120);
    expect(preview()?.hasAttribute('data-on-wall')).toBe(true);
  });

  it('draws the piece itself for an armed chair, following the pointer', () => {
    render(
      <PlacementPreview
        pendingDraw={{ type: 'shape', kind: 'chair' }}
        elements={[]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
      { container: wrapper },
    );
    move('pointermove', 400, 300);
    const el = preview() as HTMLElement | null;
    expect(el?.dataset.kind).toBe('chair');
    expect(el?.querySelector('svg')).not.toBeNull();
    const left = el!.style.left;
    move('pointermove', 500, 300);
    expect((preview() as HTMLElement).style.left).not.toBe(left);
  });

  it('listens to nothing and shows nothing while no placed piece is being added', () => {
    render(
      <PlacementPreview pendingDraw={null} elements={[room]} wrapperRef={{ current: wrapper }} zoom={1} />,
      { container: wrapper },
    );
    move('pointermove', 200, 120);
    expect(preview()).toBeNull();
  });
});
