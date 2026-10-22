// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readVisualViewportBand } from './useVisualViewportBand';

// The visible band (docs/specs/007-editor/editor-app.md "A dialog stays above the on-screen keyboard").

afterEach(() => vi.unstubAllGlobals());

const viewport = (v: { height: number; offsetTop?: number }) =>
  vi.stubGlobal('visualViewport', {
    width: window.innerWidth,
    offsetTop: 0,
    offsetLeft: 0,
    ...v,
  });

describe('readVisualViewportBand', () => {
  it('is null without a visualViewport', () => {
    vi.stubGlobal('visualViewport', undefined);
    expect(readVisualViewportBand()).toBeNull();
  });

  it('is null while the whole window is visible, within rounding', () => {
    viewport({ height: window.innerHeight - 0.5 });
    expect(readVisualViewportBand()).toBeNull();
  });

  it('is the visible band while a keyboard covers the bottom', () => {
    viewport({ height: 420 });
    expect(readVisualViewportBand()).toEqual({
      top: 0,
      left: 0,
      width: window.innerWidth,
      height: 420,
    });
  });

  it('follows a band panned down the page', () => {
    viewport({ height: window.innerHeight, offsetTop: 200 });
    expect(readVisualViewportBand()?.top).toBe(200);
  });
});
