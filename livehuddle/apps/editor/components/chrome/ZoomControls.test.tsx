// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZoomControls } from './ZoomControls';

afterEach(cleanup);

const handlers = () => ({
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onSetZoom: vi.fn(),
  onFitToScreen: vi.fn(),
});

describe('ZoomControls', () => {
  it('zooms in and out', () => {
    const h = handlers();
    render(<ZoomControls zoom={1} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(h.onZoomIn).toHaveBeenCalled();
    expect(h.onZoomOut).toHaveBeenCalled();
  });

  it('keeps Fit on a phone, where pinch zooms', () => {
    render(<ZoomControls zoom={1} {...handlers()} pinchOnly />);
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Fit to screen' }).length).toBeGreaterThan(0);
  });
});

describe('ZoomControls presets', () => {
  it('offers every preset level', () => {
    render(<ZoomControls zoom={1} {...handlers()} />);
    fireEvent.keyDown(
      screen
        .getAllByRole('button', { name: 'Fit to screen' })
        .find((b) => b.getAttribute('aria-haspopup') === 'menu')!,
      { key: 'ArrowDown' },
    );
    expect(
      screen.getAllByRole('menuitemradio').map((b) => b.textContent?.replace(/\D/g, '')),
    ).toEqual(['25', '50', '75', '100', '125', '150']);
  });
});
