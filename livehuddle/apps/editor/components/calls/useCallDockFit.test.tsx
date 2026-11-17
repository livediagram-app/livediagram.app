// @vitest-environment jsdom
// The Call dock clear of the bottom-left panels (docs/specs/008-canvas/avatar-mode.md "The Call dock", "Where").
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallDockFit } from './useCallDockFit';

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function el(box: DOMRect, attr?: string): HTMLElement {
  const node = document.createElement('div');
  if (attr) node.setAttribute(attr, '');
  node.getBoundingClientRect = () => box;
  return node;
}

// A 700 px window: the row 16 to 684, a 191 px dock, 150 px of buttons, the Map 16 to 272.
function row(rowWidth = 668): HTMLElement {
  const r = el(rect(16, 800, rowWidth, 40));
  // The buttons' wrapper stretches to its column (400 px); its two buttons span 150 px, with one hidden.
  const buttons = el(rect(284, 800, 400, 40), 'data-cluster-buttons');
  buttons.append(el(rect(534, 800, 100, 40)), el(rect(644, 800, 40, 40)), el(rect(0, 0, 0, 0)));
  r.append(el(rect(0, 0, 191, 40), 'data-call-dock'), buttons);
  return r;
}
const map = el(rect(16, 500, 256, 340));

describe('useCallDockFit', () => {
  const observed: Element[] = [];
  beforeEach(() => {
    observed.length = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(target: Element) {
          observed.push(target);
        }
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const hook = (p: {
    active?: boolean;
    rowEl?: HTMLElement | null;
    stack?: HTMLElement | null;
  }) => {
    // Stable across renders, as CanvasChrome's ref and callback are.
    const rowRef = { current: p.rowEl === undefined ? row() : p.rowEl };
    const stack = () => (p.stack === undefined ? map : p.stack);
    return renderHook(() =>
      useCallDockFit({ active: p.active ?? true, rowRef, stack, stackKey: 'minimap', scale: 1 }),
    );
  };

  it('clears the Map beside the row and watches the row, the dock, the buttons and the Map', () => {
    expect(hook({}).result.current).toEqual({ clear: 264, lifted: false });
    expect(observed).toHaveLength(7);
  });

  it('lifts the dock when the line is too short for all three', () => {
    expect(hook({ rowEl: row(600) }).result.current).toEqual({ clear: 264, lifted: true });
  });

  it('keeps nothing clear with no stack, or a stack ending above the row', () => {
    expect(hook({ stack: null }).result.current).toEqual({ clear: 0, lifted: false });
    expect(hook({ stack: el(rect(16, 100, 256, 300)) }).result.current).toEqual({
      clear: 0,
      lifted: false,
    });
  });

  it('counts no width for a wrapper without buttons', () => {
    const r = row(470);
    r.querySelector('[data-cluster-buttons]')!.replaceChildren();
    // 264 + 191 + 0 + 12 = 467 fits in 470.
    expect(hook({ rowEl: r }).result.current.lifted).toBe(false);
  });

  it('does nothing without the dock in the row', () => {
    expect(hook({ active: false }).result.current).toEqual({ clear: 0, lifted: false });
    expect(hook({ rowEl: null }).result.current).toEqual({ clear: 0, lifted: false });
    expect(hook({ rowEl: el(rect(0, 0, 600, 40)) }).result.current).toEqual({
      clear: 0,
      lifted: false,
    });
  });
});
