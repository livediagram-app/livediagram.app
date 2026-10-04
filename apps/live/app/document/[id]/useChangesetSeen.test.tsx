// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChangesetSeen } from './useChangesetSeen';

describe('useChangesetSeen', () => {
  it('raises the admission ref at once and the saved state with the render, never moving back', () => {
    const { result } = renderHook(() => useChangesetSeen());
    act(() => {
      result.current.noteSeen('t1', 4);
      expect(result.current.seenRef.current.get('t1')).toBe(4);
      result.current.noteSeen('t1', 2);
    });
    expect(result.current.seen.get('t1')).toBe(4);
    expect(result.current.seenRef.current.get('t1')).toBe(4);
  });

  it('keeps one noteSeen across renders, so effects can list it', () => {
    const { result, rerender } = renderHook(() => useChangesetSeen());
    const first = result.current.noteSeen;
    rerender();
    expect(result.current.noteSeen).toBe(first);
  });
});
