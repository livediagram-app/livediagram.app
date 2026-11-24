// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FINE_POINTER_MEDIA_QUERY,
  TOUCH_FIRST_MEDIA_QUERY,
} from '@liveworkspace/workbench/lib/responsive';
import { useCanvasTool } from './useCanvasTool';

const before = window.matchMedia;
// A device answering these media queries.
const device = (matching: readonly string[]) => {
  window.matchMedia = vi.fn((q: string) => ({ matches: matching.includes(q) }) as MediaQueryList);
};
afterEach(() => {
  window.matchMedia = before;
});

// The tool the editor starts with: Hand on an iPad worked by finger, Select wherever a fine pointer is present.
describe('useCanvasTool', () => {
  it('starts an iPad or tablet with no trackpad or mouse on Hand', () => {
    device([TOUCH_FIRST_MEDIA_QUERY]);
    expect(renderHook(() => useCanvasTool()).result.current.canvasTool).toBe('pan');
  });

  it('keeps Select with a trackpad or mouse attached, and on a desktop', () => {
    device([TOUCH_FIRST_MEDIA_QUERY, FINE_POINTER_MEDIA_QUERY]);
    expect(renderHook(() => useCanvasTool()).result.current.canvasTool).toBe('select');
    device([FINE_POINTER_MEDIA_QUERY]);
    expect(renderHook(() => useCanvasTool()).result.current.canvasTool).toBe('select');
  });
});
