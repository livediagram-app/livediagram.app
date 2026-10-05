// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/document';
import { createSelectionStore } from '@/lib/selection-store';

// docs/specs/004-interface-design/canvas-accessibility.md: a screen reader hears each selection change.
// The hook follows the store, so the editor root does not render for it
// (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas").

const { announce } = vi.hoisted(() => ({ announce: vi.fn() }));
vi.mock('@/lib/announcer', () => ({ announce }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const { useCanvasA11y } = await import('./useCanvasA11y');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
});
afterEach(() => vi.useRealTimers());

const a = { ...createShape('square', 0, 0), label: 'Login' };
const b = { ...createShape('square', 200, 0), label: 'Home' };

function setup(elements = [a, b]) {
  announce.mockClear();
  const selection = createSelectionStore();
  const view = renderHook(
    ({ els }) =>
      useCanvasA11y({
        enabled: true,
        elements: els,
        selection,
        editingId: null,
        selectElement: vi.fn(),
        lockedByOther: () => false,
        layerInertIds: new Set<string>(),
        scrollIntoView: () => {},
        ownsTabKey: () => false,
      }),
    { initialProps: { els: elements } },
  );
  return Object.assign(selection, { view });
}

describe('useCanvasA11y announcements', () => {
  it('announces an element that is created and selected in the same event', () => {
    const selection = setup();
    const c = { ...createShape('square', 400, 0), label: 'Checkout' };
    act(() => {
      selection.setSelectedId(c.id);
      selection.view.rerender({ els: [a, b, c] });
    });
    act(() => vi.runAllTimers());
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Selected .*Checkout/));
  });

  it('announces a single selection, a multi-selection and a clear', () => {
    const selection = setup();
    const frame = () => act(() => vi.runAllTimers());
    act(() => selection.setSelectedId(a.id));
    frame();
    act(() =>
      selection.setSelection({ selectedId: null, multiSelectedIds: new Set([a.id, b.id]) }),
    );
    frame();
    act(() => selection.setSelection({ selectedId: null, multiSelectedIds: new Set() }));
    frame();

    expect(announce.mock.calls.map(([m]) => m)).toEqual([
      expect.stringMatching(/^Selected .*Login/),
      expect.stringMatching(/^Selected /),
      'Selection cleared',
    ]);
  });

  it('speaks a burst of changes within one frame once, as it ended', () => {
    const selection = setup();
    act(() => {
      selection.setSelectedId(a.id);
      selection.setSelectedId(b.id);
    });
    act(() => vi.runAllTimers());
    expect(announce.mock.calls.map(([m]) => m)).toEqual([expect.stringMatching(/Home/)]);
  });

  it('does not re-announce the same multi-selection in another order', () => {
    const selection = setup();
    act(() => selection.setMultiSelectedIds(new Set([a.id, b.id])));
    act(() => vi.runAllTimers());
    act(() => selection.setMultiSelectedIds(new Set([b.id, a.id, b.id])));
    act(() => vi.runAllTimers());
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('says nothing on mount with nothing selected', () => {
    setup();
    expect(announce).not.toHaveBeenCalled();
  });
});
