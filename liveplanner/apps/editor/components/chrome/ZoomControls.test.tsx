// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZoomControls } from './ZoomControls';

// docs/specs/029-sheets/sheet.md "Zoom": only a Sheet zooms; elsewhere the zoom buttons are hidden.

afterEach(cleanup);

const handlers = () => ({
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onSetZoom: vi.fn(),
  onFitToScreen: vi.fn(),
});

describe('ZoomControls', () => {
  it('zooms while zoom is shown', () => {
    const h = handlers();
    render(<ZoomControls zoom={1} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(h.onZoomIn).toHaveBeenCalled();
    expect(h.onZoomOut).toHaveBeenCalled();
  });

  it('goes entirely when zoom is hidden and there is no Zen to offer', () => {
    const { container } = render(<ZoomControls zoom={1} {...handlers()} zoomHidden />);
    expect(container.querySelector('[data-zoom-controls]')).toBeNull();
  });

  it('keeps only Zen, with no leading divider, when zoom is hidden', () => {
    const { container } = render(
      <ZoomControls zoom={1} {...handlers()} zoomHidden onToggleZen={vi.fn()} zenActive />,
    );
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Exit zen mode',
    ]);
    expect(container.querySelector('div[aria-hidden]')).toBeNull();
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
