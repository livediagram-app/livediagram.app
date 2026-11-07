// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOutlinedRoom } from '@livehuddle/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { resetPlacingFacing } from '@/lib/placing-facing';
import {
  PlacementPreview,
  placementLanding,
  placingKind,
  previewsItself,
} from './PlacementPreview';
import { PALETTE_TILES } from '@/components/palette/palette-tile-defs';
import { SHAPE_DEFAULT_SIZE } from '@livehuddle/document';

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

  it("lands a preset at its own size: a Double Door on the wall, a Boardroom's box", () => {
    const { piece: door, onWall } = placementLanding('door', { x: 200, y: 120 }, [room], 'double');
    expect(onWall).toBe(true);
    expect(door).toMatchObject({ width: 144, variant: 'double' });
    const { piece } = placementLanding('room', { x: 0, y: 0 }, [], 'boardroom');
    expect(piece).toMatchObject({ x: -400, y: -200, width: 800, label: 'Boardroom' });
  });

  it('centres any other placed piece on the pointer at its own size, never on a wall', () => {
    const { piece, onWall } = placementLanding('bar-stool', { x: 210, y: 105 }, [room]);
    expect(onWall).toBe(false);
    expect(piece.x + piece.width / 2).toBe(210);
    expect(piece.y + piece.height / 2).toBe(105);
  });
});

describe('placingKind', () => {
  it('names the armed or dragged piece that previews itself, placed or sized with art', () => {
    expect(placingKind(DOOR, null)).toBe('door');
    expect(placingKind(null, 'door')).toBe('door');
    expect(placingKind({ type: 'shape', kind: 'chair' }, null)).toBe('chair');
    expect(placingKind(null, 'avatar-pad')).toBe('avatar-pad');
    // A Room, a Stage, Grass: sized, but a tap or a drop lands one at its default size, so it previews too.
    expect(placingKind({ type: 'shape', kind: 'room' }, null)).toBe('room');
    expect(placingKind(null, 'room')).toBe('room');
    expect(placingKind(null, 'grass')).toBe('grass');
    expect(placingKind({ type: 'shape', kind: 'stage' }, null)).toBe('stage');
    expect(placingKind(null, null)).toBeNull();
  });

  it("steps a sized piece's armed preview aside while a press-and-drag draws its box", () => {
    expect(placingKind({ type: 'shape', kind: 'stage' }, null, true)).toBeNull();
    // A Room draws no box (dropped, then sized): it keeps previewing.
    expect(placingKind({ type: 'shape', kind: 'room' }, null, true)).toBe('room');
    // A placed piece has no box to draw: it keeps previewing.
    expect(placingKind({ type: 'shape', kind: 'chair' }, null, true)).toBe('chair');
    // A drag from the palette is no draw.
    expect(placingKind(null, 'room', true)).toBe('room');
  });

  it('leaves text, stickies and the generic shapes to the dashed footprint and the draw box', () => {
    expect(placingKind({ type: 'shape', kind: 'circle' }, null)).toBeNull();
    expect(placingKind(null, 'square')).toBeNull();
    expect(placingKind({ type: 'text' }, null)).toBeNull();
  });
});

describe('DoorPlacementPreview', () => {
  let main: HTMLElement;
  let wrapper: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    main = document.createElement('main');
    wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
    main.append(wrapper);
    document.body.append(main);
  });
  afterEach(() => {
    vi.useRealTimers();
    main.remove();
    setPaletteDragPreview(null);
  });

  const move = (
    type: 'pointermove' | 'dragover',
    x: number,
    y: number,
    target: EventTarget = wrapper,
  ) =>
    act(() => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
      target.dispatchEvent(e);
      vi.advanceTimersToNextFrame();
    });

  const preview = () => document.querySelector('[data-testid="placement-preview"]');

  it('follows the pointer onto a wall while the Door tile is armed', () => {
    render(
      <PlacementPreview
        pendingDraw={DOOR}
        elements={[room]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
      { container: wrapper },
    );
    expect(preview()).toBeNull();
    move('pointermove', 200, 120);
    expect(preview()?.hasAttribute('data-on-wall')).toBe(true);
    move('pointermove', 900, 900);
    expect(preview()).not.toBeNull();
    expect(preview()?.hasAttribute('data-on-wall')).toBe(false);
  });

  it('previews a Window on the wall it would snap to, facing in (room-builder.md "Window")', () => {
    const win = { type: 'shape', kind: 'window' } as PendingDraw;
    expect(placingKind(win, null)).toBe('window');
    const landing = placementLanding('window', { x: 200, y: 120 }, [room]);
    expect(landing.onWall).toBe(true);
    // The top wall: the room is below, the window's own +y, so it keeps the wall's angle.
    expect(landing.piece.rotation).toBe(0);
    render(
      <PlacementPreview
        pendingDraw={win}
        elements={[room]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
      { container: wrapper },
    );
    move('pointermove', 200, 120);
    expect(preview()?.getAttribute('data-kind')).toBe('window');
    expect(preview()?.hasAttribute('data-on-wall')).toBe(true);
    expect(preview()?.hasAttribute('inert')).toBe(true);
    expect(preview()?.querySelector('[aria-label="Window"]')).not.toBeNull();
    move('pointermove', 900, 900);
    expect(preview()?.hasAttribute('data-on-wall')).toBe(false);
  });

  it('hides off the canvas', () => {
    render(
      <PlacementPreview
        pendingDraw={DOOR}
        elements={[room]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
      { container: wrapper },
    );
    move('pointermove', 200, 120);
    move('pointermove', 200, 120, document.body);
    expect(preview()).toBeNull();
  });

  it("draws the armed preset's own piece, then the dragged one's", () => {
    const { rerender } = render(
      <PlacementPreview
        pendingDraw={{ type: 'shape', kind: 'corridor', variant: 'cross' }}
        elements={[]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
      { container: wrapper },
    );
    move('pointermove', 500, 500);
    expect(preview()?.getAttribute('style')).toContain('width: 480px; height: 480px');
    act(() => setPaletteDragPreview({ kind: 'rug', width: 320, height: 88, variant: 'runner' }));
    rerender(
      <PlacementPreview
        pendingDraw={null}
        elements={[]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
    );
    move('dragover', 500, 500);
    expect(preview()?.getAttribute('style')).toContain('width: 320px; height: 88px');
  });

  it('follows a Door dragged from the palette', () => {
    setPaletteDragPreview({ kind: 'door', width: 96, height: 24 });
    render(
      <PlacementPreview
        pendingDraw={null}
        elements={[room]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
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

  // docs/specs/009-elements/furniture-facing.md "Turning while placing".
  it('turns an armed sofa on Space, about the pointer, and lands it turned', () => {
    render(
      <PlacementPreview
        pendingDraw={{ type: 'shape', kind: 'sofa' }}
        elements={[]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
      { container: wrapper },
    );
    move('pointermove', 400, 300);
    const box = () => {
      const s = (preview() as HTMLElement).style;
      return {
        l: parseFloat(s.left),
        t: parseFloat(s.top),
        w: parseFloat(s.width),
        h: parseFloat(s.height),
      };
    };
    const flat = box();
    expect(flat.w).toBeGreaterThan(flat.h);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true }),
      );
    });
    const turned = box();
    // A sofa on its side is tall, still centred on the pointer.
    expect(turned.h).toBeGreaterThan(turned.w);
    expect(turned.l + turned.w / 2).toBeCloseTo(400);
    expect(turned.t + turned.h / 2).toBeCloseTo(300);
    const { piece } = placementLanding('sofa', { x: 400, y: 300 }, [], undefined, 'e');
    expect(piece).toMatchObject({ chairFacing: 'e', width: turned.w, height: turned.h });
    resetPlacingFacing();
  });

  it('draws an armed Room itself at its default size under the pointer', () => {
    render(
      <PlacementPreview
        pendingDraw={{ type: 'shape', kind: 'room' }}
        elements={[]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
      { container: wrapper },
    );
    move('pointermove', 400, 300);
    const el = preview() as HTMLElement | null;
    expect(el?.dataset.kind).toBe('room');
    expect(el!.style.width).toBe(`${SHAPE_DEFAULT_SIZE.room.width}px`);
    expect(el!.style.height).toBe(`${SHAPE_DEFAULT_SIZE.room.height}px`);
  });

  it('hides an armed Stage while its box is being drawn', () => {
    render(
      <PlacementPreview
        pendingDraw={{ type: 'shape', kind: 'stage' }}
        elements={[]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
        drawing
      />,
      { container: wrapper },
    );
    move('pointermove', 400, 300);
    expect(preview()).toBeNull();
  });

  it('listens to nothing and shows nothing while no placed piece is being added', () => {
    render(
      <PlacementPreview
        pendingDraw={null}
        elements={[room]}
        wrapperRef={{ current: wrapper }}
        zoom={1}
      />,
      { container: wrapper },
    );
    move('pointermove', 200, 120);
    expect(preview()).toBeNull();
  });

  // The owner's report: an armed Pet Bed would not place. Its preview's sleeping dog is a Pat the Dog button across
  // the bed's middle, right under the pointer, and it took the click (palette-drag-ghost.md "The preview is inert").
  it.each(['pet-bed', 'jukebox', 'notice-board'] as const)(
    'keeps every control an armed %s preview draws from the press that places it',
    (kind) => {
      render(
        <PlacementPreview
          pendingDraw={{ type: 'shape', kind }}
          elements={[]}
          wrapperRef={{ current: wrapper }}
          zoom={1}
        />,
        { container: wrapper },
      );
      move('pointermove', 400, 300);
      const el = preview() as HTMLElement;
      expect(el.hasAttribute('inert')).toBe(true);
      const controls = el.querySelectorAll('button, [data-piece-control]');
      if (kind === 'pet-bed') expect(el.querySelector('[aria-label="Pat the Dog"]')).not.toBeNull();
      for (const c of controls) expect(c.closest('[inert]')).toBe(el);
    },
  );
});

// The owner's report: a Room tile dragged or armed showed no preview of the room. Every Space piece tile previews the
// piece itself, so none is left with a bare footprint or nothing.
describe('every Space piece tile', () => {
  it('previews the piece itself', () => {
    const missing = PALETTE_TILES.filter(
      (t) =>
        t.action.type === 'shape' &&
        t.section === 'tools' &&
        t.tileGroup !== undefined &&
        t.tileGroup !== 'embed' &&
        t.tileGroup !== 'web' &&
        !previewsItself(t.action.kind),
    ).map((t) => t.id);
    expect(missing).toEqual([]);
  });
});
