// @vitest-environment jsdom

// The Map's current-view window (docs/specs/008-canvas/minimap.md): the lit rectangle showing where the
// canvas is looking. It regressed once when the map measured <main> itself: rendered inside <main>, its
// layout effect ran before <main>'s ref attached, so opening a diagram left it unmeasured and the window
// vanished. The size now comes in from the Canvas; these pin that the window draws from it.

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/diagram';
import { Minimap } from './Minimap';

afterEach(cleanup);
// The panel chrome observes its own size; jsdom has no ResizeObserver.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const ACCENT = '#123456';
const elements = [
  createShape('square', 0, 0),
  createShape('square', 400, 0),
  createShape('square', 0, 300),
  createShape('square', 400, 300),
];

function mount(mainSize: { width: number; height: number }) {
  return render(
    <Minimap
      elements={elements}
      viewportOffset={{ x: 0, y: 0 }}
      viewportZoom={1}
      setViewportOffset={vi.fn()}
      setViewportZoom={vi.fn()}
      mainSize={mainSize}
      paperColor="#ffffff"
      accentColor={ACCENT}
      position={null}
      onMove={vi.fn()}
      onResetPosition={vi.fn()}
      dimOutside
      size="medium"
    />,
  );
}

const viewWindow = (container: HTMLElement) =>
  container.querySelector(`svg[role="img"] > rect[stroke="${ACCENT}"]`);

describe('Minimap current-view window', () => {
  it('draws the window from the canvas size it is given on first render', () => {
    const { container } = mount({ width: 800, height: 600 });
    expect(viewWindow(container)).not.toBeNull();
  });

  it('draws no window before the canvas has been measured', () => {
    const { container } = mount({ width: 0, height: 0 });
    expect(viewWindow(container)).toBeNull();
  });
});
