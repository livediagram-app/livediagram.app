// @vitest-environment jsdom

// The Map's current-view window (docs/specs/008-canvas/minimap.md): the lit rectangle showing where the
// canvas is looking. It regressed once when the map measured <main> itself: rendered inside <main>, its
// layout effect ran before <main>'s ref attached, so opening a document left it unmeasured and the window
// vanished. The size now comes in from the Canvas; these pin that the window draws from it.

import { act, cleanup, render } from '@testing-library/react';
import { beginCanvasGesture, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/document';
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

// docs/specs/008-canvas/canvas-performance.md: the Map keeps its drawing through a move and redraws
// when it ends, rather than rebuilding the whole board's markup on every frame.
describe('Minimap during a move', () => {
  afterEach(() => resetCanvasGesturesForTests());

  const props = (els: typeof elements) => ({
    elements: els,
    viewportOffset: { x: 0, y: 0 },
    viewportZoom: 1,
    setViewportOffset: vi.fn(),
    setViewportZoom: vi.fn(),
    mainSize: { width: 800, height: 600 },
    paperColor: '#ffffff',
    accentColor: ACCENT,
    position: null,
    onMove: vi.fn(),
    onResetPosition: vi.fn(),
    dimOutside: true,
    size: 'medium' as const,
  });
  const drawing = (container: HTMLElement) =>
    container.querySelector('svg[role="img"] > image')?.getAttribute('href') ?? '';

  it('holds its drawing while the selection moves and redraws on release', () => {
    const { container, rerender } = render(<Minimap {...props(elements)} />);
    const before = drawing(container);
    let end = () => {};
    act(() => {
      end = beginCanvasGesture('move');
    });
    const moved = elements.map((el, i) => (i === 0 ? { ...el, x: el.x + 900 } : el));
    rerender(<Minimap {...props(moved)} />);
    expect(drawing(container)).toBe(before);
    act(() => end());
    expect(drawing(container)).not.toBe(before);
  });
});

// docs/specs/008-canvas/minimap.md "What it shows": the drawing is one image, not a copy of the board
// in the page (docs/specs/008-canvas/canvas-performance.md "The Map is one image").
describe('Minimap drawing', () => {
  it('is one image, with none of the board in the page', () => {
    const { container } = mount({ width: 800, height: 600 });
    const map = container.querySelector('svg[role="img"]')!;
    expect(map.querySelectorAll('image')).toHaveLength(1);
    // The window overlay is all the map's own markup: no element's shape is in the page.
    expect(map.querySelectorAll('rect').length).toBeLessThanOrEqual(1);
    expect(map.querySelectorAll('g')).toHaveLength(0);
  });

  it('is a standalone picture of the board', () => {
    const { container } = mount({ width: 800, height: 600 });
    const href = container.querySelector('svg[role="img"] > image')!.getAttribute('href')!;
    expect(href.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const doc = decodeURIComponent(href.slice(href.indexOf(',') + 1));
    expect(doc.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    // All four squares, drawn by the headless renderer.
    expect(doc.match(/<rect /g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
