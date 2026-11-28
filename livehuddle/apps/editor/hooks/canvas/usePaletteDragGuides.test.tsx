// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, ROOM_WALL, SHAPE_DEFAULT_SIZE, type Element } from '@livehuddle/document';
import { placingSize, resetPlacingFacing, turnPlacing } from '@/lib/placing-facing';
import {
  getPaletteDragSnap,
  setPaletteDragPreview,
  setPaletteDragSnap,
} from '@/lib/palette-drag-preview';
import { usePaletteDragGuides } from './usePaletteDragGuides';

// Alignment guides during a palette drag (docs/specs/008-canvas/canvas-and-palette.md): the hook is the one
// owner of the in-flight snap, which the ghost and the drop both read.

const neighbour = { id: 'n', type: 'sticky', x: 100, y: 100, width: 200, height: 200 } as Element;

// A 1:1 rect at the origin makes canvas coords and client coords the same number.
function wrapper() {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
  const main = document.createElement('main');
  main.appendChild(el);
  document.body.appendChild(main);
  return { current: el };
}

function dragOver(target: HTMLElement, clientX: number, clientY: number, metaKey = false) {
  const event = new Event('dragover', { bubbles: true });
  Object.defineProperty(event, 'clientX', { value: clientX });
  Object.defineProperty(event, 'clientY', { value: clientY });
  Object.defineProperty(event, 'metaKey', { value: metaKey });
  act(() => {
    target.dispatchEvent(event);
  });
}

function render(elements: Element[] = [neighbour]) {
  const wrapperRef = wrapper();
  setPaletteDragPreview({ kind: 'desk', width: 200, height: 200 });
  const view = renderHook(() => usePaletteDragGuides({ elements, readZoom: () => 1, wrapperRef }));
  return { ...view, wrapperRef };
}

afterEach(() => {
  resetPlacingFacing();
  setPaletteDragPreview(null);
  setPaletteDragSnap(null);
  document.body.innerHTML = '';
});

describe('usePaletteDragGuides', () => {
  it('publishes the snap onto a neighbour, and the guide that shows it', () => {
    const { result, wrapperRef } = render();
    // Footprint x = 104: four px right of the neighbour's left edge.
    dragOver(wrapperRef.current, 204, 600);
    expect(getPaletteDragSnap()?.dx).toBe(-4);
    expect(result.current.guides.some((g) => g.axis === 'x')).toBe(true);
  });

  it('clears the snap and the guides when the drag leaves the window', () => {
    const { result, wrapperRef } = render();
    dragOver(wrapperRef.current, 204, 600);
    act(() => {
      document.dispatchEvent(new Event('dragleave'));
    });
    expect(getPaletteDragSnap()).toBeNull();
    expect(result.current.guides).toEqual([]);
  });

  it('clears on Escape', () => {
    const { wrapperRef } = render();
    dragOver(wrapperRef.current, 204, 600);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(getPaletteDragSnap()).toBeNull();
  });
});

describe('a piece turned while placed (docs/specs/009-elements/furniture-facing.md "Turning while placing")', () => {
  function carried() {
    const wrapperRef = wrapper();
    setPaletteDragPreview({ kind: 'sofa', ...SHAPE_DEFAULT_SIZE.sofa, carried: true });
    renderHook(() =>
      usePaletteDragGuides({ elements: [neighbour], readZoom: () => 1, wrapperRef }),
    );
    return wrapperRef;
  }

  function pointerMove(target: HTMLElement, clientX: number, clientY: number) {
    const event = new MouseEvent('pointermove', { bubbles: true, clientX, clientY });
    act(() => {
      target.dispatchEvent(event);
    });
  }

  it('snaps a carried tile on its pointer moves, at the turned box', () => {
    const wrapperRef = carried();
    turnPlacing('sofa', 1);
    const { width } = placingSize('sofa', SHAPE_DEFAULT_SIZE.sofa);
    // The turned footprint's left edge four px right of the neighbour's.
    pointerMove(wrapperRef.current, 104 + width / 2, 600);
    expect(getPaletteDragSnap()?.dx).toBe(-4);
  });

  it('re-measures when the piece turns under a still pointer', () => {
    const wrapperRef = carried();
    const { width: turnedWidth } = (() => {
      turnPlacing('sofa', 1);
      const size = placingSize('sofa', SHAPE_DEFAULT_SIZE.sofa);
      resetPlacingFacing();
      return size;
    })();
    pointerMove(wrapperRef.current, 104 + turnedWidth / 2, 600);
    const before = getPaletteDragSnap()?.dx;
    act(() => void turnPlacing('sofa', 1));
    expect(getPaletteDragSnap()?.dx).toBe(-4);
    expect(before).not.toBe(-4);
  });
});

// docs/specs/009-elements/office.md "Rooms line up": a Room dragged in beside a room shares its wall; Cmd / Ctrl drops it
// where the pointer is (docs/specs/008-canvas/snap-override.md).
describe('a Room dragged in beside a room', () => {
  const left = {
    ...createShape('room', 0, 0),
    id: 'a',
    width: 480,
    height: 320,
    roomDoor: 'none',
  } as Element;
  function renderRoom(variant?: string, width = 480, height = 320) {
    const wrapperRef = wrapper();
    setPaletteDragPreview({ kind: 'room', variant, width, height });
    renderHook(() => usePaletteDragGuides({ elements: [left], readZoom: () => 1, wrapperRef }));
    return wrapperRef;
  }

  it('publishes the shared-wall snap for a box edge to box edge drop', () => {
    const target = renderRoom();
    dragOver(target.current, 480 + 240, 160);
    expect(getPaletteDragSnap()?.dx).toBe(-ROOM_WALL);
  });

  it('publishes no snap with Cmd / Ctrl held', () => {
    const target = renderRoom();
    dragOver(target.current, 480 + 240, 160, true);
    expect(getPaletteDragSnap()).toBeNull();
  });

  it('lines a shaped preset up by its edges only', () => {
    const target = renderRoom('hexagon', 680, 560);
    dragOver(target.current, 482 + 340, 280);
    expect(getPaletteDragSnap()?.dx).toBe(-2);
  });
});
