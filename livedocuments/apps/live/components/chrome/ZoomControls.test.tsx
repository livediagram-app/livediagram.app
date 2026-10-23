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
  it('zooms the canvas', () => {
    const h = handlers();
    render(<ZoomControls zoom={1} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(h.onZoomIn).toHaveBeenCalled();
    expect(h.onZoomOut).toHaveBeenCalled();
  });
});

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
});
