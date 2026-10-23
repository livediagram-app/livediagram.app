// @vitest-environment jsdom
// The corner zoom controls zoom the canvas.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewZoomControls } from './view-readers';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/canvas/useViewportStore', () => ({ useViewportOf: () => 0.8 }));

afterEach(() => {
  cleanup();
});

const handlers = () => ({
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onSetZoom: vi.fn(),
  onFitToScreen: vi.fn(),
});

describe('ViewZoomControls', () => {
  it('zooms the canvas', () => {
    const h = handlers();
    render(<ViewZoomControls {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(h.onZoomIn).toHaveBeenCalled();
  });
});
