// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MouseEvent, PointerEvent } from 'react';
import { DOUBLE_PRESS_MS, pressLedger } from '@/lib/double-press';
import { pressedElement, useSmallElementDoubleTap } from './useSmallElementDoubleTap';

// A finger's double-tap on a small element frames it before it edits (docs/specs/008-canvas/canvas-and-palette.md
// "Double-tap to zoom"): the second press is caught ahead of the element's own, and so is the dblclick after it.

let t = 10_000;
const press = (target: Element, pointerType = 'touch') => {
  const e = {
    target,
    pointerType,
    timeStamp: (t += 100),
    clientX: 5,
    clientY: 5,
    stopPropagation: vi.fn(),
  };
  return e as unknown as PointerEvent & { stopPropagation: ReturnType<typeof vi.fn> };
};
const dblclick = (at = t) =>
  ({ timeStamp: at, stopPropagation: vi.fn() }) as unknown as MouseEvent & {
    stopPropagation: ReturnType<typeof vi.fn>;
  };

function element(id = 'a') {
  const el = document.createElement('div');
  el.setAttribute('data-element-id', id);
  document.body.append(el);
  return el;
}

beforeEach(() => {
  // A fresh ledger: a press far from the last one pairs with nothing.
  t += 10_000;
  pressLedger.press({ id: 'reset', t, x: 0, y: 0, wasSelected: true });
});
afterEach(() => document.body.replaceChildren());

describe('useSmallElementDoubleTap', () => {
  it('frames on the second press of a double-tap, stops it, and swallows the dblclick', () => {
    const onElement = vi.fn(() => true);
    const { result } = renderHook(() => useSmallElementDoubleTap(onElement));
    const el = element();
    // The canvas's capture runs first; the element then records its press.
    const first = press(el);
    result.current.onPointerDownCapture(first);
    pressLedger.press({ id: 'a', t: first.timeStamp, x: 5, y: 5, wasSelected: false });
    expect(onElement).not.toHaveBeenCalled();
    expect(first.stopPropagation).not.toHaveBeenCalled();
    const second = press(el);
    result.current.onPointerDownCapture(second);
    expect(onElement).toHaveBeenCalledWith(el);
    expect(second.stopPropagation).toHaveBeenCalled();
    const dbl = dblclick();
    result.current.onDoubleClickCapture(dbl);
    expect(dbl.stopPropagation).toHaveBeenCalled();
    // Only that one dblclick.
    const later = dblclick();
    result.current.onDoubleClickCapture(later);
    expect(later.stopPropagation).not.toHaveBeenCalled();
  });

  it('lets an element big enough to work on edit as usual', () => {
    const onElement = vi.fn(() => false);
    const { result } = renderHook(() => useSmallElementDoubleTap(onElement));
    const el = element();
    const first = press(el);
    pressLedger.press({ id: 'a', t: first.timeStamp, x: 5, y: 5, wasSelected: false });
    const second = press(el);
    result.current.onPointerDownCapture(second);
    expect(onElement).toHaveBeenCalled();
    expect(second.stopPropagation).not.toHaveBeenCalled();
    const dbl = dblclick();
    result.current.onDoubleClickCapture(dbl);
    expect(dbl.stopPropagation).not.toHaveBeenCalled();
  });

  it('leaves a mouse and a pen to edit at once', () => {
    const onElement = vi.fn(() => true);
    const { result } = renderHook(() => useSmallElementDoubleTap(onElement));
    const el = element();
    for (const kind of ['mouse', 'pen']) {
      const first = press(el, kind);
      pressLedger.press({ id: 'a', t: first.timeStamp, x: 5, y: 5, wasSelected: false });
      result.current.onPointerDownCapture(press(el, kind));
    }
    expect(onElement).not.toHaveBeenCalled();
  });

  it('lets a dblclick long after a framing through', () => {
    const { result } = renderHook(() => useSmallElementDoubleTap(() => true));
    const el = element();
    const first = press(el);
    pressLedger.press({ id: 'a', t: first.timeStamp, x: 5, y: 5, wasSelected: false });
    const second = press(el);
    result.current.onPointerDownCapture(second);
    const late = dblclick(second.timeStamp + DOUBLE_PRESS_MS + 1);
    result.current.onDoubleClickCapture(late);
    expect(late.stopPropagation).not.toHaveBeenCalled();
  });
});

describe('pressedElement', () => {
  it('is the element pressed, or the one whose handles were pressed', () => {
    const el = element('box');
    const inner = document.createElement('span');
    el.append(inner);
    expect(pressedElement(inner)).toBe(el);
    const grips = document.createElement('div');
    grips.setAttribute('data-grips-for', 'box');
    const handle = document.createElement('span');
    grips.append(handle);
    document.body.append(grips);
    expect(pressedElement(handle)).toBe(el);
  });

  it('is nothing on the bare canvas, inside an open editor, or for a non-element target', () => {
    const el = element();
    const editor = document.createElement('textarea');
    el.append(editor);
    expect(pressedElement(editor)).toBeNull();
    expect(pressedElement(document.createElement('div'))).toBeNull();
    expect(pressedElement(null)).toBeNull();
    const orphan = document.createElement('div');
    orphan.setAttribute('data-grips-for', 'gone');
    expect(pressedElement(orphan)).toBeNull();
  });
});
