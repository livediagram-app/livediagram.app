// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  createFreehand,
  createSticky,
  createTable,
  createText,
  type BoxedElement,
} from '@livediagram/document';
import { useBoxedElementGestures } from './useBoxedElementGestures';

// docs/specs/008-canvas/canvas-and-palette.md "Selection" (click the selected element again) and
// "Marquee box-select" (only Shift adds; a plain click on a member selects it alone).

type State = {
  isSelected: boolean;
  isMultiSelected: boolean;
  isPaintMode?: boolean;
};

// Each case gets its own clock, far from the others, so the shared press
// ledger never pairs presses across tests.
let clock = 1_000_000;

function harness(element: BoxedElement, initial: State) {
  const onBeginDrag = vi.fn();
  const onShiftSelect = vi.fn();
  const onPlainClick = vi.fn();
  const onBeginEdit = vi.fn();
  let state = initial;
  const view = renderHook(() =>
    useBoxedElementGestures({
      element,
      wrapperRef: { current: null },
      isEditing: false,
      remotelyLocked: false,
      isAnnotation: false,
      isPaintMode: false,
      ...state,
      onBeginDrag,
      onBeginEdit,
      onShiftSelect,
      onPlainClick,
    } as never),
  );
  clock += 100_000;
  const press = (over: { dt?: number; shiftKey?: boolean } = {}) =>
    act(() =>
      view.result.current.handleShapeDown({
        button: 0,
        timeStamp: clock + (over.dt ?? 0),
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        pointerType: 'mouse',
        shiftKey: over.shiftKey === true,
        stopPropagation: () => {},
      } as unknown as ReactPointerEvent),
    );
  const release = (over: { dt?: number; x?: number } = {}) =>
    act(() => {
      const e = new Event('pointerup');
      Object.assign(e, { clientX: over.x ?? 10, clientY: 10, pointerId: 1, pointerType: 'mouse' });
      Object.defineProperty(e, 'timeStamp', { value: clock + (over.dt ?? 50) });
      window.dispatchEvent(e);
    });
  const set = (next: State) => {
    state = next;
    view.rerender();
  };
  return { press, release, set, onBeginDrag, onShiftSelect, onPlainClick, onBeginEdit };
}

const SOLE: State = { isSelected: true, isMultiSelected: false };
const NONE: State = { isSelected: false, isMultiSelected: false };
const MEMBER: State = { isSelected: true, isMultiSelected: true };
const OUTSIDER: State = { isSelected: false, isMultiSelected: false };

const KINDS: [string, () => BoxedElement][] = [
  ['sticky', () => createSticky(0, 0)],
  ['text', () => createText(0, 0)],
  [
    'marker stroke',
    () =>
      createFreehand(
        [
          { x: 0, y: 0 },
          { x: 40, y: 20 },
        ],
        false,
      ),
  ],
];

afterEach(() => {
  cleanup();
});

describe.each(KINDS)('a plain press on a %s', (_name, make) => {
  it('selects a non-member of a multi-selection alone and never adds it', () => {
    const h = harness(make(), OUTSIDER);
    h.press();
    expect(h.onShiftSelect).not.toHaveBeenCalled();
    expect(h.onBeginDrag).toHaveBeenCalledTimes(1);
    h.release();
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });

  it('clicks a member: the drag starts for the whole set, the release settles the click', () => {
    const h = harness(make(), MEMBER);
    h.press();
    expect(h.onBeginDrag).toHaveBeenCalledTimes(1);
    h.release();
    expect(h.onPlainClick).toHaveBeenCalledTimes(1);
  });

  it('does not settle a click when the press on a member dragged', () => {
    const h = harness(make(), MEMBER);
    h.press();
    h.release({ x: 60 });
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });

  it('clicks the only selected element: the release settles the click', () => {
    const h = harness(make(), SOLE);
    h.press();
    expect(h.onBeginDrag).toHaveBeenCalledTimes(1);
    h.release();
    expect(h.onPlainClick).toHaveBeenCalledTimes(1);
  });

  it('does not settle a click when the only selected element was dragged', () => {
    const h = harness(make(), SOLE);
    h.press();
    h.release({ x: 60 });
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });

  it('selects an unselected element on the press and leaves the release alone', () => {
    const h = harness(make(), NONE);
    h.press();
    expect(h.onBeginDrag).toHaveBeenCalledTimes(1);
    h.release();
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });

  it('keeps Shift-click toggling an unselected element at once', () => {
    const h = harness(make(), OUTSIDER);
    h.press({ shiftKey: true });
    expect(h.onShiftSelect).toHaveBeenCalledTimes(1);
    expect(h.onBeginDrag).not.toHaveBeenCalled();
    h.release();
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });

  it('keeps Shift-click toggling a member on release, without a plain click', () => {
    const h = harness(make(), MEMBER);
    h.press({ shiftKey: true });
    h.release();
    expect(h.onShiftSelect).toHaveBeenCalledTimes(1);
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });

  it('never settles a click while the format painter is armed', () => {
    const h = harness(make(), { ...SOLE, isPaintMode: true });
    h.press();
    h.release();
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });
});

describe('a plain click inside the only selected table', () => {
  it('is a cell pick, so it leaves the table selected', () => {
    const h = harness(createTable(0, 0), SOLE);
    h.press();
    h.release();
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });
});

describe('a double-click on the only selected element', () => {
  it('deselects on the first click and selects again on the second, without a drag', () => {
    const h = harness(createSticky(0, 0), SOLE);
    h.press();
    h.release();
    expect(h.onPlainClick).toHaveBeenCalledTimes(1);
    // The host deselected it.
    h.set(NONE);
    h.press({ dt: 200 });
    expect(h.onPlainClick).toHaveBeenCalledTimes(2);
    expect(h.onBeginDrag).toHaveBeenCalledTimes(1);
    h.release({ dt: 250 });
    expect(h.onPlainClick).toHaveBeenCalledTimes(2);
  });
});

describe('a double-click on an unselected element', () => {
  it('selects on the first press and leaves the second to the editor', () => {
    const h = harness(createSticky(0, 0), NONE);
    h.press();
    h.release();
    h.set(SOLE);
    h.press({ dt: 200 });
    h.release({ dt: 250 });
    expect(h.onPlainClick).not.toHaveBeenCalled();
    expect(h.onBeginDrag).toHaveBeenCalledTimes(1);
  });
});
