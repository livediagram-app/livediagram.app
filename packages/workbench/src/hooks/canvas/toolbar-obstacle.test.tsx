// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { TOOLBAR_OBSTACLE_EVENT, useToolbarObstacle } from './toolbar-obstacle';

// Work Tracker 1032: the Quick Style panel says when it arrives, moves, resizes or goes, so the selection toolbar
// places itself again.

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

let resized: () => void = () => {};
class FakeResize {
  constructor(cb: () => void) {
    resized = cb;
  }
  observe() {}
  disconnect() {}
}

function Panel({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useToolbarObstacle(ref, active);
  return <div ref={ref} />;
}

describe('useToolbarObstacle', () => {
  it('notes the panel once a frame as it arrives or resizes, and as it goes', () => {
    vi.stubGlobal('ResizeObserver', FakeResize);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const heard = vi.fn();
    window.addEventListener(TOOLBAR_OBSTACLE_EVENT, heard);
    try {
      const { unmount } = render(<Panel active />);
      // Arriving and its first resize share one frame.
      resized();
      expect(frames).toHaveLength(1);
      frames.shift()!(0);
      expect(heard).toHaveBeenCalledTimes(1);
      resized();
      frames.shift()!(0);
      expect(heard).toHaveBeenCalledTimes(2);
      unmount();
      expect(heard).toHaveBeenCalledTimes(3);
    } finally {
      window.removeEventListener(TOOLBAR_OBSTACLE_EVENT, heard);
    }
  });

  it('notes nothing while inactive, and works without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const heard = vi.fn();
    window.addEventListener(TOOLBAR_OBSTACLE_EVENT, heard);
    try {
      const { unmount } = render(<Panel active={false} />);
      unmount();
      expect(heard).not.toHaveBeenCalled();
      const second = render(<Panel active />);
      second.unmount();
      expect(heard).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(TOOLBAR_OBSTACLE_EVENT, heard);
    }
  });
});
