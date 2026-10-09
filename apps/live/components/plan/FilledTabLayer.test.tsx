// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMaximisedPlanId,
  maximisePlanElement,
  releasePlanElement,
} from '@/hooks/plan/maximised-plan';
import { useBoardMaximised } from '@/hooks/plan/useBoardMaximised';
import { setPlanCover } from '@/hooks/plan/plan-cover-store';
import { MaximisableSlot } from './MaximisedPlanLayer';

// docs/specs/026-plan/plan-board.md "Fill Tab" and "Maximised board": a filled or maximised board is drawn over the
// canvas area (not the whole screen), keeps its state; filling ends this person's maximise, and Escape leaves it be.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => {
  releasePlanElement(getMaximisedPlanId() ?? '');
  cleanup();
});

function Counter() {
  const [n, setN] = useState(0);
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      Count {n}
    </button>
  );
}

const onCanvas = vi.fn();

function Canvas({ fill, maximised = false }: { fill: boolean; maximised?: boolean }) {
  return (
    <main
      data-canvas-a11y-root=""
      onPointerDown={onCanvas}
      onWheel={onCanvas}
      onContextMenu={onCanvas}
      onDoubleClick={onCanvas}
    >
      <div data-element-id="el">
        <MaximisableSlot id="el" maximised={maximised} fill={fill} placeholder={{}}>
          <Counter />
        </MaximisableSlot>
      </div>
    </main>
  );
}

describe('a board filling its tab', () => {
  it('moves into a layer over the canvas area, keeping its state, and back', () => {
    const { rerender } = render(<Canvas fill={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Count 0' }));
    rerender(<Canvas fill />);
    const layer = document.querySelector('[data-fill-tab-board]')!;
    expect(layer).toBeTruthy();
    expect(
      layer.closest('[data-canvas-cover]')?.parentElement?.hasAttribute('data-canvas-a11y-root'),
    ).toBe(true);
    expect(layer.contains(screen.getByRole('button', { name: 'Count 1' }))).toBe(true);
    // Presses stop at the layer: the canvas under it never hears them.
    onCanvas.mockClear();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Count 1' }));
    expect(onCanvas).not.toHaveBeenCalled();
    rerender(<Canvas fill={false} />);
    expect(document.querySelector('[data-fill-tab-board]')).toBeNull();
    expect(
      document
        .querySelector('[data-plan-slot="el"]')!
        .contains(screen.getByRole('button', { name: 'Count 1' })),
    ).toBe(true);
  });

  it('ends a maximise on it, and Escape does not restore it', () => {
    act(() => maximisePlanElement('el'));
    const fill = (id: string | null) =>
      act(() => setPlanCover({ fillTabBoardId: id, tabElementCount: 1 }));
    const { result } = renderHook(() => useBoardMaximised('el', true));
    expect(result.current).toEqual({ maximised: true, filled: false });
    fill('el');
    expect(result.current.filled).toBe(true);
    expect(result.current.maximised).toBe(false);
    expect(getMaximisedPlanId()).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(result.current.filled).toBe(true);
    // Another board filling the tab leaves this one as it was.
    fill('other');
    expect(result.current).toEqual({ maximised: false, filled: false });
    fill(null);
  });

  // "Maximised board": maximising also stays inside the canvas area, so the editor's chrome stays around it.
  it('draws a maximised board over the canvas area too, not the whole screen', () => {
    render(<Canvas fill={false} maximised />);
    const layer = document.querySelector('[data-maximised-board]')!;
    expect(
      layer.closest('[data-canvas-cover]')?.parentElement?.hasAttribute('data-canvas-a11y-root'),
    ).toBe(true);
    expect(layer.className).toContain('absolute');
    expect(layer.className).not.toContain('fixed');
  });

  // A press on the cover around the board (its margins under the chrome) never reaches the canvas under it.
  it('takes presses, wheel and right-clicks on the margins around it', () => {
    render(<Canvas fill={false} maximised />);
    const cover = document.querySelector('[data-canvas-cover]') as HTMLElement;
    expect(cover.className).toContain('inset-0');
    onCanvas.mockClear();
    fireEvent.pointerDown(cover);
    fireEvent.wheel(cover);
    fireEvent.contextMenu(cover);
    fireEvent.doubleClick(cover);
    expect(onCanvas).not.toHaveBeenCalled();
  });
});
