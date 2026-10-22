// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCanvasSelectHandlers } from './useCanvasSelectHandlers';

// docs/specs/008-canvas/canvas-and-palette.md "Selection" and "Marquee box-select": the click rules,
// settled at canvas level for boxed elements (handleElementClick) and applied to arrows
// (handleArrowSelect).

function harness(selectedId: string | null, multi: string[] = [], isPaintMode = false) {
  const onSelect = vi.fn();
  const onDeselect = vi.fn();
  const onShiftSelect = vi.fn();
  const view = renderHook(() =>
    useCanvasSelectHandlers({
      inertIds: new Set(['inert']),
      isPaintMode,
      readSelection: () => ({ selectedId, multiSelectedIds: new Set(multi) }),
      onSelect,
      onDeselect,
      onShiftSelect,
    }),
  );
  return { h: view.result.current, onSelect, onDeselect, onShiftSelect };
}

const pointer = (over: Record<string, unknown> = {}) =>
  ({
    button: 0,
    shiftKey: false,
    clientX: 10,
    clientY: 10,
    timeStamp: 1000,
    pointerId: 1,
    pointerType: 'mouse',
    ...over,
  }) as unknown as ReactPointerEvent;

function releaseAt(x: number) {
  act(() => {
    const e = new Event('pointerup');
    Object.assign(e, { clientX: x, clientY: 10, pointerId: 1, pointerType: 'mouse' });
    Object.defineProperty(e, 'timeStamp', { value: 1100 });
    window.dispatchEvent(e);
  });
}

afterEach(() => {
  cleanup();
});

describe('handleElementClick', () => {
  it('deselects the only selected element', () => {
    const t = harness('a');
    t.h.handleElementClick('a');
    expect(t.onDeselect).toHaveBeenCalledTimes(1);
    expect(t.onSelect).not.toHaveBeenCalled();
  });

  it('deselects the one member of a multi-selection of one', () => {
    const t = harness(null, ['a']);
    t.h.handleElementClick('a');
    expect(t.onDeselect).toHaveBeenCalledTimes(1);
  });

  it('selects a member of a multi-selection alone', () => {
    const t = harness('a', ['a', 'b']);
    t.h.handleElementClick('b');
    expect(t.onSelect).toHaveBeenCalledWith('b');
    expect(t.onDeselect).not.toHaveBeenCalled();
  });

  it('selects an unselected element (the second press of a double-click)', () => {
    const t = harness(null);
    t.h.handleElementClick('a');
    expect(t.onSelect).toHaveBeenCalledWith('a');
  });

  it('ignores an element on a hidden or locked layer', () => {
    const t = harness('inert');
    t.h.handleElementClick('inert');
    expect(t.onDeselect).not.toHaveBeenCalled();
    expect(t.onSelect).not.toHaveBeenCalled();
  });
});

describe('handleArrowSelect', () => {
  it('selects an arrow outside a multi-selection alone, never adding it', () => {
    const t = harness(null, ['a', 'b']);
    t.h.handleArrowSelect('arrow', pointer());
    expect(t.onSelect).toHaveBeenCalledWith('arrow');
    expect(t.onShiftSelect).not.toHaveBeenCalled();
  });

  it('selects a member arrow alone', () => {
    const t = harness(null, ['arrow', 'b']);
    t.h.handleArrowSelect('arrow', pointer());
    expect(t.onSelect).toHaveBeenCalledWith('arrow');
  });

  it('keeps Shift-click toggling', () => {
    const t = harness(null, ['a', 'b']);
    t.h.handleArrowSelect('arrow', pointer({ shiftKey: true }));
    expect(t.onShiftSelect).toHaveBeenCalledWith('arrow');
    expect(t.onSelect).not.toHaveBeenCalled();
  });

  it('deselects the only selected arrow on a release in place', () => {
    const t = harness('arrow');
    t.h.handleArrowSelect('arrow', pointer());
    expect(t.onSelect).not.toHaveBeenCalled();
    releaseAt(10);
    expect(t.onDeselect).toHaveBeenCalledTimes(1);
  });

  it('keeps the only selected arrow selected when the press bends it', () => {
    const t = harness('arrow');
    t.h.handleArrowSelect('arrow', pointer());
    releaseAt(60);
    expect(t.onDeselect).not.toHaveBeenCalled();
  });

  it('hands a press on the only selected arrow to the format painter while it is armed', () => {
    const t = harness('arrow', [], true);
    t.h.handleArrowSelect('arrow', pointer());
    expect(t.onSelect).toHaveBeenCalledWith('arrow');
    releaseAt(10);
    expect(t.onDeselect).not.toHaveBeenCalled();
  });

  it('selects on the second press of a double-click, whatever the selection', () => {
    const t = harness('arrow');
    t.h.handleArrowSelect('arrow', pointer(), true);
    releaseAt(10);
    expect(t.onSelect).toHaveBeenCalledWith('arrow');
    expect(t.onDeselect).not.toHaveBeenCalled();
  });
});

describe('useCanvasSelectHandlers reading the selection', () => {
  it('reads the selection when a click runs, not when the hook last rendered', () => {
    const onSelect = vi.fn();
    const onDeselect = vi.fn();
    let current = { selectedId: null as string | null, multiSelectedIds: new Set<string>() };
    const { result } = renderHook(() =>
      useCanvasSelectHandlers({
        inertIds: new Set<string>(),
        isPaintMode: false,
        readSelection: () => current,
        onSelect,
        onDeselect,
        onShiftSelect: vi.fn(),
      }),
    );

    current = { selectedId: 'a', multiSelectedIds: new Set() };
    act(() => result.current.handleElementClick('a'));

    expect(onDeselect).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
