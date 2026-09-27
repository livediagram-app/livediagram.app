// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCanvasPanAndMarquee } from './useCanvasPanAndMarquee';

// Held Space turns a canvas drag into a pan (docs/specs/008-canvas/canvas-and-palette.md). The pointerdown reads the
// ref; the cursor is rendered from the state, so both must follow the key.
function setup() {
  return renderHook(() =>
    useCanvasPanAndMarquee({
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      elements: [],
      wrapperRef: { current: null },
      onDeselect: vi.fn(),
      onSelectMarquee: vi.fn(),
    }),
  );
}

const key = (type: 'keydown' | 'keyup', target: EventTarget = document.body) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true }));
  });

describe('useCanvasPanAndMarquee space-held modifier', () => {
  it('renders held while Space is down, and released on keyup', () => {
    const { result } = setup();
    expect(result.current.spaceHeld).toBe(false);

    key('keydown');
    expect(result.current.spaceHeld).toBe(true);
    expect(result.current.spaceHeldRef.current).toBe(true);

    key('keyup');
    expect(result.current.spaceHeld).toBe(false);
    expect(result.current.spaceHeldRef.current).toBe(false);
  });

  it('ignores Space typed into a text field', () => {
    const { result } = setup();
    const input = document.createElement('input');
    document.body.append(input);
    key('keydown', input);
    expect(result.current.spaceHeld).toBe(false);
    expect(result.current.spaceHeldRef.current).toBe(false);
    input.remove();
  });
});
