// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useViewportHeight } from './useViewportHeight';
import { useViewportWidth } from './useViewportWidth';

// docs/specs/003-system-architecture/react-state-and-effects.md "Rendering in the browser only": the window's size
// is an external store, read in the browser and 0 in the prerender.

const resizeTo = (width: number, height: number) =>
  act(() => {
    Object.assign(window, { innerWidth: width, innerHeight: height });
    window.dispatchEvent(new Event('resize'));
  });

describe('useViewportWidth and useViewportHeight', () => {
  it('read the window, and follow it as it resizes', () => {
    resizeTo(1280, 800);
    const w = renderHook(() => useViewportWidth());
    const h = renderHook(() => useViewportHeight());
    expect([w.result.current, h.result.current]).toEqual([1280, 800]);
    resizeTo(390, 844);
    expect([w.result.current, h.result.current]).toEqual([390, 844]);
  });

  it('are 0, not measured, in the prerender', () => {
    function Size() {
      return <span>{`${useViewportWidth()}x${useViewportHeight()}`}</span>;
    }
    expect(renderToString(<Size />)).toBe('<span>0x0</span>');
  });
});
