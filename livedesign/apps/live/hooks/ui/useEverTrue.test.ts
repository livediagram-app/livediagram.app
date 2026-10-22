// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEverTrue } from './useEverTrue';

describe('useEverTrue', () => {
  it('stays false until the value is first true, then stays true', () => {
    const { result, rerender } = renderHook(({ v }) => useEverTrue(v), {
      initialProps: { v: false },
    });
    expect(result.current).toBe(false);
    rerender({ v: true });
    expect(result.current).toBe(true);
    rerender({ v: false });
    expect(result.current).toBe(true);
  });
});
