// @vitest-environment jsdom

// The label toolbar's place (liveworkspace/docs/specs/011-workbench/label-editor.md "The toolbar", Work Tracker 1313):
// flipped below near the top, slid back inside the screen at the left and right edges, its slide relaxing once the
// label moves away, and its transform in the editor's units at any zoom.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FLIP_BELOW_TOP,
  labelToolbarTransform,
  useLabelToolbarPlacement,
  type ToolbarShift,
} from './useLabelToolbarPlacement';

type Box = { left: number; top: number; width: number; height: number };

const domRect = ({ left, top, width, height }: Box) =>
  ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }) as DOMRect;

// A phone: 390 by 844.
const PHONE = { width: 390, height: 844 };
const saved = { width: window.innerWidth, height: window.innerHeight };
const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
};

beforeEach(() => setViewport(PHONE.width, PHONE.height));
afterEach(() => setViewport(saved.width, saved.height));

// The editor at `editorTop`, and a toolbar whose centred spot is `natural`: the rect it reports carries the slide the
// hook has put in force, as the real transform would.
function mount(natural: Box, editorTop = 400, caption?: Box) {
  const state = { natural, editorTop };
  const editor = document.createElement('div');
  editor.getBoundingClientRect = () =>
    domRect({ left: 100, top: state.editorTop, width: 120, height: 40 });
  const toolbar = document.createElement('div');
  let current: ToolbarShift = { x: 0, y: 0 };
  const moved = (b: Box) => domRect({ ...b, left: b.left + current.x, top: b.top + current.y });
  toolbar.getBoundingClientRect = () => moved(state.natural);
  if (caption) {
    const pill = document.createElement('span');
    pill.setAttribute('data-floating-title', '');
    pill.getBoundingClientRect = () => moved(caption);
    toolbar.append(pill);
  }
  const hook = renderHook(() => {
    const placement = useLabelToolbarPlacement({ current: editor }, { current: toolbar });
    current = placement.shift;
    return placement;
  });
  return { ...hook, state };
}

describe('useLabelToolbarPlacement', () => {
  it('leaves a toolbar that fits where it is, above the element', () => {
    const { result } = mount({ left: 40, top: 340, width: 300, height: 44 });
    expect(result.current).toEqual({ placeBelow: false, shift: { x: 0, y: 0 } });
  });

  it('slides a toolbar off the left edge back in, 8 px from it', () => {
    const { result } = mount({ left: -70, top: 340, width: 300, height: 44 });
    expect(result.current.shift).toEqual({ x: 78, y: 0 });
  });

  it('slides a toolbar off the right edge back in, 8 px from it', () => {
    const { result } = mount({ left: 200, top: 340, width: 300, height: 44 });
    // Its right edge at 500 comes back to 390 - 8.
    expect(result.current.shift).toEqual({ x: -118, y: 0 });
  });

  it('keeps the start of a toolbar wider than the screen in view', () => {
    const { result } = mount({ left: 30, top: 340, width: 420, height: 44 });
    expect(result.current.shift.x).toBe(-22);
  });

  it('keeps the caption on screen with the bar', () => {
    // The bar fits, but its caption above it pokes 6 px past the top.
    const { result } = mount({ left: 40, top: 30, width: 300, height: 44 }, 400, {
      left: 150,
      top: -2,
      width: 80,
      height: 18,
    });
    expect(result.current.shift).toEqual({ x: 0, y: 10 });
  });

  it('lets the slide go once the label moves away from the edge', () => {
    const { result, state } = mount({ left: -70, top: 340, width: 300, height: 44 });
    expect(result.current.shift.x).toBe(78);
    state.natural = { left: 40, top: 340, width: 300, height: 44 };
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.shift).toEqual({ x: 0, y: 0 });
  });

  it('measures again on a scroll inside the page', () => {
    const { result, state } = mount({ left: 40, top: 340, width: 300, height: 44 });
    state.natural = { left: 150, top: 340, width: 300, height: 44 };
    act(() => {
      document.body.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.shift.x).toBe(-68);
  });

  it('settles on a whole-px slide when the rect comes back a hair off it', () => {
    // A slid box's rect is off its slide by a few hundred-thousandths of a px, differently on each read: an exact
    // answer would change on every measure and render without end.
    const { result, state } = mount({ left: 186.7344, top: 340, width: 354.53, height: 44 });
    let reads = 0;
    const exact = state.natural;
    Object.defineProperty(state, 'natural', {
      get: () => ({ ...exact, left: exact.left + (reads++ % 2 ? 0.00004 : -0.00003) }),
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.shift).toEqual({ x: -159, y: 0 });
  });

  it('flips below the element near the top of the screen', () => {
    const { result } = mount({ left: 40, top: 400, width: 300, height: 44 }, FLIP_BELOW_TOP - 1);
    expect(result.current.placeBelow).toBe(true);
  });

  it('slides nothing while the toolbar is not laid out', () => {
    const { result } = mount({ left: 0, top: 0, width: 0, height: 0 });
    expect(result.current.shift).toEqual({ x: 0, y: 0 });
  });

  it('measures nothing before the editor or the toolbar is mounted', () => {
    const none = renderHook(() => useLabelToolbarPlacement({ current: null }, { current: null }));
    expect(none.result.current).toEqual({ placeBelow: false, shift: { x: 0, y: 0 } });
    const editor = document.createElement('div');
    editor.getBoundingClientRect = () => domRect({ left: 0, top: 10, width: 50, height: 20 });
    const noBar = renderHook(() =>
      useLabelToolbarPlacement({ current: editor }, { current: null }),
    );
    expect(noBar.result.current).toEqual({ placeBelow: true, shift: { x: 0, y: 0 } });
  });

  it('stops listening once unmounted', () => {
    const { result, state, unmount } = mount({ left: 40, top: 340, width: 300, height: 44 });
    unmount();
    state.natural = { left: -70, top: 340, width: 300, height: 44 };
    window.dispatchEvent(new Event('resize'));
    expect(result.current.shift).toEqual({ x: 0, y: 0 });
  });
});

describe('labelToolbarTransform', () => {
  it('centres and counter-scales the toolbar with no slide', () => {
    expect(labelToolbarTransform({ x: 0, y: 0 }, 1)).toBe(
      'translate(calc(-50% + 0px), 0px) scale(1)',
    );
  });

  it('puts the slide in the editor units, so it is the same screen px at any zoom', () => {
    // At zoom 2 one editor px is two screen px: a 78 px slide is 39 of them.
    expect(labelToolbarTransform({ x: 78, y: -10 }, 2)).toBe(
      'translate(calc(-50% + 39px), -5px) scale(0.5)',
    );
    expect(labelToolbarTransform({ x: 78, y: 0 }, 0.5)).toBe(
      'translate(calc(-50% + 156px), 0px) scale(2)',
    );
  });
});
