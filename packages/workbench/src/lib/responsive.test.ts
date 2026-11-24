// @vitest-environment jsdom
// A touch-first screen (livediagram's docs/specs/007-editor/editor-modes.md "The tool a mode starts with"): a finger is
// the main pointer and nothing fine is attached. Media queries only.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FINE_POINTER_MEDIA_QUERY, isTouchFirstSync, TOUCH_FIRST_MEDIA_QUERY } from './responsive';

const before = window.matchMedia;
const device = (matching: readonly string[]) => {
  window.matchMedia = vi.fn((q: string) => ({ matches: matching.includes(q) }) as MediaQueryList);
};
afterEach(() => {
  window.matchMedia = before;
});

describe('isTouchFirstSync', () => {
  it('is an iPad or tablet worked by finger alone', () => {
    device([TOUCH_FIRST_MEDIA_QUERY]);
    expect(isTouchFirstSync()).toBe(true);
  });

  it('is not one with a trackpad or mouse attached, nor a touchscreen laptop', () => {
    device([TOUCH_FIRST_MEDIA_QUERY, FINE_POINTER_MEDIA_QUERY]);
    expect(isTouchFirstSync()).toBe(false);
  });

  it('is not a desktop, nor a browser without media queries', () => {
    device([FINE_POINTER_MEDIA_QUERY]);
    expect(isTouchFirstSync()).toBe(false);
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect(isTouchFirstSync()).toBe(false);
  });
});
