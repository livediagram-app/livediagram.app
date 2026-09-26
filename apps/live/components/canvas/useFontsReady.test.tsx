// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFontsReady } from './useFontsReady';

// Auto-fit measures the face it paints, and webfonts land after first paint
// (docs/specs/004-interface-design/fonts.md `display=swap`). Without a nudge, a board nobody has touched keeps
// the size it measured against the swap fallback.
describe('useFontsReady', () => {
  const setFonts = (fonts: unknown) => {
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flips once the pending loads settle', async () => {
    let settle: () => void = () => {};
    setFonts({ status: 'loading', ready: new Promise<void>((r) => (settle = r)) });
    const { result } = renderHook(() => useFontsReady());
    expect(result.current).toBe(false);
    settle();
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('starts ready when the fonts are already in', () => {
    setFonts({ status: 'loaded', ready: Promise.resolve() });
    const { result } = renderHook(() => useFontsReady());
    expect(result.current).toBe(true);
  });

  it('is ready in a browser with no font-loading API rather than waiting forever', async () => {
    setFonts(undefined);
    const { result } = renderHook(() => useFontsReady());
    await waitFor(() => expect(result.current).toBe(true));
  });
});
