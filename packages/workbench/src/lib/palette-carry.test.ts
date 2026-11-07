// @vitest-environment jsdom
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPaletteCarry } from './palette-carry';

// Carrying a palette tile onto the canvas by the pointer (each product's docs/specs/009-elements/furniture-facing.md
// "Turning while placing"), over a product's own pieces: here a 'sofa' is carried and a 'square' is not.
const setPreview = vi.fn();
const carry = createPaletteCarry<'sofa' | 'square'>({
  carries: (kind) => kind === 'sofa',
  sizeOf: () => ({ width: 10, height: 4 }),
  setPreview,
});

function press(over: Partial<React.PointerEvent> = {}) {
  return {
    pointerType: 'mouse',
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...over,
  } as React.PointerEvent;
}

function pointer(type: string, target: EventTarget, clientX: number, pointerId = 1) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0 });
  Object.defineProperty(e, 'pointerId', { value: pointerId });
  target.dispatchEvent(e);
}

afterEach(async () => {
  carry.endCarry();
  setPreview.mockClear();
  document.body.innerHTML = '';
  await new Promise((r) => setTimeout(r, 0));
});

describe('createPaletteCarry', () => {
  it('carries a turning tile past the threshold and drops it on the canvas', () => {
    document.body.innerHTML = '<main><div id="c"></div></main>';
    const canvas = document.getElementById('c')!;
    const heard = vi.fn(() => carry.lastCarryDrop());
    const off = carry.subscribeCarryDrop(heard);
    carry.startCarry(press(), 'sofa', 'cosy');
    expect(carry.carryPressed()).toBe(true);
    pointer('pointermove', canvas, 2);
    expect(setPreview).not.toHaveBeenCalled();
    pointer('pointermove', canvas, 3, 2);
    pointer('pointermove', canvas, 20);
    expect(setPreview).toHaveBeenCalledWith({ kind: 'sofa', width: 10, height: 4, carried: true });
    expect(document.documentElement.dataset.paletteCarry).toBe('');
    pointer('pointerup', canvas, 20);
    expect(heard).toHaveReturnedWith(
      expect.objectContaining({ kind: 'sofa', choice: 'cosy', target: canvas }),
    );
    expect(carry.lastCarryDrop()).toBeNull();
    expect(setPreview).toHaveBeenLastCalledWith(null);
    expect(document.documentElement.dataset.paletteCarry).toBeUndefined();
    off();
  });

  it('leaves a touch, a second button and a tile it does not carry to the browser', () => {
    carry.startCarry(press({ pointerType: 'touch' }), 'sofa');
    carry.startCarry(press({ button: 2 }), 'sofa');
    carry.startCarry(press(), 'square');
    expect(carry.carryPressed()).toBe(false);
    expect(carry.carriesByPointer('square')).toBe(false);
    const drag = { preventDefault: vi.fn() } as unknown as React.DragEvent;
    expect(carry.cancelDragUnderCarry(drag)).toBe(false);
    carry.startCarry(press(), 'sofa');
    expect(carry.cancelDragUnderCarry(drag)).toBe(true);
  });

  it('lands nothing over a floating panel, and puts the piece down on Escape or a cancel', () => {
    document.body.innerHTML = '<main><div data-floating-panel><b id="p"></b></div></main>';
    const panel = document.getElementById('p')!;
    const heard = vi.fn();
    const off = carry.subscribeCarryDrop(heard);
    carry.startCarry(press(), 'sofa');
    pointer('pointermove', panel, 20);
    pointer('pointerup', panel, 20);
    carry.startCarry(press(), 'sofa');
    pointer('pointermove', panel, 20);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(carry.carryPressed()).toBe(false);
    carry.startCarry(press(), 'sofa');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    pointer('pointercancel', panel, 0, 2);
    pointer('pointerup', panel, 0, 2);
    pointer('pointercancel', panel, 0);
    expect(carry.carryPressed()).toBe(false);
    expect(heard).not.toHaveBeenCalled();
    off();
  });
});
