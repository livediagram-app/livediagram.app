// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEyeDropper } from './useEyeDropper';

const w = window as unknown as { EyeDropper?: unknown };

afterEach(() => {
  delete w.EyeDropper;
});

describe('useEyeDropper', () => {
  it('is unsupported, and picks nothing, where the browser has no EyeDropper', async () => {
    const { result } = renderHook(() => useEyeDropper());
    expect(result.current.supported).toBe(false);
    expect(await result.current.pick()).toBeNull();
  });

  it('returns the sampled colour as lower-case hex', async () => {
    w.EyeDropper = class {
      open() {
        return Promise.resolve({ sRGBHex: '#A1B2C3' });
      }
    };
    const { result } = renderHook(() => useEyeDropper());
    expect(result.current.supported).toBe(true);
    expect(await result.current.pick()).toBe('#a1b2c3');
  });

  it('treats a cancelled pick (Escape) as no pick, not an error', async () => {
    w.EyeDropper = class {
      open() {
        return Promise.reject(new DOMException('cancelled', 'AbortError'));
      }
    };
    const { result } = renderHook(() => useEyeDropper());
    const pick = vi.fn(result.current.pick);
    expect(await pick()).toBeNull();
  });
});
