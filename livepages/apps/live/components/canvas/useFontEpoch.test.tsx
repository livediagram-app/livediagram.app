// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFontEpoch } from './useFontEpoch';

// Auto-fit measures the face it paints, and webfonts land after first paint
// (docs/specs/004-interface-design/fonts.md `display=swap`, from a stylesheet that does not block
// first paint). Without a nudge, a canvas nobody has touched keeps the size it measured against
// the swap fallback.
describe('useFontEpoch', () => {
  const setFonts = (fonts: unknown) => {
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
  };
  const fontSet = (status: string, ready: Promise<void>) => {
    const target = new EventTarget();
    return Object.assign(target, { status, ready });
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves on once the pending loads settle', async () => {
    let settle: () => void = () => {};
    setFonts(fontSet('loading', new Promise<void>((r) => (settle = r))));
    const { result } = renderHook(() => useFontEpoch());
    expect(result.current).toBe(0);
    settle();
    await waitFor(() => expect(result.current).toBe(1));
  });

  it('holds still when the fonts are already in', async () => {
    setFonts(fontSet('loaded', Promise.resolve()));
    const { result } = renderHook(() => useFontEpoch());
    await Promise.resolve();
    expect(result.current).toBe(0);
  });

  it('moves on again for faces that land later (a late stylesheet, a face first picked)', () => {
    const fonts = fontSet('loaded', Promise.resolve());
    setFonts(fonts);
    const { result } = renderHook(() => useFontEpoch());
    act(() => {
      fonts.dispatchEvent(new Event('loadingdone'));
    });
    expect(result.current).toBe(1);
    act(() => {
      fonts.dispatchEvent(new Event('loadingdone'));
    });
    expect(result.current).toBe(2);
  });

  it('holds still in a browser with no font-loading API', () => {
    setFonts(undefined);
    const { result } = renderHook(() => useFontEpoch());
    expect(result.current).toBe(0);
  });
});
