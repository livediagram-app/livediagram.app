// @vitest-environment jsdom
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelDragUnderCarry,
  carriesByPointer,
  carryPressed,
  endCarry,
  lastCarryDrop,
  startCarry,
  subscribeCarryDrop,
  type CarryDrop,
} from './palette-carry';
import { getPaletteDragPreview } from './palette-drag-preview';

// Carrying a tile of a piece that turns by the pointer, so Space can turn it on its way
// (docs/specs/009-elements/furniture-facing.md "Turning while placing").

let canvas: HTMLElement;
let panel: HTMLElement;
let outside: HTMLElement;

beforeEach(() => {
  document.body.innerHTML =
    '<main><div id="canvas"></div><div data-floating-panel><button id="panel"></button></div></main><div id="outside"></div>';
  canvas = document.getElementById('canvas')!;
  panel = document.getElementById('panel')!;
  outside = document.getElementById('outside')!;
});
afterEach(async () => {
  endCarry();
  // A released carry swallows its click until the next task: let it lapse between tests.
  await new Promise((r) => setTimeout(r, 0));
});

function press(over: Partial<React.PointerEvent> = {}) {
  return {
    pointerType: 'mouse',
    button: 0,
    pointerId: 1,
    clientX: 10,
    clientY: 10,
    ...over,
  } as React.PointerEvent;
}

function pointer(type: string, target: EventTarget, init: { x: number; y: number; id?: number }) {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x,
    clientY: init.y,
  });
  Object.defineProperty(e, 'pointerId', { value: init.id ?? 1 });
  target.dispatchEvent(e);
}

function drops() {
  const seen: CarryDrop[] = [];
  const off = subscribeCarryDrop(() => seen.push(lastCarryDrop()!));
  return { seen, off };
}

describe('which tiles are carried', () => {
  it('carries the pieces that turn, and only those', () => {
    expect(carriesByPointer('sofa')).toBe(true);
    expect(carriesByPointer('lockers')).toBe(true);
    expect(carriesByPointer('plant')).toBe(false);
    expect(carriesByPointer('rectangle')).toBe(false);
  });

  it('leaves a touch, a second button and a kind that does not turn to the browser drag', () => {
    startCarry(press({ pointerType: 'touch' }), 'sofa');
    expect(carryPressed()).toBe(false);
    startCarry(press({ button: 2 }), 'sofa');
    expect(carryPressed()).toBe(false);
    startCarry(press(), 'plant');
    expect(carryPressed()).toBe(false);
  });

  it('cancels the browser drag under a carry, and only then', () => {
    const drag = { preventDefault: vi.fn() } as unknown as React.DragEvent;
    expect(cancelDragUnderCarry(drag)).toBe(false);
    startCarry(press(), 'sofa');
    expect(cancelDragUnderCarry(drag)).toBe(true);
    expect(drag.preventDefault).toHaveBeenCalled();
  });
});

describe('a carry', () => {
  it('starts past a few pixels, publishing the carried preview', () => {
    startCarry(press(), 'sofa');
    pointer('pointermove', canvas, { x: 12, y: 11 });
    expect(getPaletteDragPreview()).toBeNull();
    pointer('pointermove', canvas, { x: 30, y: 30 });
    expect(getPaletteDragPreview()).toMatchObject({ kind: 'sofa', carried: true });
    expect(document.documentElement.dataset.paletteCarry).toBe('');
  });

  it('ignores another pointer', () => {
    startCarry(press(), 'sofa');
    pointer('pointermove', canvas, { x: 90, y: 90, id: 2 });
    expect(getPaletteDragPreview()).toBeNull();
    pointer('pointerup', canvas, { x: 90, y: 90, id: 2 });
    expect(carryPressed()).toBe(true);
  });

  it('released over the canvas, hands the drop over and ends', () => {
    const { seen, off } = drops();
    startCarry(press(), 'sofa', 'variant');
    pointer('pointermove', canvas, { x: 40, y: 40 });
    pointer('pointerup', canvas, { x: 50, y: 60 });
    expect(seen).toEqual([
      { kind: 'sofa', choice: 'variant', clientX: 50, clientY: 60, target: canvas },
    ]);
    expect(lastCarryDrop()).toBeNull();
    expect(carryPressed()).toBe(false);
    expect(getPaletteDragPreview()).toBeNull();
    expect(document.documentElement.dataset.paletteCarry).toBeUndefined();
    off();
  });

  it('swallows the click its release makes, and no later one', async () => {
    startCarry(press(), 'sofa');
    pointer('pointermove', canvas, { x: 40, y: 40 });
    pointer('pointerup', canvas, { x: 40, y: 40 });
    const clicked = vi.fn();
    canvas.addEventListener('click', clicked);
    canvas.click();
    expect(clicked).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    canvas.click();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('released over a panel or off the canvas, lands nothing', () => {
    const { seen, off } = drops();
    for (const target of [panel, outside]) {
      startCarry(press(), 'sofa');
      pointer('pointermove', canvas, { x: 40, y: 40 });
      pointer('pointerup', target, { x: 40, y: 40 });
      expect(carryPressed()).toBe(false);
    }
    expect(seen).toEqual([]);
    off();
  });

  it('a press released before it moved is the tile own click', () => {
    const { seen, off } = drops();
    startCarry(press(), 'sofa');
    pointer('pointerup', canvas, { x: 10, y: 10 });
    expect(seen).toEqual([]);
    expect(carryPressed()).toBe(false);
    const clicked = vi.fn();
    canvas.addEventListener('click', clicked);
    canvas.click();
    expect(clicked).toHaveBeenCalled();
    off();
  });

  it('Escape puts it down, and nothing else hears the key', () => {
    startCarry(press(), 'sofa');
    // Before it is carried, Escape is not the carry's.
    const early = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(early);
    expect(early.defaultPrevented).toBe(false);
    pointer('pointermove', canvas, { x: 40, y: 40 });
    const other = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    window.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    const heard = vi.fn();
    document.addEventListener('keydown', heard);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    document.body.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(heard).not.toHaveBeenCalled();
    expect(getPaletteDragPreview()).toBeNull();
    document.removeEventListener('keydown', heard);
  });

  it('a cancelled pointer or a lost window ends it', () => {
    startCarry(press(), 'sofa');
    pointer('pointercancel', canvas, { x: 0, y: 0, id: 2 });
    expect(carryPressed()).toBe(true);
    pointer('pointercancel', canvas, { x: 0, y: 0 });
    expect(carryPressed()).toBe(false);
    startCarry(press(), 'sofa');
    window.dispatchEvent(new Event('blur'));
    expect(carryPressed()).toBe(false);
  });

  it('a new press ends the one before', () => {
    startCarry(press(), 'sofa');
    pointer('pointermove', canvas, { x: 40, y: 40 });
    startCarry(press({ pointerId: 3 }), 'lockers');
    expect(getPaletteDragPreview()).toBeNull();
    pointer('pointermove', canvas, { x: 40, y: 40, id: 3 });
    expect(getPaletteDragPreview()).toMatchObject({ kind: 'lockers' });
  });
});
