// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFollowingDraft } from './useFollowingDraft';

// A local draft of a value that also changes from outside (another peer, an undo): the draft is edited
// freely, and replaced whenever the source itself changes, adjusted during render so the replaced draft
// never shows for a frame (docs/specs/003-system-architecture/react-state-and-effects.md).
describe('useFollowingDraft', () => {
  it('starts from the source, through the mapping', () => {
    const { result } = renderHook(() => useFollowingDraft(12.4, (v) => String(Math.round(v))));
    expect(result.current[0]).toBe('12');
  });

  it('keeps an edit while the source holds, across re-renders', () => {
    const { result, rerender } = renderHook(({ v }) => useFollowingDraft(v), {
      initialProps: { v: 'a' },
    });
    act(() => result.current[1]('typed'));
    rerender({ v: 'a' });
    expect(result.current[0]).toBe('typed');
  });

  it('replaces the draft when the source changes', () => {
    const { result, rerender } = renderHook(({ v }) => useFollowingDraft(v), {
      initialProps: { v: 'a' },
    });
    act(() => result.current[1]('typed'));
    rerender({ v: 'b' });
    expect(result.current[0]).toBe('b');
  });

  it('compares with Object.is, so NaN is stable and -0 is a change', () => {
    const { result, rerender } = renderHook(({ v }) => useFollowingDraft(v), {
      initialProps: { v: NaN },
    });
    act(() => result.current[1](5));
    rerender({ v: NaN });
    expect(result.current[0]).toBe(5);
    rerender({ v: 0 });
    rerender({ v: -0 });
    expect(Object.is(result.current[0], -0)).toBe(true);
  });
});
