// @vitest-environment jsdom
// SnapWidth rounds a text-sized box to whole pixels, so icons after it (or a
// centred parent) stay on the pixel grid and render sharp.
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SnapWidth } from './SnapWidth';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no layout: give the content and the parent the widths a browser
// would measure.
function measureAs(content: number, parent: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const width = this.classList.contains('w-max')
      ? content
      : this.dataset.parent !== undefined
        ? parent
        : 0;
    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0 } as DOMRect;
  });
}

function snapped(props: { matchParentParity?: boolean }) {
  const { container } = render(
    <div data-parent="">
      <SnapWidth {...props}>label</SnapWidth>
    </div>,
  );
  return (container.querySelector('[data-parent] > div') as HTMLElement).style.minWidth;
}

describe('SnapWidth', () => {
  it('rounds a fractional content width up to a whole pixel', () => {
    measureAs(61.39, 1440);
    expect(snapped({})).toBe('62px');
  });

  it('leaves a whole-pixel width as it is', () => {
    measureAs(62, 1440);
    expect(snapped({})).toBe('62px');
  });

  it("matches the parent's parity so centring stays on a whole pixel", () => {
    // 1441 - 62 is odd: centred, the box would sit half a pixel in.
    measureAs(61.39, 1441);
    expect(snapped({ matchParentParity: true })).toBe('63px');
    measureAs(61.39, 1440);
    expect(snapped({ matchParentParity: true })).toBe('62px');
  });

  it('keeps its width while it is not drawn, rather than snapping to zero', () => {
    // display: none (a strip hidden while another stands in) measures 0 with no boxes.
    measureAs(0, 0);
    expect(snapped({ matchParentParity: true })).toBe('');
  });

  // docs/specs/008-canvas/canvas-performance.md "Chrome after a gesture" (Work Tracker 911): a render of the box reads
  // no rect inside React's commit, a Tab Style change or a drop alike; the observer measures a real size change.
  it('reads no rect when its host renders again, and measures when the observer reports a change', () => {
    let report = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          report = cb;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      measureAs(61.39, 1440);
      const view = render(<SnapWidth>label</SnapWidth>);
      const rect = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
      rect.mockClear();
      view.rerender(<SnapWidth>label again</SnapWidth>);
      expect(rect).not.toHaveBeenCalled();
      measureAs(80.2, 1440);
      report();
      expect((view.container.firstElementChild as HTMLElement).style.minWidth).toBe('81px');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // Content that grows in a commit (a strip's names coming back) is not held to the old width until the observer
  // runs: the snapped width is a floor, so the box widens with its content in that same layout and nothing reading
  // the page in between finds the content hanging off one side (editor-header-fit.spec.ts, the top-row sweep).
  it('sets a floor, never a fixed width, so grown content widens its box at once', () => {
    measureAs(61.39, 1440);
    const { container } = render(<SnapWidth>label</SnapWidth>);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.minWidth).toBe('62px');
    expect(box.style.width).toBe('');
  });
});
