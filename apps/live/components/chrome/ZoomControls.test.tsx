// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZOOM_OFF_REASON, ZoomControls } from './ZoomControls';

// docs/specs/026-plan/plan-board.md "Maximised board", "Zoom stands down": the controls stay, disabled, saying why.

afterEach(cleanup);

const handlers = () => ({
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onSetZoom: vi.fn(),
  onFitToScreen: vi.fn(),
});

describe('ZoomControls', () => {
  it('zooms while nothing covers the canvas', () => {
    const h = handlers();
    render(<ZoomControls zoom={1} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(h.onZoomIn).toHaveBeenCalled();
    expect(h.onZoomOut).toHaveBeenCalled();
  });

  it('stays in place, disabled, while a Plan element covers the canvas', () => {
    const h = handlers();
    render(<ZoomControls zoom={0.94} {...h} zoomOff />);
    const buttons = screen.getAllByRole('button');
    // Zoom out, the level, Zoom in and a phone's Fit: all there, all off.
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Zoom out',
      'Fit to screen',
      'Zoom in',
      'Fit to screen',
    ]);
    for (const b of buttons) expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('94%')).toBeTruthy();
    for (const b of buttons) fireEvent.click(b);
    expect(h.onZoomIn).not.toHaveBeenCalled();
    expect(h.onFitToScreen).not.toHaveBeenCalled();
    expect(ZOOM_OFF_REASON).toMatch(/^Zoom is off while/);
  });
});
