// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setLayer } from '@livedesign/photo-engine';
import { at, harness, photoOf, solid } from './photo-test-utils';
import { shakeLock, useLockShake } from './lock-shake';
import { toolHandler } from './tools';

// docs/specs/031-photo/photo-tools.md "Shared gestures and options": a locked layer refuses with a toast and
// its lock icon shakes.
describe('the lock shake', () => {
  it('names the layer shaken, and a new count each time', () => {
    const a = renderHook(() => useLockShake('a'));
    const b = renderHook(() => useLockShake('b'));
    act(() => shakeLock('a'));
    const first = a.result.current;
    expect(first).toBeGreaterThan(0);
    expect(b.result.current).toBe(0);
    act(() => shakeLock('a'));
    expect(a.result.current).toBeGreaterThan(first);
  });

  it('shakes when a tool is refused by a lock', () => {
    const h = harness(photoOf(8, 8), { a: solid(8, 8, [255, 255, 255, 255]) });
    h.s.commitStack(setLayer(h.s.photo, 'a', { locks: { pixels: true } }), 'Lock');
    const seen = renderHook(() => useLockShake('a'));
    const before = seen.result.current;
    act(() => {
      toolHandler('brush', h.ctx).down(at(2, 2));
    });
    expect(h.toasts).toEqual(['a is locked.']);
    expect(seen.result.current).toBeGreaterThan(before);
  });
});
