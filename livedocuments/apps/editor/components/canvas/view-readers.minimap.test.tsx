// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The Map, drawn from the viewport the canvas shows.
vi.mock('@liveworkspace/workbench/hooks/canvas/useViewportStore', () => ({
  useViewportOf: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
}));
vi.mock('@/components/canvas/Minimap', () => ({ Minimap: () => <div>Map</div> }));
const { ViewMinimap } = await import('./view-readers');

afterEach(cleanup);

describe('ViewMinimap', () => {
  it('shows the Map', () => {
    const props = {} as Parameters<typeof ViewMinimap>[0];
    render(<ViewMinimap {...props} />);
    expect(screen.getByText('Map')).toBeTruthy();
  });
});
