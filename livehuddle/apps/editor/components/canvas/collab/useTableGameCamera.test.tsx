// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { GAME_CAMERA_RESTORE_MS, useTableGameCamera } from './useTableGameCamera';

// docs/specs/009-elements/social-pieces.md "On a small screen" (Work Item 620): sitting down to play on a small screen
// brings the table close, and standing up puts the view back unless you zoomed meanwhile. Reduced motion lands at
// once, so the view is checked without waiting on frames.

vi.mock('@liveworkspace/workbench/lib/motion-preference', async (load) => ({
  ...(await load<object>()),
  prefersReducedMotion: () => true,
}));

const table = { ...createShape('ping-pong-table', 100, 200), id: 'pp' } as ShapeElement;

function Face({ element, playing }: { element: ShapeElement; playing: boolean }) {
  useTableGameCamera(element, playing);
  return <div data-element-id={element.id} />;
}

function mount(width: number, zoom = 0.5) {
  const store = createViewportStore(zoom);
  const main = document.createElement('main');
  Object.defineProperty(main, 'clientWidth', { value: width });
  Object.defineProperty(main, 'clientHeight', { value: 700 });
  document.body.append(main);
  const draw = (playing: boolean) => (
    <ViewportStoreProvider store={store}>
      <Face element={table} playing={playing} />
    </ViewportStoreProvider>
  );
  const view = render(draw(false), { container: main });
  return {
    store,
    sit: () => view.rerender(draw(true)),
    stand: () => view.rerender(draw(false)),
    view,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useTableGameCamera', () => {
  it('glides in on a phone when you sit down to play, and back when you stand', () => {
    const { store, sit, stand } = mount(390);
    sit();
    expect(store.get().zoom).toBeCloseTo((390 * 0.6) / table.width);
    expect(store.get().offset).toEqual({
      x: 195 - (table.x + table.width / 2),
      y: 350 - (table.y + table.height / 2),
    });
    stand();
    act(() => {
      vi.advanceTimersByTime(GAME_CAMERA_RESTORE_MS);
    });
    expect(store.get()).toEqual({ zoom: 0.5, offset: { x: 0, y: 0 } });
  });

  it('keeps a zoom you chose while sitting', () => {
    const { store, sit, stand } = mount(390);
    sit();
    act(() => {
      store.setZoom(3);
    });
    stand();
    act(() => {
      vi.advanceTimersByTime(GAME_CAMERA_RESTORE_MS);
    });
    expect(store.get().zoom).toBe(3);
  });

  it('puts the first view back when you sit again before the restore runs', () => {
    const { store, sit, stand } = mount(390);
    sit();
    stand();
    sit();
    act(() => {
      vi.advanceTimersByTime(GAME_CAMERA_RESTORE_MS);
    });
    // Still close while sitting.
    expect(store.get().zoom).toBeGreaterThan(1);
    stand();
    act(() => {
      vi.advanceTimersByTime(GAME_CAMERA_RESTORE_MS);
    });
    expect(store.get()).toEqual({ zoom: 0.5, offset: { x: 0, y: 0 } });
  });

  it('puts the view back when the game piece goes', () => {
    const { store, sit, view } = mount(390);
    sit();
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(GAME_CAMERA_RESTORE_MS);
    });
    expect(store.get().zoom).toBe(0.5);
  });

  it('leaves a wide screen, or a table that already reads, as it is', () => {
    const wide = mount(1280);
    wide.sit();
    expect(wide.store.get().zoom).toBe(0.5);
    document.body.innerHTML = '';
    const close = mount(390, 1);
    close.sit();
    close.stand();
    act(() => {
      vi.advanceTimersByTime(GAME_CAMERA_RESTORE_MS);
    });
    expect(close.store.get()).toEqual({ zoom: 1, offset: { x: 0, y: 0 } });
  });

  it('runs nothing without a viewport (a preview) or a canvas', () => {
    expect(() => render(<Face element={table} playing />)).not.toThrow();
    const store = createViewportStore(0.5);
    render(
      <ViewportStoreProvider store={store}>
        <Face element={table} playing />
      </ViewportStoreProvider>,
    );
    expect(store.get().zoom).toBe(0.5);
  });
});
