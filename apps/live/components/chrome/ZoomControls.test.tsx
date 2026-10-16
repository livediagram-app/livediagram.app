// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZOOM_OFF_REASON, ZoomControls } from './ZoomControls';

const touch = vi.hoisted(() => ({ coarse: false }));
vi.mock('@/hooks/ui/useCoarsePointer', () => ({ useCoarsePointer: () => touch.coarse }));

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

  // docs/specs/026-plan/plan-tabs.md "On a phone": with pinch zoom and zoom off, nothing is left to offer.
  it('goes on a touch screen while zoom is off, and stays while it is on', () => {
    const h = handlers();
    const { container, rerender } = render(<ZoomControls zoom={1} {...h} pinchOnly zoomOff />);
    expect(container.querySelector('[data-zoom-controls]')).toBeNull();
    rerender(<ZoomControls zoom={1} {...h} pinchOnly />);
    expect(screen.getAllByRole('button', { name: 'Fit to screen' }).length).toBeGreaterThan(0);
  });

  // A tablet is a touch screen too: wide, so the zoom buttons show, but with zoom off it has nothing to offer either.
  it('goes on a tablet while zoom is off, and stays under a mouse', () => {
    const h = handlers();
    touch.coarse = true;
    const { container, rerender } = render(<ZoomControls zoom={1} {...h} zoomOff />);
    expect(container.querySelector('[data-zoom-controls]')).toBeNull();
    rerender(<ZoomControls zoom={1} {...h} />);
    expect(container.querySelector('[data-zoom-controls]')).not.toBeNull();
    touch.coarse = false;
    rerender(<ZoomControls zoom={1} {...h} zoomOff />);
    expect(container.querySelector('[data-zoom-controls]')).not.toBeNull();
  });
});

// docs/specs/029-sheets/sheet.md "Zoom": a Sheet zooms 50% to 200%, so its presets stop at 50%.
describe('ZoomControls presets', () => {
  const levels = () =>
    screen.getAllByRole('menuitemradio').map((b) => b.textContent?.replace(/\D/g, ''));
  const openPresets = () =>
    fireEvent.keyDown(
      screen
        .getAllByRole('button', { name: 'Fit to screen' })
        .find((b) => b.getAttribute('aria-haspopup') === 'menu')!,
      { key: 'ArrowDown' },
    );

  it('offers every preset on the canvas', () => {
    render(<ZoomControls zoom={1} {...handlers()} />);
    openPresets();
    expect(levels()).toEqual(['25', '50', '75', '100', '125', '150']);
  });

  it('offers only the levels a Sheet can reach', () => {
    render(
      <ZoomControls zoom={1} {...handlers()} zoomScope="sheet" zoomRange={{ min: 0.5, max: 2 }} />,
    );
    openPresets();
    expect(levels()).toEqual(['50', '75', '100', '125', '150']);
  });
});
