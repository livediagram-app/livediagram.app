// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { memo, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CanvasZoomProvider,
  CounterScaled,
  useCanvasZoom,
  useCanvasZoomSelector,
  useSettledZoomSelector,
  ZOOM_SETTLE_MS,
  ZoomFollowing,
} from './CanvasZoomContext';

// docs/specs/008-canvas/canvas-performance.md: a counter-scaled part keeps its size on screen, and it
// alone reads the zoom, so the element around it does not render for a zoom.

describe('CounterScaled', () => {
  it('scales its content by the inverse of the zoom, keeping its own props', () => {
    const { container } = render(
      <CanvasZoomProvider zoom={2}>
        <CounterScaled className="pill" data-x="1">
          hi
        </CounterScaled>
      </CanvasZoomProvider>,
    );
    const div = container.querySelector('div.pill') as HTMLDivElement;
    expect(div.style.transform).toBe('scale(0.5)');
    expect(div.dataset.x).toBe('1');
    expect(div.textContent).toBe('hi');
  });
});

describe('following the zoom', () => {
  afterEach(() => vi.useRealTimers());

  it('re-scales a counter-scaled part on every zoom step, and reads 1 outside a provider', () => {
    const { container, rerender } = render(
      <CanvasZoomProvider zoom={2}>
        <CounterScaled className="pill" />
      </CanvasZoomProvider>,
    );
    rerender(
      <CanvasZoomProvider zoom={4}>
        <CounterScaled className="pill" />
      </CanvasZoomProvider>,
    );
    expect((container.querySelector('.pill') as HTMLElement).style.transform).toBe('scale(0.25)');
    const Probe = () => <b data-zoom={useCanvasZoom()} />;
    const outside = render(<Probe />);
    expect(outside.container.querySelector('b')!.dataset.zoom).toBe('1');
  });

  // Work Tracker 904: the zoom's readers are told by the store, so a zoom step renders them and nothing between them
  // and the provider, and React searches no subtree for them.
  it('renders a zoom reader on every step and nothing between it and the provider', () => {
    let between = 0;
    const Reader = () => <b data-zoom={useCanvasZoom()} />;
    const Between = memo(function Between() {
      useEffect(() => {
        between += 1;
      });
      return <Reader />;
    });
    const tree = <Between />;
    const at = (zoom: number) => <CanvasZoomProvider zoom={zoom}>{tree}</CanvasZoomProvider>;
    const { container, rerender } = render(at(1));
    const before = between;
    for (const zoom of [1.5, 2, 3]) {
      rerender(at(zoom));
      expect(container.querySelector('b')!.dataset.zoom).toBe(String(zoom));
    }
    expect(between).toBe(before);
  });

  it('renders a selector’s part only when its answer changes', () => {
    let renders = 0;
    const Dot = () => {
      useEffect(() => {
        renders += 1;
      });
      const small = useCanvasZoomSelector((zoom) => zoom < 0.5);
      return <i data-small={small} />;
    };
    // The same element each step, as the canvas's memoised layer is: only the zoom changes.
    const dot = <Dot />;
    const at = (zoom: number) => <CanvasZoomProvider zoom={zoom}>{dot}</CanvasZoomProvider>;
    const { container, rerender } = render(at(0.4));
    expect(container.querySelector('i')!.dataset.small).toBe('true');
    const before = renders;
    for (const zoom of [0.3, 0.2, 0.1]) rerender(at(zoom));
    expect(renders).toBe(before);
    rerender(at(0.9));
    expect(container.querySelector('i')!.dataset.small).toBe('false');
  });

  // Work Tracker 885: the parts a board carries by the thousand change shape when the zoom stops, so a zoom step asks
  // none of them.
  it('asks a settled selector only once the zoom stands still, and reads 1 outside a provider', () => {
    vi.useFakeTimers();
    const asked: number[] = [];
    const Dot = () => {
      const small = useSettledZoomSelector((zoom) => {
        asked.push(zoom);
        return zoom < 0.5;
      });
      return <i data-small={small} />;
    };
    const dot = <Dot />;
    const at = (zoom: number) => <CanvasZoomProvider zoom={zoom}>{dot}</CanvasZoomProvider>;
    const { container, rerender } = render(at(0.9));
    expect(container.querySelector('i')!.dataset.small).toBe('false');
    asked.length = 0;
    for (const zoom of [0.7, 0.5, 0.3]) rerender(at(zoom));
    expect(asked).toEqual([]);
    expect(container.querySelector('i')!.dataset.small).toBe('false');
    act(() => {
      vi.advanceTimersByTime(ZOOM_SETTLE_MS);
    });
    expect(container.querySelector('i')!.dataset.small).toBe('true');
    const outside = render(<Dot />);
    expect(outside.container.querySelector('i')!.dataset.small).toBe('false');
    outside.unmount();
  });

  it('settles a following part to its size on screen once the zoom stands still', () => {
    vi.useFakeTimers();
    let renders = 0;
    const Part = () => {
      useEffect(() => {
        renders += 1;
      });
      return <ZoomFollowing className="dot" />;
    };
    const part = <Part />;
    const at = (zoom: number) => <CanvasZoomProvider zoom={zoom}>{part}</CanvasZoomProvider>;
    const { container, rerender } = render(at(0.5));
    const dot = () => (container.querySelector('.dot') as HTMLElement).style.transform;
    expect(dot()).toBe('scale(2)');
    // While the zoom moves it keeps its scale, and nothing renders for the steps.
    const before = renders;
    for (const zoom of [0.4, 0.3, 0.2]) {
      rerender(at(zoom));
      act(() => {
        vi.advanceTimersByTime(ZOOM_SETTLE_MS - 20);
      });
      expect(dot()).toBe('scale(2)');
    }
    expect(renders).toBe(before);
    act(() => {
      vi.advanceTimersByTime(ZOOM_SETTLE_MS);
    });
    expect(dot()).toBe('scale(5)');
  });

  it('stops listening when it unmounts, with no timer left running', () => {
    vi.useFakeTimers();
    const { unmount, rerender } = render(
      <CanvasZoomProvider zoom={1}>
        <ZoomFollowing />
      </CanvasZoomProvider>,
    );
    rerender(
      <CanvasZoomProvider zoom={2}>
        <ZoomFollowing />
      </CanvasZoomProvider>,
    );
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
