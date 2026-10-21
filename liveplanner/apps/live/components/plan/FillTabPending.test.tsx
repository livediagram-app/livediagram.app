// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPlanCover } from '@/hooks/plan/plan-cover-store';
import { FillTabElementContext, FillTabPending } from './FillTabPending';

// docs/specs/026-plan/plan-board.md "Fill Tab": while a tab-filling element's view loads, the canvas area is already
// covered, so the element is never seen drawn small on the canvas first.
afterEach(() => {
  act(() => setPlanCover({ fillTabId: null, fillTabKind: null, planKind: null }));
  cleanup();
});

const onCanvas = vi.fn();

function show(id: string | null) {
  return render(
    <main data-canvas-a11y-root="" onPointerDown={onCanvas}>
      <FillTabElementContext.Provider value={id}>
        <FillTabPending />
      </FillTabElementContext.Provider>
    </main>,
  );
}

describe('the loading cover of a tab-filling view', () => {
  it('covers the canvas area while the element fills its tab, taking its presses', () => {
    act(() => setPlanCover({ fillTabId: 's1', fillTabKind: 'Sheet', planKind: 'sheet' }));
    const { container } = show('s1');
    const cover = container.querySelector<HTMLElement>('[data-fill-tab-pending]');
    expect(cover?.parentElement?.hasAttribute('data-canvas-a11y-root')).toBe(true);
    expect(cover?.hasAttribute('data-canvas-cover')).toBe(true);
    fireEvent.pointerDown(cover!);
    expect(onCanvas).not.toHaveBeenCalled();
  });

  it('draws nothing for an element on the canvas, or outside a coverable view', () => {
    act(() => setPlanCover({ fillTabId: 'other', fillTabKind: 'Sheet', planKind: 'sheet' }));
    expect(show('s1').container.querySelector('[data-fill-tab-pending]')).toBeNull();
    cleanup();
    expect(show(null).container.querySelector('[data-fill-tab-pending]')).toBeNull();
  });
});
