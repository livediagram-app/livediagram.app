// @vitest-environment jsdom

// A face drawn by hand under Sketch (docs/specs/008-canvas/finish.md "Every other face is drawn by hand too"): the
// live face over a still ink copy of it, the copy re-taken once the face settles, never rendered by React twice.

import { act, cleanup, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SKETCH_INK_MAX_WAIT_MS,
  SKETCH_INK_SETTLE_MS,
  SketchFace,
  sketchInkCopy,
} from './SketchFace';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** A count the test moves on from outside React, read through a store, so no setter leaves a render. */
function createCount(initial: number) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read: () => value,
    bump: () => {
      value += 1;
      for (const listener of listeners) listener();
    },
  };
}

function face() {
  const live = document.createElement('div');
  live.innerHTML =
    '<svg><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><text>4,000</text></svg>' +
    '<img src="a.png"/><iframe></iframe><div data-sketch-skip=""><span>inner tab</span></div>' +
    '<button id="b">Go</button>';
  return live;
}

describe('sketchInkCopy', () => {
  it('keeps the drawing and its words (hidden by CSS), dropping photos, embeds and skipped parts', () => {
    const copy = sketchInkCopy(face());
    expect(copy.querySelector('rect')).not.toBeNull();
    expect(copy.querySelector('text')?.textContent).toBe('4,000');
    expect(copy.querySelector('img, iframe, [data-sketch-skip]')).toBeNull();
  });

  it('carries no ids, so the live face keeps its own references', () => {
    expect(sketchInkCopy(face()).querySelector('[id]')).toBeNull();
  });
});

describe('SketchFace', () => {
  it('renders the face as it is when not sketched', () => {
    const { container } = render(
      <SketchFace active={false}>
        <span>face</span>
      </SketchFace>,
    );
    expect(container.innerHTML).toBe('<span>face</span>');
  });

  it('puts an inert, hidden ink copy under the live face', () => {
    const { container } = render(
      <SketchFace active>
        <svg>
          <rect />
        </svg>
        <span>words</span>
      </SketchFace>,
    );
    const [ink, live] = Array.from(container.children);
    expect(ink!.hasAttribute('data-sketch-ink')).toBe(true);
    expect(ink!.getAttribute('aria-hidden')).toBe('true');
    expect(ink!.hasAttribute('inert')).toBe(true);
    expect(ink!.querySelector('rect')).not.toBeNull();
    expect(live!.hasAttribute('data-sketch-words')).toBe(true);
    expect(live!.textContent).toBe('words');
  });

  it('re-takes the copy once the face is still, and renders the face once', async () => {
    vi.useFakeTimers();
    let renders = 0;
    const count = createCount(1);
    function Bars() {
      const n = useSyncExternalStore(count.subscribe, count.read);
      renders++;
      return (
        <svg>
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} />
          ))}
        </svg>
      );
    }
    const { container } = render(
      <SketchFace active>
        <Bars />
      </SketchFace>,
    );
    const ink = container.firstElementChild!;
    expect(ink.querySelectorAll('rect')).toHaveLength(1);
    await act(async () => count.bump());
    await act(async () => count.bump());
    // Still changing: the copy waits.
    await act(async () => vi.advanceTimersByTime(SKETCH_INK_SETTLE_MS - 1));
    expect(ink.querySelectorAll('rect')).toHaveLength(1);
    await act(async () => vi.advanceTimersByTime(1));
    expect(ink.querySelectorAll('rect')).toHaveLength(3);
    expect(renders).toBe(3);
  });

  it('follows a face that never settles at least once per longest wait', async () => {
    vi.useFakeTimers();
    const count = createCount(0);
    function Ticker() {
      const n = useSyncExternalStore(count.subscribe, count.read);
      return <span data-n={n} />;
    }
    const { container } = render(
      <SketchFace active>
        <Ticker />
      </SketchFace>,
    );
    const ink = container.firstElementChild!;
    const step = SKETCH_INK_SETTLE_MS / 2;
    for (let t = 0; t < SKETCH_INK_MAX_WAIT_MS; t += step) {
      await act(async () => count.bump());
      await act(async () => vi.advanceTimersByTime(step));
    }
    expect(Number(ink.querySelector('span')!.getAttribute('data-n'))).toBeGreaterThan(0);
  });

  it('clears the copy when the element stops being sketched', () => {
    const { container, rerender } = render(
      <SketchFace active>
        <span>face</span>
      </SketchFace>,
    );
    rerender(
      <SketchFace active={false}>
        <span>face</span>
      </SketchFace>,
    );
    expect(container.querySelector('[data-sketch-ink]')).toBeNull();
    expect(container.textContent).toBe('face');
  });
});
