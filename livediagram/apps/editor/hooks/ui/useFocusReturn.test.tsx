// @vitest-environment jsdom
// docs/specs/012-collaboration/presentation-mode.md "Exiting": leaving a deck hands keyboard focus back to the control
// that started it, or the canvas when that control has gone; Escape had dropped it on the page.
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFocusReturn } from './useFocusReturn';

let frames: FrameRequestCallback[] = [];
const runFrame = () => {
  const due = frames;
  frames = [];
  for (const cb of due) cb(0);
};

const button = (label: string) => {
  const b = document.createElement('button');
  b.textContent = label;
  // jsdom lays nothing out: a shown control has a box.
  b.getClientRects = () => [{}] as unknown as DOMRectList;
  document.body.append(b);
  return b;
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useFocusReturn', () => {
  it('puts focus back on the control that had it when it began', () => {
    const present = button('Present');
    const canvas = button('Canvas');
    present.focus();
    const { rerender } = renderHook(({ on }) => useFocusReturn(on, () => canvas), {
      initialProps: { on: false },
    });
    rerender({ on: true });
    // The deck takes focus while it runs.
    document.body.focus();
    (document.activeElement as HTMLElement | null)?.blur();
    rerender({ on: false });
    runFrame();
    expect(document.activeElement).toBe(present);
  });

  it('falls back when that control has gone', () => {
    const present = button('Present');
    const canvas = button('Canvas');
    present.focus();
    const fallback = () => canvas;
    const { rerender } = renderHook(({ on }) => useFocusReturn(on, fallback), {
      initialProps: { on: false },
    });
    rerender({ on: true });
    present.remove();
    rerender({ on: false });
    runFrame();
    expect(document.activeElement).toBe(canvas);
  });
});
