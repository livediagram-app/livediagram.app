// @vitest-environment jsdom
// docs/specs/029-sheets/sheet.md "Zoom": while a Sheet covers the canvas the corner zoom controls zoom its cells, Fit
// back to 100%; on any other tab there are no zoom buttons.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewZoomControls } from './view-readers';
import { setPlanCover } from '@/hooks/plan/plan-cover-store';
import { getSheetZoom, setSheetZoom } from '@/hooks/sheets/sheet-zoom';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/hooks/canvas/useViewportStore', () => ({
  useViewportOf: () => 0.8,
}));

afterEach(() => {
  cleanup();
  act(() => setPlanCover({ fillTabId: null, fillTabKind: null }));
  setSheetZoom(1);
});

const handlers = () => ({
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onSetZoom: vi.fn(),
  onFitToScreen: vi.fn(),
});

describe('ViewZoomControls', () => {
  it('shows no zoom buttons off a Sheet', () => {
    render(<ViewZoomControls {...handlers()} />);
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
    act(() => setPlanCover({ fillTabId: 'b', fillTabKind: 'Board' }));
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
  });

  it('zooms a covering Sheet’s cells instead, Fit putting it back to 100%', () => {
    const h = handlers();
    act(() => setPlanCover({ fillTabId: 's', fillTabKind: 'Sheet' }));
    render(<ViewZoomControls {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(getSheetZoom()).toBe(1.2);
    expect(h.onZoomIn).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Zoom in' })).not.toHaveProperty('disabled', true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fit to screen' })[0]!);
    expect(getSheetZoom()).toBe(1);
  });

  it('goes back to 100% once no Sheet covers the canvas', () => {
    act(() => setPlanCover({ fillTabId: 's', fillTabKind: 'Sheet' }));
    render(<ViewZoomControls {...handlers()} />);
    act(() => setSheetZoom(1.5));
    act(() => setPlanCover({ fillTabId: 'b', fillTabKind: 'Board' }));
    expect(getSheetZoom()).toBe(1);
    // A board covering it: no zoom buttons.
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
  });
});
